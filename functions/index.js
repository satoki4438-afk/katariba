// runtime: nodejs22
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// ─── 定数 ────────────────────────────────────────────────

const RAKUTEN_API_KEY = process.env.RAKUTEN_API_KEY;
const RAKUTEN_ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY;
const RAKUTEN_AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

function requireAdminSecret(req, res) {
  if (req.headers["x-admin-secret"] !== ADMIN_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// 楽天ブックスジャンルID 除外リスト（APIレスポンスから実測済み）
// 001001xxxx: マンガ（コミック）全般
// 001013xxxx: 写真集・タレント
// 001015: ムック・マガジン（ONE PIECE magazineなどがここに分類）
const EXCLUDED_GENRE_PREFIXES = [
  "001001", // マンガ（コミック）
  "001013", // 写真集・タレント
  "001015", // ムック・マガジン
];

// ─── ユーティリティ ──────────────────────────────────────

function generateSlug(title, date) {
  const d = date instanceof Date ? date : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const sanitized = title
    .replace(/[　\s]+/g, "-")
    .replace(/[『』「」【】（）()。、・…！？!?〜～―—\/\\|]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  return `${sanitized}-${yyyy}-${mm}`;
}

function isExcludedGenre(genreId) {
  if (!genreId) return false;
  return EXCLUDED_GENRE_PREFIXES.some((prefix) => genreId.startsWith(prefix));
}

// ─── 楽天ブックスAPI（ベストセラー取得）────────────────────

async function fetchRakutenBestsellers() {
  const params = new URLSearchParams({
    applicationId: RAKUTEN_API_KEY,
    accessKey: RAKUTEN_ACCESS_KEY,
    booksGenreId: "001004", // 小説・エッセイ
    sort: "sales",
    hits: 30,
    formatVersion: 2,
  });
  if (RAKUTEN_AFFILIATE_ID) params.append("affiliateId", RAKUTEN_AFFILIATE_ID);

  const res = await fetch(
    `https://openapi.rakuten.co.jp/services/api/BooksBook/Search/20170404?${params}`
  );
  const data = await res.json();

  if (data.error || !data.Items) {
    console.warn("[fetchRakutenBestsellers] API error or empty:", JSON.stringify(data).slice(0, 500));
    return [];
  }

  return data.Items
    .filter((b) => !isExcludedGenre(b.booksGenreId))
    .map((b) => ({
      isbn: b.isbn || null,
      title: b.title,
      author: b.author || "",
      coverUrl: b.largeImageUrl || b.mediumImageUrl || null,
      rakutenUrl: RAKUTEN_AFFILIATE_ID && b.itemUrl
        ? `https://hb.afl.rakuten.co.jp/hgc/${RAKUTEN_AFFILIATE_ID}/?pc=${encodeURIComponent(b.itemUrl)}`
        : b.itemUrl || null,
      genreId: b.booksGenreId || null,
    }));
}

// ─── 半年縛りチェック ────────────────────────────────────

async function getRecentBookTitles() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const snap = await db.collection("threads")
    .where("created_at", ">=", admin.firestore.Timestamp.fromDate(sixMonthsAgo))
    .get();
  return snap.docs.map((d) => d.data().title);
}

// ─── Bルール: ベストセラー3冊選定 ───────────────────────────
// 初登場・2週連続 → OK / 3週以上連続 → スキップ
// book_tracking コレクションで連続週数を管理

async function getBestsellerBooks(recentTitles, weekNum) {
  const allBestsellers = await fetchRakutenBestsellers();
  if (allBestsellers.length === 0) return [];

  const isbns = allBestsellers.map((b) => b.isbn).filter(Boolean);

  // book_tracking を一括取得（Firestoreのin制限: 30件）
  const trackingMap = {};
  const chunks = [];
  for (let i = 0; i < isbns.length; i += 30) chunks.push(isbns.slice(i, i + 30));
  for (const chunk of chunks) {
    if (chunk.length === 0) continue;
    const snap = await db.collection("book_tracking").where("isbn", "in", chunk).get();
    snap.docs.forEach((d) => { trackingMap[d.data().isbn] = d.data(); });
  }

  const selected = [];
  const seenAuthors = new Set();
  const trackingUpdates = [];

  for (const book of allBestsellers) {
    const trackData = book.isbn ? trackingMap[book.isbn] : null;

    // 連続週数を計算
    let consecutive = 1;
    if (trackData && trackData.last_week_num === weekNum - 1) {
      consecutive = (trackData.consecutive_weeks || 0) + 1;
    }

    // tracking更新をキューに積む（全ランクイン本を対象）
    if (book.isbn) {
      trackingUpdates.push({
        isbn: book.isbn,
        title: book.title,
        consecutive_weeks: consecutive,
        last_week_num: weekNum,
      });
    }

    // 半年縛り / Bルール（3週以上）はスキップ
    if (recentTitles.includes(book.title)) continue;
    if (consecutive >= 3) continue;

    // 同一著者は上位1冊のみ採用
    if (seenAuthors.has(book.author)) continue;

    if (selected.length < 3) {
      seenAuthors.add(book.author);
      selected.push({ ...book, week_count: consecutive });
    }
  }

  // book_tracking を一括更新
  if (trackingUpdates.length > 0) {
    const batch = db.batch();
    for (const u of trackingUpdates) {
      const ref = db.collection("book_tracking").doc(u.isbn);
      batch.set(ref, u, { merge: true });
    }
    await batch.commit();
  }

  return selected;
}

// ─── リクエスト投票1位取得 ───────────────────────────────

async function getTopRequestBook(recentTitles) {
  // 日次バッチが更新した request_ranking を参照
  const rankDoc = await db.collection("metadata").doc("request_ranking").get();

  let books = [];
  if (rankDoc.exists) {
    books = rankDoc.data().books || [];
  } else {
    // フォールバック: votes を直接集計
    const votesSnap = await db.collection("votes").get();
    const countMap = {};
    const metaMap = {};
    votesSnap.docs.forEach((d) => {
      const data = d.data();
      const { book_id, book_title } = data;
      if (!book_id) return;
      countMap[book_id] = (countMap[book_id] || 0) + 1;
      if (!metaMap[book_id]) metaMap[book_id] = data;
    });
    books = Object.entries(countMap)
      .map(([book_id, vote_count]) => ({
        book_id,
        book_title: metaMap[book_id]?.book_title || "",
        vote_count,
      }))
      .sort((a, b) => b.vote_count - a.vote_count);
  }

  for (const b of books) {
    if (!recentTitles.includes(b.book_title)) {
      return b;
    }
  }
  return null;
}

// ─── 週次スケジューラー（毎週土曜 AM 0:00 JST）─────────────

exports.weeklyBookScheduler = onSchedule(
  { schedule: "0 0 * * 6", timeZone: "Asia/Tokyo", region: "asia-northeast1" },
  async () => { await runWeeklyScheduler(); }
);

exports.runWeeklySchedulerManual = onRequest(
  { region: "asia-northeast1", invoker: "public" },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }
    if (!requireAdminSecret(req, res)) return;
    try {
      await runWeeklyScheduler();
      res.status(200).json({ success: true });
    } catch (e) {
      console.error("[weeklyScheduler]", e);
      res.status(500).json({ error: e.message });
    }
  }
);

async function runWeeklyScheduler() {
  const now = admin.firestore.Timestamp.now();
  const nowDate = now.toDate();

  // 現在の週番号
  const weekSnap = await db.collection("weeklySchedule")
    .orderBy("startDate", "desc").limit(1).get();
  const lastWeek = weekSnap.empty ? null : weekSnap.docs[0].data();
  const newWeekNum = lastWeek ? (lastWeek.week || 1) + 1 : 1;

  // 1. week2 → closed
  const week2Snap = await db.collection("threads")
    .where("status", "==", "week2").get();
  if (!week2Snap.empty) {
    const batch = db.batch();
    week2Snap.docs.forEach((d) => batch.update(d.ref, { status: "closed" }));
    await batch.commit();
    console.log(`[weeklyScheduler] closed: ${week2Snap.size} threads`);
  }

  // 2. week1 → week2 + visible: true（全コメント一斉公開）
  const week1Snap = await db.collection("threads")
    .where("status", "==", "week1").get();
  if (!week1Snap.empty) {
    const batch = db.batch();
    week1Snap.docs.forEach((d) => batch.update(d.ref, {
      status: "week2",
      visible: true,
      opened_at: now,
    }));
    await batch.commit();
    console.log(`[weeklyScheduler] promoted to week2: ${week1Snap.size} threads`);
  }

  // 3. ベストセラー3冊 + リクエスト1冊を取得
  const recentTitles = await getRecentBookTitles();
  const bestsellers = await getBestsellerBooks(recentTitles, newWeekNum);
  bestsellers.forEach((b) => recentTitles.push(b.title));

  const topRequest = await getTopRequestBook(recentTitles);

  // 4. 新スレ生成（week1・visible: false）
  const addedIds = [];
  const threadBatch = db.batch();

  for (const book of bestsellers) {
    const ref = db.collection("threads").doc();
    threadBatch.set(ref, {
      book_id: ref.id,
      title: book.title,
      author: book.author,
      source: "bestseller",
      status: "week1",
      visible: false,
      week_count: book.week_count,
      likes_count: 0,
      reply_count: 0,
      score: 0,
      isbn: book.isbn || null,
      coverUrl: book.coverUrl || null,
      rakutenUrl: book.rakutenUrl || null,
      slug: generateSlug(book.title, nowDate),
      week: newWeekNum,
      created_at: now,
      opened_at: null,
    });
    addedIds.push(ref.id);
  }

  if (topRequest) {
    const ref = db.collection("threads").doc();
    threadBatch.set(ref, {
      book_id: ref.id,
      title: topRequest.book_title,
      author: topRequest.author || "",
      source: "request",
      status: "week1",
      visible: false,
      week_count: 0,
      likes_count: 0,
      reply_count: 0,
      score: 0,
      isbn: topRequest.isbn || null,
      coverUrl: topRequest.coverUrl || null,
      rakutenUrl: topRequest.rakutenUrl || null,
      slug: generateSlug(topRequest.book_title, nowDate),
      week: newWeekNum,
      created_at: now,
      opened_at: null,
    });
    addedIds.push(ref.id);

    // 選出された本の投票をリセット（削除）
    const votesSnap = await db.collection("votes")
      .where("book_id", "==", topRequest.book_id).get();
    if (!votesSnap.empty) {
      const delBatch = db.batch();
      votesSnap.docs.forEach((d) => delBatch.delete(d.ref));
      await delBatch.commit();
    }
  }

  await threadBatch.commit();

  // 5. weeklySchedule に記録
  await db.collection("weeklySchedule").add({
    week: newWeekNum,
    startDate: now,
    threadIds: addedIds,
    status: "active",
  });

  console.log(`[weeklyScheduler] week${newWeekNum}: ${addedIds.length} threads created (bestseller:${bestsellers.length} request:${topRequest ? 1 : 0})`);
}

// ─── 日次バッチ（毎日 AM 0:00 JST）─────────────────────────

exports.dailyRankingBatch = onSchedule(
  { schedule: "0 0 * * *", timeZone: "Asia/Tokyo", region: "asia-northeast1" },
  async () => { await runDailyBatch(); }
);

exports.runDailyBatchManual = onRequest(
  { region: "asia-northeast1", invoker: "public" },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }
    if (!requireAdminSecret(req, res)) return;
    try {
      await runDailyBatch();
      res.status(200).json({ success: true });
    } catch (e) {
      console.error("[dailyBatch]", e);
      res.status(500).json({ error: e.message });
    }
  }
);

async function runDailyBatch() {
  const now = admin.firestore.Timestamp.now();
  await Promise.all([
    updateRequestRanking(now),
    updateUserLikesRanking(now),
    updateThreadRanking(now),
  ]);
  console.log("[dailyBatch] done");
}

// ① リクエストランキング集計
async function updateRequestRanking(now) {
  const votesSnap = await db.collection("votes").get();

  const countMap = {};
  const titleMap = {};

  votesSnap.docs.forEach((d) => {
    const { book_id, book_title } = d.data();
    if (!book_id) return;
    countMap[book_id] = (countMap[book_id] || 0) + 1;
    titleMap[book_id] = book_title;
  });

  const books = Object.entries(countMap)
    .map(([book_id, vote_count]) => ({
      book_id,
      book_title: titleMap[book_id] || "",
      vote_count,
    }))
    .sort((a, b) => b.vote_count - a.vote_count)
    .slice(0, 50);

  await db.collection("metadata").doc("request_ranking").set({
    books,
    updated_at: now,
  });

  console.log(`[dailyBatch] request_ranking: ${books.length} books`);
}

// ② 累計いいねランキング集計 + 論客バッジ付与
async function updateUserLikesRanking(now) {
  const likesSnap = await db.collection("likes").get();

  const likeCountMap = {};
  likesSnap.docs.forEach((d) => {
    const { target_user_id } = d.data();
    if (!target_user_id) return;
    likeCountMap[target_user_id] = (likeCountMap[target_user_id] || 0) + 1;
  });

  const sorted = Object.entries(likeCountMap)
    .sort((a, b) => b[1] - a[1]);

  // user_stats 更新 & 1,000いいね達成者にバッジ付与
  if (sorted.length > 0) {
    const batch = db.batch();
    sorted.forEach(([userId, total_likes], idx) => {
      const ref = db.collection("user_stats").doc(userId);
      const update = { total_likes, rank: idx + 1, updated_at: now };
      if (total_likes >= 1000) update.badge = "ronkaku";
      batch.set(ref, update, { merge: true });
    });
    await batch.commit();
  }

  // user_ranking メタデータ（上位100名）
  const topUsers = sorted.slice(0, 100).map(([user_id, total_likes], idx) => ({
    user_id,
    total_likes,
    rank: idx + 1,
  }));
  await db.collection("metadata").doc("user_ranking").set({
    users: topUsers,
    updated_at: now,
  });

  console.log(`[dailyBatch] user_ranking: ${topUsers.length} users, ronkaku candidates: ${sorted.filter(([, n]) => n >= 1000).length}`);
}

// ③ スレランキング集計（いいね数 + レス数）
async function updateThreadRanking(now) {
  const threadsSnap = await db.collection("threads").get();

  const threads = threadsSnap.docs.map((d) => {
    const data = d.data();
    const score = (data.likes_count || 0) + (data.reply_count || 0);
    return {
      thread_id: d.id,
      title: data.title,
      author: data.author || "",
      score,
      likes_count: data.likes_count || 0,
      reply_count: data.reply_count || 0,
      status: data.status,
      coverUrl: data.coverUrl || null,
      slug: data.slug || null,
    };
  }).sort((a, b) => b.score - a.score);

  // threads コレクションの score フィールドも更新
  const batch = db.batch();
  threadsSnap.docs.forEach((d) => {
    const data = d.data();
    const score = (data.likes_count || 0) + (data.reply_count || 0);
    batch.update(d.ref, { score });
  });
  await batch.commit();

  // thread_ranking メタデータ（上位100件）
  await db.collection("metadata").doc("thread_ranking").set({
    threads: threads.slice(0, 100),
    updated_at: now,
  });

  console.log(`[dailyBatch] thread_ranking: ${threads.length} threads`);
}

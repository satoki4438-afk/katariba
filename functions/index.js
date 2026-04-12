// runtime: nodejs22
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// 半年縛りチェック用：過去6ヶ月以内に登場した本のタイトル一覧を取得
async function getRecentBookTitles() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const snap = await db.collection("books")
    .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(sixMonthsAgo))
    .get();
  return snap.docs.map((d) => d.data().title);
}

// リクエスト投票数1位の作品を取得（半年縛り除外済み）
// genre を指定するとそのジャンル内での1位を返す
async function getTopRequest(recentTitles, genre) {
  let q = db.collection("requests")
    .where("used", "==", false)
    .orderBy("count", "desc");

  if (genre) {
    q = db.collection("requests")
      .where("used", "==", false)
      .where("genre", "==", genre)
      .orderBy("count", "desc");
  }

  const snap = await q.get();

  for (const doc of snap.docs) {
    const data = doc.data();
    if (!recentTitles.includes(data.title)) {
      return { id: doc.id, ...data };
    }
  }
  return null;
}

// ベストセラー1位を取得（Amazon PA-API / 楽天 API 未決定のためスタブ）
// 本番稼働前にAPI実装を差し込む
async function getBestseller(recentTitles) {
  // TODO: Amazon PA-API または 楽天商品検索APIで実際のランキングを取得する
  // 現時点では null を返す（運営が手動で追加するフロー）
  return null;
}

// 週次スケジューラー（毎週土曜 午前9時 JST = UTC 0時）
exports.weeklyBookScheduler = onSchedule(
  { schedule: "0 0 * * 6", timeZone: "Asia/Tokyo", region: "asia-northeast1" },
  async () => {
    await runWeeklyScheduler();
  }
);

// 管理画面から手動実行用エンドポイント
exports.runWeeklySchedulerManual = onRequest(
  { region: "asia-northeast1" },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }
    try {
      await runWeeklyScheduler();
      res.status(200).json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
);

async function runWeeklyScheduler() {
  const now = admin.firestore.Timestamp.now();
  const recentTitles = await getRecentBookTitles();

  // 1. 現在の週番号を計算
  const weekSnap = await db.collection("weeklySchedule").orderBy("startDate", "desc").limit(1).get();
  const lastWeek = weekSnap.empty ? null : weekSnap.docs[0].data();
  const newWeekNum = lastWeek ? (lastWeek.week || 1) + 1 : 1;

  // 2. ステータス更新: open → closed（2週前）
  const openBooks = await db.collection("books").where("status", "==", "open").get();
  const closeBatch = db.batch();
  openBooks.docs.forEach((d) => closeBatch.update(d.ref, { status: "closed" }));
  await closeBatch.commit();

  // 3. ステータス更新: reading → open + コメント一斉公開
  const readingBooks = await db.collection("books").where("status", "==", "reading").get();
  const openBatch = db.batch();
  readingBooks.docs.forEach((d) => openBatch.update(d.ref, { status: "open" }));
  await openBatch.commit();

  // Week1コメントを一斉公開
  for (const bookDoc of readingBooks.docs) {
    const commentsSnap = await db.collection("books").doc(bookDoc.id).collection("comments")
      .where("visible", "==", false).get();
    const commentBatch = db.batch();
    commentsSnap.docs.forEach((c) => commentBatch.update(c.ref, { visible: true }));
    await commentBatch.commit();
  }

  // 4. 新作2冊を追加
  const addedBooks = [];

  // 枠①: ベストセラー
  const bestseller = await getBestseller(recentTitles);
  if (bestseller) {
    const ref = await db.collection("books").add({
      title: bestseller.title,
      author: bestseller.author,
      status: "reading",
      week: newWeekNum,
      coverUrl: bestseller.coverUrl || null,
      amazonUrl: bestseller.amazonUrl || null,
      source: "bestseller",
      createdAt: now,
    });
    addedBooks.push(ref.id);
    recentTitles.push(bestseller.title);
  }

  // 枠②: リクエスト投票1位
  const topRequest = await getTopRequest(recentTitles);
  if (topRequest) {
    const ref = await db.collection("books").add({
      title: topRequest.title,
      author: topRequest.author || "",
      status: "reading",
      week: newWeekNum,
      coverUrl: topRequest.coverUrl || null,
      rakutenUrl: topRequest.rakutenUrl || null,
      source: "request",
      createdAt: now,
    });
    addedBooks.push(ref.id);
    await db.collection("requests").doc(topRequest.id).update({ used: true });
  }

  // 5. weeklySchedule に記録
  await db.collection("weeklySchedule").add({
    week: newWeekNum,
    startDate: now,
    book1Id: addedBooks[0] || null,
    book2Id: addedBooks[1] || null,
    status: "active",
  });
}

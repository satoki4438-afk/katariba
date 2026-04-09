"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, getDocs, getDoc, doc, query, orderBy, getCountFromServer
} from "firebase/firestore";
import AppNav from "@/components/AppNav";

export default function RankingPage() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState("reply");
  const [replyRanking, setReplyRanking] = useState(null);
  const [likeRanking, setLikeRanking] = useState(null);
  const [ronkyakuRanking, setRonkyakuRanking] = useState(null);
  const [replyExpanded, setReplyExpanded] = useState(false);
  const [likeExpanded, setLikeExpanded] = useState(false);
  const [ronkyakuExpanded, setRonkyakuExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user === null) router.push("/login");
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    loadTab(tab);
  }, [user, tab]);

  async function loadTab(t) {
    if (t === "reply" && replyRanking) return;
    if (t === "like" && likeRanking) return;
    if (t === "ronkyaku" && ronkyakuRanking) return;
    setLoading(true);
    const booksSnap = await getDocs(collection(db, "books"));
    const books = booksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (t === "reply") {
      // 本ごとのコメント数をタイトルで合算
      const titleMap = {};
      await Promise.all(books.map(async (book) => {
        const countSnap = await getCountFromServer(collection(db, "books", book.id, "comments"));
        const count = countSnap.data().count;
        if (!titleMap[book.title]) {
          titleMap[book.title] = { title: book.title, author: book.author || "", coverUrl: book.coverUrl || null, count: 0, appearances: 0 };
        }
        titleMap[book.title].count += count;
        titleMap[book.title].appearances += 1;
      }));
      const sorted = Object.values(titleMap).sort((a, b) => b.count - a.count);
      setReplyRanking(sorted);
    }

    if (t === "like") {
      // 全コメントからいいね数上位を収集
      const allComments = [];
      await Promise.all(books.map(async (book) => {
        const snap = await getDocs(query(collection(db, "books", book.id, "comments"), orderBy("likeCount", "desc")));
        snap.docs.forEach((d) => {
          const data = d.data();
          if ((data.likeCount || 0) > 0) {
            allComments.push({
              id: d.id,
              bookId: book.id,
              bookTitle: book.title,
              text: data.text || "",
              likeCount: data.likeCount || 0,
              userId: data.userId || null,
            });
          }
        });
      }));
      allComments.sort((a, b) => b.likeCount - a.likeCount);
      setLikeRanking(allComments);
    }

    if (t === "ronkyaku") {
      // 全コメントのlikeCountをuserId別に合算
      const userMap = {};
      await Promise.all(books.map(async (book) => {
        const snap = await getDocs(collection(db, "books", book.id, "comments"));
        snap.docs.forEach((d) => {
          const data = d.data();
          const uid = data.userId;
          if (!uid || !(data.likeCount > 0)) return;
          if (!userMap[uid]) userMap[uid] = { uid, totalLikes: 0 };
          userMap[uid].totalLikes += (data.likeCount || 0);
        });
      }));
      const sorted = Object.values(userMap).sort((a, b) => b.totalLikes - a.totalLikes);

      // プレミアムなら表示名を取得
      if (userData?.isPremium) {
        await Promise.all(sorted.slice(0, 30).map(async (r) => {
          const snap = await getDoc(doc(db, "users", r.uid));
          r.displayName = snap.exists() ? (snap.data().displayName || null) : null;
        }));
      }
      setRonkyakuRanking(sorted);
    }

    setLoading(false);
  }

  if (user === undefined) return null;

  const TABS = [
    { key: "reply", label: "レス数" },
    { key: "like", label: "いいね" },
    { key: "ronkyaku", label: "論客" },
  ];

  return (
    <>
      <style>{`
        .ranking-wrap { max-width:700px; margin:0 auto; padding:60px 40px; }
        @media(max-width:768px){ .ranking-wrap { padding:40px 20px; } }
        .ranking-heading { font-size:clamp(24px,3vw,36px); font-weight:900; color:var(--text); letter-spacing:-1px; margin-bottom:8px; }
        .ranking-sub { font-size:13px; color:var(--muted); margin-bottom:32px; }

        .rank-tabs { display:flex; border-bottom:1px solid var(--line); margin-bottom:28px; }
        .rank-tab { padding:10px 24px; font-size:13px; background:none; border:none; cursor:pointer; color:var(--muted); font-family:'Noto Sans JP',sans-serif; border-bottom:2px solid transparent; transition:all 0.15s; }
        .rank-tab.active { color:var(--text); font-weight:700; border-bottom-color:var(--text); }

        .ranking-list { display:flex; flex-direction:column; gap:2px; background:var(--line); }
        .ranking-row { background:white; padding:20px 24px; display:flex; align-items:center; gap:20px; }
        .rank-num { font-family:'DM Sans',sans-serif; font-size:28px; font-weight:700; color:var(--bg3); width:40px; flex-shrink:0; text-align:center; }
        .rank-num.top3 { color:var(--text); }
        .rank-body { flex:1; min-width:0; }
        .rank-main { font-size:15px; font-weight:600; color:var(--text); margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .rank-sub { font-size:12px; color:var(--muted); }
        .rank-score { text-align:right; flex-shrink:0; }
        .rank-score-num { font-family:'DM Sans',sans-serif; font-size:24px; font-weight:700; color:var(--red); display:block; }
        .rank-score-label { font-size:10px; color:var(--muted); letter-spacing:1px; }

        .more-btn { margin-top:16px; width:100%; padding:12px; background:none; border:1px solid var(--line); color:var(--muted); font-size:13px; cursor:pointer; font-family:'Noto Sans JP',sans-serif; transition:all 0.15s; }
        .more-btn:hover { border-color:var(--text); color:var(--text); }

        .premium-note { background:var(--bg2); border:1px solid var(--line); padding:16px 20px; margin-top:16px; font-size:12px; color:var(--muted); line-height:1.8; }
        .premium-note a { color:var(--text); font-weight:500; }
        .loading-state { text-align:center; padding:60px 20px; color:var(--muted); font-size:13px; letter-spacing:2px; }
        .empty-state { text-align:center; padding:60px 20px; color:var(--muted); font-size:13px; line-height:2; }
      `}</style>

      <AppNav />

      <div className="ranking-wrap">
        <h1 className="ranking-heading">ランキング</h1>
        <p className="ranking-sub">全期間・全スレ累計集計</p>

        <div className="rank-tabs">
          {TABS.map((t) => (
            <button key={t.key} className={`rank-tab${tab === t.key ? " active" : ""}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="loading-state">集計中</p>
        ) : tab === "reply" && replyRanking !== null ? (
          <>
            <div className="ranking-list">
              {(replyExpanded ? replyRanking.slice(0, 30) : replyRanking.slice(0, 10)).map((r, i) => (
                <div key={r.title} className="ranking-row">
                  <div className={`rank-num${i < 3 ? " top3" : ""}`}>{i + 1}</div>
                  <div className="rank-body">
                    <div className="rank-main">{r.title}</div>
                    <div className="rank-sub">{r.author}{r.appearances > 1 ? ` · ${r.appearances}回登場` : ""}</div>
                  </div>
                  <div className="rank-score">
                    <span className="rank-score-num">{r.count}</span>
                    <span className="rank-score-label">コメント</span>
                  </div>
                </div>
              ))}
            </div>
            {!replyExpanded && replyRanking.length > 10 && (
              <button className="more-btn" onClick={() => setReplyExpanded(true)}>もっと見る（{Math.min(replyRanking.length, 30)}件まで）</button>
            )}
          </>
        ) : tab === "like" && likeRanking !== null ? (
          <>
            <div className="ranking-list">
              {(likeExpanded ? likeRanking.slice(0, 30) : likeRanking.slice(0, 10)).map((r, i) => (
                <div key={`${r.bookId}-${r.id}`} className="ranking-row">
                  <div className={`rank-num${i < 3 ? " top3" : ""}`}>{i + 1}</div>
                  <div className="rank-body">
                    <div className="rank-main">{r.text.length > 60 ? r.text.slice(0, 60) + "…" : r.text}</div>
                    <div className="rank-sub">{r.bookTitle}</div>
                  </div>
                  <div className="rank-score">
                    <span className="rank-score-num">{r.likeCount}</span>
                    <span className="rank-score-label">いいね</span>
                  </div>
                </div>
              ))}
            </div>
            {likeRanking.length === 0 && <div className="empty-state">まだいいねデータがありません。</div>}
            {!likeExpanded && likeRanking.length > 10 && (
              <button className="more-btn" onClick={() => setLikeExpanded(true)}>もっと見る（{Math.min(likeRanking.length, 30)}件まで）</button>
            )}
          </>
        ) : tab === "ronkyaku" && ronkyakuRanking !== null ? (
          <>
            <div className="ranking-list">
              {(ronkyakuExpanded ? ronkyakuRanking.slice(0, 30) : ronkyakuRanking.slice(0, 10)).map((r, i) => (
                <div key={r.uid} className="ranking-row">
                  <div className={`rank-num${i < 3 ? " top3" : ""}`}>{i + 1}</div>
                  <div className="rank-body">
                    <div className="rank-main">
                      {userData?.isPremium ? (r.displayName || "名無し") : `論客 #${i + 1}`}
                      {r.uid === user.uid && <span style={{fontSize:"12px",color:"var(--blue)",marginLeft:8}}>（自分）</span>}
                    </div>
                  </div>
                  <div className="rank-score">
                    <span className="rank-score-num">{r.totalLikes}</span>
                    <span className="rank-score-label">いいね計</span>
                  </div>
                </div>
              ))}
            </div>
            {ronkyakuRanking.length === 0 && <div className="empty-state">まだデータがありません。</div>}
            {!ronkyakuExpanded && ronkyakuRanking.length > 10 && (
              <button className="more-btn" onClick={() => setRonkyakuExpanded(true)}>もっと見る（{Math.min(ronkyakuRanking.length, 30)}件まで）</button>
            )}
            {!userData?.isPremium && (
              <div className="premium-note">
                論客の正体を確認するには<a href="/premium">プレミアム会員</a>が必要です。
              </div>
            )}
          </>
        ) : null}
      </div>
    </>
  );
}

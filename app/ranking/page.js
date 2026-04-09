"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, query, orderBy, limit } from "firebase/firestore";
import AppNav from "@/components/AppNav";

export default function RankingPage() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user === null) router.push("/login");
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    async function fetchRanking() {
      const usersSnap = await getDocs(collection(db, "users"));
      const result = [];

      for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const targetsSnap = await getDocs(collection(db, "likes", uid, "targets"));
        if (targetsSnap.empty) continue;

        let totalLikes = 0;
        targetsSnap.docs.forEach((d) => { totalLikes += (d.data().count || 0); });

        if (totalLikes === 0) continue;

        let displayName = null;
        if (userData?.isPremium) {
          displayName = userDoc.data().displayName || null;
        }

        result.push({ uid, totalLikes, displayName });
      }

      result.sort((a, b) => b.totalLikes - a.totalLikes);
      setRanking(result.slice(0, 5));
      setLoading(false);
    }
    fetchRanking();
  }, [user, userData]);

  if (user === undefined) return null;

  return (
    <>
      <style>{`
        .ranking-wrap { max-width:700px; margin:0 auto; padding:60px 40px; }
        @media(max-width:768px){ .ranking-wrap { padding:40px 20px; } }
        .ranking-heading { font-size:clamp(24px,3vw,36px); font-weight:900; color:var(--text); letter-spacing:-1px; margin-bottom:8px; }
        .ranking-sub { font-size:13px; color:var(--muted); margin-bottom:48px; }

        .ranking-list { display:flex; flex-direction:column; gap:2px; background:var(--line); }
        .ranking-row {
          background:white; padding:24px 28px;
          display:flex; align-items:center; gap:24px;
        }
        .rank-num { font-family:'DM Sans',sans-serif; font-size:32px; font-weight:700; color:var(--bg3); width:48px; flex-shrink:0; }
        .rank-num.top { color:var(--text); }
        .rank-name { font-size:16px; color:var(--text); font-weight:500; flex:1; }
        .rank-count { font-family:'DM Sans',sans-serif; font-size:24px; font-weight:700; color:var(--red); }
        .rank-count-label { font-size:11px; color:var(--muted); margin-left:4px; }

        .premium-note {
          background:var(--bg2); border:1px solid var(--line); padding:20px 24px;
          margin-top:20px; font-size:13px; color:var(--muted); line-height:1.9;
        }
        .premium-note a { color:var(--text); font-weight:500; }

        .empty-state { text-align:center; padding:60px 20px; color:var(--muted); font-size:13px; line-height:2; }
      `}</style>

      <AppNav />

      <div className="ranking-wrap">
        <h1 className="ranking-heading">週間ランキング</h1>
        <p className="ranking-sub">受け取ったいいね数 TOP 5（匿名表示）</p>

        {loading ? (
          <p style={{fontSize:"13px",color:"var(--muted)",letterSpacing:"2px"}}>読み込み中</p>
        ) : ranking.length === 0 ? (
          <div className="empty-state">まだランキングデータがありません。<br />討論に参加していいねをもらいましょう。</div>
        ) : (
          <>
            <div className="ranking-list">
              {ranking.map((r, i) => (
                <div key={r.uid} className="ranking-row">
                  <div className={`rank-num${i < 3 ? " top" : ""}`}>{i + 1}</div>
                  <div className="rank-name">
                    {userData?.isPremium
                      ? (r.displayName || "名無し")
                      : `匿名${String.fromCharCode(65 + i)}`}
                    {r.uid === user.uid && <span style={{fontSize:"12px",color:"var(--blue)",marginLeft:8}}>（自分）</span>}
                  </div>
                  <div>
                    <span className="rank-count">{r.totalLikes}</span>
                    <span className="rank-count-label">いいね</span>
                  </div>
                </div>
              ))}
            </div>

            {!userData?.isPremium && (
              <div className="premium-note">
                正体を確認するには<a href="/premium">プレミアム会員</a>になる必要があります。
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

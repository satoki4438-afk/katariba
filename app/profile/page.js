"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import AppNav from "@/components/AppNav";

export default function ProfilePage() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const [likers, setLikers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user === null) router.push("/login");
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    async function fetchLikers() {
      const snap = await getDocs(collection(db, "likes"));
      const result = [];
      for (const fromDoc of snap.docs) {
        const fromUserId = fromDoc.id;
        if (fromUserId === user.uid) continue;
        const targetSnap = await getDoc(doc(db, "likes", fromUserId, "targets", user.uid));
        if (targetSnap.exists()) {
          const data = targetSnap.data();
          let displayName = null;
          if (userData?.isPremium) {
            const userSnap = await getDoc(doc(db, "users", fromUserId));
            displayName = userSnap.exists() ? userSnap.data().displayName : null;
          }
          result.push({
            fromUserId,
            count: data.count || 0,
            displayName,
          });
        }
      }
      result.sort((a, b) => b.count - a.count);
      setLikers(result);
      setLoading(false);
    }
    fetchLikers();
  }, [user, userData]);

  if (user === undefined) return null;

  const totalReceived = likers.reduce((s, l) => s + l.count, 0);

  return (
    <>
      <style>{`
        .profile-wrap { max-width:700px; margin:0 auto; padding:60px 40px; }
        @media(max-width:768px){ .profile-wrap { padding:40px 20px; } }
        .profile-heading { font-size:clamp(24px,3vw,36px); font-weight:900; color:var(--text); letter-spacing:-1px; margin-bottom:8px; }
        .profile-sub { font-size:13px; color:var(--muted); margin-bottom:48px; }

        .profile-stats { display:flex; gap:2px; background:var(--line); margin-bottom:48px; }
        .stat-card { background:var(--bg2); padding:28px 32px; flex:1; }
        .stat-label { font-size:10px; letter-spacing:2px; color:var(--muted); margin-bottom:8px; }
        .stat-value { font-family:'DM Sans',sans-serif; font-size:40px; font-weight:700; color:var(--text); letter-spacing:-1px; }

        .section-label { font-size:11px; font-weight:500; letter-spacing:3px; color:var(--muted); text-transform:uppercase; margin-bottom:20px; }
        .liker-list { display:flex; flex-direction:column; gap:2px; background:var(--line); }
        .liker-row {
          background:white; padding:20px 24px;
          display:flex; justify-content:space-between; align-items:center;
        }
        .liker-name { font-size:15px; color:var(--text); font-weight:500; }
        .liker-count { font-family:'DM Sans',sans-serif; font-size:22px; font-weight:700; color:var(--red); }
        .liker-count-label { font-size:11px; color:var(--muted); margin-left:4px; }

        .premium-gate {
          background:var(--bg2); border:1px solid var(--line); padding:24px 28px;
          margin-top:16px; font-size:13px; color:var(--muted); line-height:1.9;
        }
        .premium-gate strong { color:var(--text); }
        .premium-gate a { color:var(--text); font-weight:500; }

        .badge-section { margin-top:48px; }
        .badge-box {
          background:var(--bg2); border:1px solid var(--line); padding:24px 28px;
          display:flex; justify-content:space-between; align-items:center;
        }
        .badge-label { font-size:14px; color:var(--text); font-weight:500; }
        .badge-sub { font-size:12px; color:var(--muted); margin-top:4px; }
        .badge-progress { font-family:'DM Sans',sans-serif; font-size:13px; color:var(--muted); }
        .badge-achieved { font-size:13px; color:var(--red); font-weight:500; }
      `}</style>

      <AppNav />

      <div className="profile-wrap">
        <h1 className="profile-heading">プロフィール</h1>
        <p className="profile-sub">{userData?.displayName || "匿名ユーザー"}</p>

        <div className="profile-stats">
          <div className="stat-card">
            <div className="stat-label">受け取ったいいね</div>
            <div className="stat-value">{totalReceived}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">いいねをくれた人</div>
            <div className="stat-value">{likers.length}</div>
          </div>
        </div>

        <div className="section-label">あなたにいいねをくれた人</div>

        {loading ? (
          <p style={{fontSize:"13px",color:"var(--muted)",letterSpacing:"2px"}}>読み込み中</p>
        ) : likers.length === 0 ? (
          <p style={{fontSize:"13px",color:"var(--muted)",lineHeight:2}}>まだいいねはありません。討論に参加してみましょう。</p>
        ) : (
          <>
            <div className="liker-list">
              {likers.map((l, i) => (
                <div key={l.fromUserId} className="liker-row">
                  <div className="liker-name">
                    {userData?.isPremium
                      ? (l.displayName || "名無し")
                      : `匿名${String.fromCharCode(65 + (i % 26))}`}
                  </div>
                  <div>
                    <span className="liker-count">{l.count}</span>
                    <span className="liker-count-label">いいね</span>
                  </div>
                </div>
              ))}
            </div>

            {!userData?.isPremium && (
              <div className="premium-gate">
                <strong>正体開帳</strong>はプレミアム会員限定です。<br />
                <a href="/premium">プレミアムにアップグレード →</a>
              </div>
            )}
          </>
        )}

        <div className="badge-section">
          <div className="section-label" style={{marginTop:"0"}}>論客認定バッジ</div>
          <div className="badge-box">
            <div>
              <div className="badge-label">論客認定</div>
              <div className="badge-sub">受け取ったいいね合計 1,000 で認定</div>
            </div>
            {totalReceived >= 1000
              ? <div className="badge-achieved">認定済み</div>
              : <div className="badge-progress">{totalReceived} / 1,000</div>
            }
          </div>
        </div>
      </div>
    </>
  );
}

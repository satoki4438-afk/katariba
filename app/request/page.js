"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, query, orderBy, getDocs, addDoc,
  serverTimestamp, doc, updateDoc, increment, getDoc
} from "firebase/firestore";
import AppNav from "@/components/AppNav";

export default function RequestPage() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user === null) router.push("/login");
  }, [user, router]);

  async function fetchRequests() {
    const q = query(collection(db, "requests"), orderBy("count", "desc"));
    const snap = await getDocs(q);
    setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  useEffect(() => {
    if (!user) return;
    fetchRequests();
  }, [user]);

  async function handleSubmit() {
    if (!title.trim()) { setError("タイトルを入力してください"); return; }
    if (!userData?.isPremium) { setError("リクエスト投稿はプレミアム会員限定です"); return; }
    setPosting(true);
    setError("");

    const existing = requests.find(
      (r) => r.title.trim() === title.trim() && r.author.trim() === author.trim()
    );

    if (existing) {
      await updateDoc(doc(db, "requests", existing.id), { count: increment(1) });
    } else {
      await addDoc(collection(db, "requests"), {
        title: title.trim(),
        author: author.trim(),
        userId: user.uid,
        count: 1,
        used: false,
        createdAt: serverTimestamp(),
      });
    }

    setTitle("");
    setAuthor("");
    setPosting(false);
    fetchRequests();
  }

  async function handleVote(requestId) {
    if (!user) return;
    await updateDoc(doc(db, "requests", requestId), { count: increment(1) });
    fetchRequests();
  }

  if (user === undefined) return null;

  return (
    <>
      <style>{`
        .request-wrap { max-width:800px; margin:0 auto; padding:60px 40px; }
        @media(max-width:768px){ .request-wrap { padding:40px 20px; } }
        .request-heading { font-size:clamp(24px,3vw,36px); font-weight:900; color:var(--text); letter-spacing:-1px; margin-bottom:8px; }
        .request-sub { font-size:13px; color:var(--muted); margin-bottom:48px; line-height:1.9; }

        .request-form {
          background:var(--bg2); border:1px solid var(--line); padding:32px 28px; margin-bottom:48px;
        }
        .form-label { font-size:11px; font-weight:500; letter-spacing:2px; color:var(--muted); margin-bottom:8px; display:block; }
        .form-input {
          width:100%; border:1px solid var(--line); padding:12px 16px;
          font-size:14px; font-family:'Noto Sans JP',sans-serif; color:var(--text);
          background:white; outline:none; margin-bottom:16px;
        }
        .form-input:focus { border-color:var(--text); }
        .form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        @media(max-width:600px){ .form-row { grid-template-columns:1fr; } }
        .submit-btn {
          background:var(--text); color:white; border:none; padding:13px 32px;
          font-size:13px; font-weight:500; cursor:pointer; font-family:'Noto Sans JP',sans-serif;
          transition:opacity 0.2s; letter-spacing:0.5px;
        }
        .submit-btn:hover { opacity:0.75; }
        .submit-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .form-error { font-size:12px; color:var(--red); margin-top:8px; }
        .premium-gate-form {
          background:white; border:1px solid var(--line); padding:16px 20px;
          font-size:13px; color:var(--muted); line-height:1.8; margin-top:16px;
        }
        .premium-gate-form a { color:var(--text); font-weight:500; }

        .section-label { font-size:11px; font-weight:500; letter-spacing:3px; color:var(--muted); text-transform:uppercase; margin-bottom:20px; }
        .request-list { display:flex; flex-direction:column; gap:2px; background:var(--line); }
        .request-row {
          background:white; padding:20px 24px;
          display:flex; align-items:center; justify-content:space-between; gap:16px;
        }
        .request-info { flex:1; min-width:0; }
        .request-title { font-size:15px; font-weight:700; color:var(--text); margin-bottom:3px; }
        .request-author { font-size:12px; color:var(--muted); }
        .vote-btn {
          display:flex; flex-direction:column; align-items:center; gap:2px;
          background:none; border:1px solid var(--line); padding:8px 16px;
          cursor:pointer; font-family:'Noto Sans JP',sans-serif; transition:all 0.2s; flex-shrink:0;
        }
        .vote-btn:hover { border-color:var(--text); }
        .vote-count { font-family:'DM Sans',sans-serif; font-size:20px; font-weight:700; color:var(--text); }
        .vote-label { font-size:10px; color:var(--muted); letter-spacing:1px; }
        .used-badge { font-size:10px; color:var(--muted); background:var(--bg3); padding:2px 8px; }
      `}</style>

      <AppNav />

      <div className="request-wrap">
        <h1 className="request-heading">リクエスト</h1>
        <p className="request-sub">
          読みたい本をリクエストしてください。投票数1位の本が毎週自動で選ばれます。<br />
          同じ本へのリクエストは「+1」として集計されます。
        </p>

        <div className="request-form">
          <div className="form-row">
            <div>
              <label className="form-label">タイトル</label>
              <input
                className="form-input"
                placeholder="本のタイトル"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!userData?.isPremium}
              />
            </div>
            <div>
              <label className="form-label">著者名</label>
              <input
                className="form-input"
                placeholder="著者名（任意）"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                disabled={!userData?.isPremium}
              />
            </div>
          </div>
          <button className="submit-btn" onClick={handleSubmit} disabled={posting || !userData?.isPremium}>
            {posting ? "送信中..." : "リクエストする"}
          </button>
          {error && <p className="form-error">{error}</p>}
          {!userData?.isPremium && (
            <div className="premium-gate-form">
              リクエスト投稿は<a href="/premium">プレミアム会員</a>限定です。投票（+1）は全会員が可能です。
            </div>
          )}
        </div>

        <div className="section-label">投票ランキング</div>

        {loading ? (
          <p style={{fontSize:"13px",color:"var(--muted)",letterSpacing:"2px"}}>読み込み中</p>
        ) : requests.length === 0 ? (
          <p style={{fontSize:"13px",color:"var(--muted)"}}>まだリクエストはありません。</p>
        ) : (
          <div className="request-list">
            {requests.map((r) => (
              <div key={r.id} className="request-row">
                <div className="request-info">
                  <div className="request-title">
                    {r.title}
                    {r.used && <span className="used-badge" style={{marginLeft:8}}>選出済み</span>}
                  </div>
                  {r.author && <div className="request-author">{r.author}</div>}
                </div>
                <button className="vote-btn" onClick={() => handleVote(r.id)} disabled={r.used}>
                  <span className="vote-count">{r.count}</span>
                  <span className="vote-label">VOTE</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

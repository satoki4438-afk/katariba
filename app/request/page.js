"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, query, orderBy, getDocs, addDoc,
  serverTimestamp, doc, updateDoc, increment,
} from "firebase/firestore";
import AppNav from "@/components/AppNav";

const GENRES = ["SF", "恋愛", "ミステリー", "ファンタジー", "ラノベ", "歴史", "エッセイ", "ホラー", "純文学", "ノンフィクション", "その他"];

const EMPTY_FORM = { title: "", author: "", coverUrl: "", rakutenUrl: "", genre: "" };

export default function RequestPage() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const searchTimer = useRef(null);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [activeGenre, setActiveGenre] = useState("すべて");

  useEffect(() => {
    if (user === null) router.push("/login");
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    fetchRequests();
  }, [user]);

  async function fetchRequests() {
    const q = query(collection(db, "requests"), orderBy("count", "desc"));
    const snap = await getDocs(q);
    setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  function handleTitleChange(e) {
    const val = e.target.value;
    setForm((prev) => ({ ...prev, title: val, author: "", coverUrl: "", rakutenUrl: "" }));
    setSearchResults([]);
    clearTimeout(searchTimer.current);
    if (val.trim().length < 2) return;
    searchTimer.current = setTimeout(() => searchRakuten(val.trim()), 600);
  }

  async function searchRakuten(title) {
    setSearching(true);
    try {
      const res = await fetch(`/api/rakuten?title=${encodeURIComponent(title)}`);
      const data = await res.json();
      setSearchResults(data.items || []);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  }

  function applyResult(item) {
    setForm((prev) => ({
      ...prev,
      title: item.title,
      author: item.author || "",
      coverUrl: item.coverUrl || "",
      rakutenUrl: item.rakutenUrl || "",
    }));
    setSearchResults([]);
  }

  async function handleSubmit() {
    if (!form.title.trim()) { setError("タイトルを入力してください"); return; }
    if (!form.genre) { setError("ジャンルを選択してください"); return; }
    if (!userData?.isPremium) { setError("リクエスト投稿はプレミアム会員限定です"); return; }
    setPosting(true);
    setError("");

    const existing = requests.find((r) => r.title.trim() === form.title.trim());

    if (existing) {
      await updateDoc(doc(db, "requests", existing.id), { count: increment(1) });
    } else {
      await addDoc(collection(db, "requests"), {
        title: form.title.trim(),
        author: form.author.trim(),
        genre: form.genre,
        coverUrl: form.coverUrl || null,
        rakutenUrl: form.rakutenUrl || null,
        userId: user.uid,
        count: 1,
        used: false,
        createdAt: serverTimestamp(),
      });
    }

    setForm(EMPTY_FORM);
    setSearchResults([]);
    setPosting(false);
    fetchRequests();
  }

  async function handleVote(r) {
    if (!user) return;
    await updateDoc(doc(db, "requests", r.id), { count: increment(1) });
    fetchRequests();
  }

  if (user === undefined) return null;

  const filtered = activeGenre === "すべて"
    ? requests
    : requests.filter((r) => r.genre === activeGenre);

  return (
    <>
      <style>{`
        .req-wrap { max-width:800px; margin:0 auto; padding:60px 40px; }
        @media(max-width:768px){ .req-wrap { padding:40px 16px; } }
        .req-heading { font-size:clamp(24px,3vw,36px); font-weight:900; color:var(--text); letter-spacing:-1px; margin-bottom:8px; }
        .req-sub { font-size:13px; color:var(--muted); margin-bottom:48px; line-height:1.9; }

        .req-form { background:var(--bg2); border:1px solid var(--line); padding:32px 28px; margin-bottom:48px; }
        .req-form-label { font-size:11px; font-weight:500; letter-spacing:2px; color:var(--muted); margin-bottom:8px; display:block; }

        .req-search-wrap { position:relative; margin-bottom:16px; }
        .req-input {
          width:100%; border:1px solid var(--line); padding:12px 16px;
          font-size:14px; font-family:'Noto Sans JP',sans-serif; color:var(--text);
          background:white; outline:none; box-sizing:border-box;
        }
        .req-input:focus { border-color:var(--text); }
        .req-input:disabled { background:var(--bg3); color:var(--muted); }

        .req-search-results {
          position:absolute; top:100%; left:0; right:0; z-index:20;
          background:white; border:1px solid var(--text); border-top:none;
          max-height:280px; overflow-y:auto;
        }
        .req-search-item {
          display:flex; gap:12px; align-items:center;
          padding:12px 14px; cursor:pointer; border-bottom:1px solid var(--line);
          transition:background 0.15s;
        }
        .req-search-item:last-child { border-bottom:none; }
        .req-search-item:hover { background:var(--bg2); }
        .req-search-cover { width:36px; height:48px; object-fit:cover; flex-shrink:0; }
        .req-search-cover-empty { width:36px; height:48px; background:var(--bg3); flex-shrink:0; }
        .req-search-title { font-size:13px; font-weight:500; color:var(--text); line-height:1.4; }
        .req-search-author { font-size:11px; color:var(--muted); margin-top:2px; }
        .req-search-note { padding:12px 14px; font-size:12px; color:var(--muted); }

        .req-preview { display:flex; gap:16px; align-items:center; margin-bottom:16px; }
        .req-preview-cover { width:52px; height:70px; object-fit:cover; border:1px solid var(--line); flex-shrink:0; }
        .req-preview-title { font-size:14px; font-weight:700; color:var(--text); }
        .req-preview-author { font-size:12px; color:var(--muted); margin-top:3px; }

        .req-genre-wrap { margin-bottom:20px; }
        .req-genre-choices { display:flex; flex-wrap:wrap; gap:6px; }
        .req-genre-btn {
          font-size:12px; padding:6px 14px; background:white; color:var(--muted);
          border:1px solid var(--line); cursor:pointer;
          font-family:'Noto Sans JP',sans-serif; transition:all 0.15s;
        }
        .req-genre-btn:hover { border-color:var(--text); color:var(--text); }
        .req-genre-btn.on { background:var(--text); color:white; border-color:var(--text); }
        .req-genre-btn:disabled { opacity:0.4; cursor:not-allowed; }

        .req-submit {
          background:var(--text); color:white; border:none; padding:13px 32px;
          font-size:13px; font-weight:500; cursor:pointer; font-family:'Noto Sans JP',sans-serif;
          transition:opacity 0.2s; letter-spacing:0.5px;
        }
        .req-submit:hover { opacity:0.75; }
        .req-submit:disabled { opacity:0.4; cursor:not-allowed; }
        .req-error { font-size:12px; color:var(--red); margin-top:8px; }
        .req-gate {
          background:white; border:1px solid var(--line); padding:16px 20px;
          font-size:13px; color:var(--muted); line-height:1.8; margin-top:16px;
        }
        .req-gate a { color:var(--text); font-weight:500; }

        .req-list-header { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:0; }
        .req-list-label { font-size:11px; font-weight:500; letter-spacing:3px; color:var(--muted); text-transform:uppercase; }
        .req-genre-tabs { display:flex; flex-wrap:wrap; gap:0; border-bottom:1px solid var(--line); margin-bottom:20px; margin-top:16px; }
        .req-genre-tab {
          font-size:12px; padding:8px 14px; background:none; border:none;
          cursor:pointer; color:var(--muted); font-family:'Noto Sans JP',sans-serif;
          border-bottom:2px solid transparent; margin-bottom:-1px; transition:all 0.15s; white-space:nowrap;
        }
        .req-genre-tab:hover { color:var(--text); }
        .req-genre-tab.active { color:var(--text); font-weight:700; border-bottom-color:var(--text); }

        .req-list { display:flex; flex-direction:column; gap:2px; background:var(--line); }
        .req-row {
          background:white; padding:18px 24px;
          display:flex; align-items:center; gap:16px;
        }
        .req-row-cover { width:40px; height:54px; object-fit:cover; flex-shrink:0; border:1px solid var(--line); }
        .req-row-cover-empty { width:40px; height:54px; background:var(--bg3); flex-shrink:0; }
        .req-row-info { flex:1; min-width:0; }
        .req-row-title { font-size:15px; font-weight:700; color:var(--text); margin-bottom:3px; }
        .req-row-meta { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .req-row-author { font-size:12px; color:var(--muted); }
        .req-row-genre { font-size:10px; letter-spacing:1px; color:var(--muted); background:var(--bg3); padding:2px 8px; }
        .req-used { font-size:10px; color:var(--muted); background:var(--bg3); padding:2px 8px; }
        .req-vote {
          display:flex; flex-direction:column; align-items:center; gap:2px;
          background:none; border:1px solid var(--line); padding:8px 16px;
          cursor:pointer; font-family:'Noto Sans JP',sans-serif; transition:all 0.2s; flex-shrink:0;
        }
        .req-vote:hover:not(:disabled) { border-color:var(--text); }
        .req-vote:disabled { cursor:default; opacity:0.5; }
        .req-vote-count { font-family:'DM Sans',sans-serif; font-size:20px; font-weight:700; color:var(--text); }
        .req-vote-label { font-size:10px; color:var(--muted); letter-spacing:1px; }
      `}</style>

      <AppNav />

      <div className="req-wrap">
        <h1 className="req-heading">リクエスト</h1>
        <p className="req-sub">
          読みたい本をリクエストしてください。投票数1位の本が毎週自動で選ばれます。<br />
          同じ本へのリクエストは「+1」として集計されます。
        </p>

        <div className="req-form">
          <label className="req-form-label">本を検索して選択</label>
          <div className="req-search-wrap">
            <input
              className="req-input"
              placeholder="タイトルを入力して検索..."
              value={form.title}
              onChange={handleTitleChange}
              disabled={!userData?.isPremium}
              autoComplete="off"
            />
            {(searchResults.length > 0 || searching) && (
              <div className="req-search-results">
                {searching && <div className="req-search-note">検索中...</div>}
                {searchResults.map((item, i) => (
                  <div key={i} className="req-search-item" onClick={() => applyResult(item)}>
                    {item.coverUrl
                      ? <img src={item.coverUrl} alt={item.title} className="req-search-cover" />
                      : <div className="req-search-cover-empty" />
                    }
                    <div>
                      <div className="req-search-title">{item.title}</div>
                      {item.author && <div className="req-search-author">{item.author}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {form.title && !searching && searchResults.length === 0 && (
            <div className="req-preview">
              {form.coverUrl
                ? <img src={form.coverUrl} alt={form.title} className="req-preview-cover" />
                : <div style={{width:52,height:70,background:"var(--bg3)",flexShrink:0}} />
              }
              <div>
                <div className="req-preview-title">{form.title}</div>
                {form.author && <div className="req-preview-author">{form.author}</div>}
              </div>
            </div>
          )}

          <label className="req-form-label" style={{marginBottom:10}}>ジャンル</label>
          <div className="req-genre-wrap">
            <div className="req-genre-choices">
              {GENRES.map((g) => (
                <button
                  key={g}
                  className={`req-genre-btn${form.genre === g ? " on" : ""}`}
                  onClick={() => setForm((prev) => ({ ...prev, genre: g }))}
                  disabled={!userData?.isPremium}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <button className="req-submit" onClick={handleSubmit} disabled={posting || !userData?.isPremium || !form.title.trim()}>
            {posting ? "送信中..." : "リクエストする"}
          </button>
          {error && <p className="req-error">{error}</p>}
          {!userData?.isPremium && (
            <div className="req-gate">
              リクエスト投稿は<a href="/premium">プレミアム会員</a>限定です。投票（+1）は全会員が可能です。
            </div>
          )}
        </div>

        <div className="req-list-label">投票ランキング</div>
        <div className="req-genre-tabs">
          {["すべて", ...GENRES].map((g) => (
            <button
              key={g}
              className={`req-genre-tab${activeGenre === g ? " active" : ""}`}
              onClick={() => setActiveGenre(g)}
            >
              {g}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{fontSize:"13px",color:"var(--muted)",letterSpacing:"2px"}}>読み込み中</p>
        ) : filtered.length === 0 ? (
          <p style={{fontSize:"13px",color:"var(--muted)"}}>
            {activeGenre === "すべて" ? "まだリクエストはありません。" : `${activeGenre}のリクエストはまだありません。`}
          </p>
        ) : (
          <div className="req-list">
            {filtered.map((r) => (
              <div key={r.id} className="req-row">
                {r.coverUrl
                  ? <img src={r.coverUrl} alt={r.title} className="req-row-cover" />
                  : <div className="req-row-cover-empty" />
                }
                <div className="req-row-info">
                  <div className="req-row-title">
                    {r.title}
                    {r.used && <span className="req-used" style={{marginLeft:8}}>選出済み</span>}
                  </div>
                  <div className="req-row-meta">
                    {r.author && <span className="req-row-author">{r.author}</span>}
                    {r.genre && <span className="req-row-genre">{r.genre}</span>}
                  </div>
                </div>
                <button className="req-vote" onClick={() => handleVote(r)} disabled={!!r.used}>
                  <span className="req-vote-count">{r.count}</span>
                  <span className="req-vote-label">VOTE</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

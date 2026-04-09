"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, query, orderBy, getDocs, addDoc, updateDoc,
  doc, serverTimestamp, deleteDoc
} from "firebase/firestore";

const ADMIN_EMAILS = ["tas.studio2026@gmail.com", "satoki4438@gmail.com"];

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [books, setBooks] = useState([]);
  const [featuredCandidates, setFeaturedCandidates] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [schedulerRunning, setSchedulerRunning] = useState(false);
  const [schedulerResult, setSchedulerResult] = useState("");

  const [newBook, setNewBook] = useState({ title: "", author: "", rakutenUrl: "", coverUrl: "" });
  const [addingBook, setAddingBook] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef(null);

  useEffect(() => {
    if (user === null) { router.push("/login"); return; }
    if (user && !ADMIN_EMAILS.includes(user.email)) { router.push("/home"); return; }
  }, [user, router]);

  useEffect(() => {
    if (!user || !ADMIN_EMAILS.includes(user.email)) return;
    fetchBooks();
  }, [user]);

  async function fetchBooks() {
    const snap = await getDocs(query(collection(db, "books"), orderBy("createdAt", "desc")));
    setBooks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  function handleTitleChange(e) {
    const val = e.target.value;
    setNewBook((prev) => ({ ...prev, title: val }));
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
    setNewBook({
      title: item.title,
      author: item.author,
      rakutenUrl: item.rakutenUrl || "",
      coverUrl: item.coverUrl || "",
    });
    setSearchResults([]);
  }

  async function handleAddBook() {
    if (!newBook.title.trim()) return;
    setAddingBook(true);
    await addDoc(collection(db, "books"), {
      title: newBook.title.trim(),
      author: newBook.author.trim(),
      rakutenUrl: newBook.rakutenUrl.trim() || null,
      coverUrl: newBook.coverUrl.trim() || null,
      status: "reading",
      week: 1,
      source: "manual",
      createdAt: serverTimestamp(),
    });
    setNewBook({ title: "", author: "", rakutenUrl: "", coverUrl: "" });
    setAddingBook(false);
    fetchBooks();
  }

  async function fetchComments(bookId) {
    setSelectedBookId(bookId);
    const snap = await getDocs(
      query(collection(db, "books", bookId, "comments"), orderBy("likeCount", "desc"))
    );
    setFeaturedCandidates(snap.docs.map((d) => ({ id: d.id, ...d.data() })).slice(0, 20));
  }

  async function toggleFeatured(bookId, commentId, current) {
    await updateDoc(doc(db, "books", bookId, "comments", commentId), { featured: !current });
    fetchComments(bookId);
  }

  async function handleRunScheduler() {
    setSchedulerRunning(true);
    setSchedulerResult("");
    try {
      const res = await fetch("https://runweeklyschedulermanual-4m65hweeqa-an.a.run.app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      setSchedulerResult(data.success ? "実行完了" : `エラー: ${data.error}`);
      fetchBooks();
    } catch (e) {
      setSchedulerResult(`エラー: ${e.message}`);
    }
    setSchedulerRunning(false);
  }

  async function handleStatusChange(bookId, status) {
    await updateDoc(doc(db, "books", bookId), { status });
    fetchBooks();
  }

  async function handleDeleteBook(bookId, title) {
    if (!window.confirm(`「${title}」を削除しますか？`)) return;
    await deleteDoc(doc(db, "books", bookId));
    if (selectedBookId === bookId) { setSelectedBookId(""); setFeaturedCandidates([]); }
    fetchBooks();
  }

  if (user === undefined) return null;
  if (user && !ADMIN_EMAILS.includes(user.email)) return null;

  return (
    <>
      <style>{`
        .admin-wrap { max-width:1000px; margin:0 auto; padding:40px; }
        @media(max-width:768px){ .admin-wrap { padding:20px; } }
        .admin-heading { font-size:28px; font-weight:900; color:var(--text); letter-spacing:-1px; margin-bottom:4px; }
        .admin-sub { font-size:12px; color:var(--muted); letter-spacing:2px; margin-bottom:48px; }

        .admin-section { margin-bottom:56px; }
        .section-title { font-size:11px; font-weight:500; letter-spacing:3px; color:var(--muted); text-transform:uppercase; margin-bottom:20px; padding-bottom:12px; border-bottom:1px solid var(--line); }

        .scheduler-box { background:var(--bg2); border:1px solid var(--line); padding:28px 32px; display:flex; align-items:center; justify-content:space-between; gap:20px; flex-wrap:wrap; }
        .scheduler-desc { font-size:13px; color:var(--muted); line-height:1.9; }
        .scheduler-desc strong { color:var(--text); }
        .run-btn { background:var(--text); color:white; border:none; padding:12px 28px; font-size:13px; font-weight:500; cursor:pointer; font-family:'Noto Sans JP',sans-serif; transition:opacity 0.2s; letter-spacing:0.5px; white-space:nowrap; }
        .run-btn:hover { opacity:0.75; }
        .run-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .scheduler-result { font-size:13px; margin-top:12px; color:var(--text); }

        .add-book-form { background:var(--bg2); border:1px solid var(--line); padding:28px 32px; }
        .form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; }
        @media(max-width:600px){ .form-row { grid-template-columns:1fr; } }
        .form-field { position:relative; }
        .form-input { width:100%; border:1px solid var(--line); padding:11px 14px; font-size:13px; font-family:'Noto Sans JP',sans-serif; color:var(--text); background:white; outline:none; }
        .form-input:focus { border-color:var(--text); }
        .form-label { font-size:10px; letter-spacing:2px; color:var(--muted); display:block; margin-bottom:6px; }
        .form-hint { font-size:11px; color:var(--muted); margin-top:4px; }

        .search-results {
          position:absolute; top:100%; left:0; right:0; z-index:10;
          background:white; border:1px solid var(--text); border-top:none;
          max-height:280px; overflow-y:auto;
        }
        .search-item {
          display:flex; gap:12px; align-items:center; padding:12px 14px;
          cursor:pointer; border-bottom:1px solid var(--line); transition:background 0.15s;
        }
        .search-item:last-child { border-bottom:none; }
        .search-item:hover { background:var(--bg2); }
        .search-cover { width:36px; height:48px; object-fit:cover; flex-shrink:0; background:var(--bg3); }
        .search-cover-empty { width:36px; height:48px; background:var(--bg3); flex-shrink:0; }
        .search-item-title { font-size:13px; font-weight:500; color:var(--text); line-height:1.4; }
        .search-item-author { font-size:11px; color:var(--muted); margin-top:2px; }
        .searching-note { padding:12px 14px; font-size:12px; color:var(--muted); }

        .preview-cover { width:60px; height:80px; object-fit:cover; border:1px solid var(--line); margin-top:8px; }

        .add-btn { background:var(--text); color:white; border:none; padding:11px 28px; font-size:13px; font-weight:500; cursor:pointer; font-family:'Noto Sans JP',sans-serif; transition:opacity 0.2s; }
        .add-btn:hover { opacity:0.75; }
        .add-btn:disabled { opacity:0.4; cursor:not-allowed; }

        .books-table { width:100%; background:var(--line); display:flex; flex-direction:column; }
        .books-row { background:white; padding:16px 20px; display:grid; grid-template-columns:1fr auto auto auto; gap:16px; align-items:center; }
        .books-row:hover { background:var(--bg2); }
        .book-row-title { font-size:14px; font-weight:500; color:var(--text); }
        .book-row-author { font-size:12px; color:var(--muted); }
        .status-select { border:1px solid var(--line); padding:6px 10px; font-size:12px; font-family:'Noto Sans JP',sans-serif; color:var(--text); background:white; outline:none; cursor:pointer; }
        .pick-btn { font-size:12px; color:var(--blue); background:none; border:none; cursor:pointer; font-family:'Noto Sans JP',sans-serif; white-space:nowrap; }
        .pick-btn:hover { text-decoration:underline; }
        .delete-btn { font-size:12px; color:var(--red); background:none; border:none; cursor:pointer; font-family:'Noto Sans JP',sans-serif; white-space:nowrap; }
        .delete-btn:hover { text-decoration:underline; }

        .featured-panel { background:var(--bg2); border:1px solid var(--line); padding:24px 28px; margin-top:16px; }
        .featured-panel-title { font-size:12px; font-weight:500; color:var(--text); margin-bottom:16px; }
        .comment-row { background:white; padding:14px 16px; margin-bottom:2px; display:flex; gap:12px; align-items:flex-start; }
        .comment-row-text { font-size:13px; color:var(--text); line-height:1.8; flex:1; }
        .comment-row-likes { font-size:12px; color:var(--red); font-weight:500; flex-shrink:0; min-width:48px; }
        .feature-toggle { font-size:11px; border:none; padding:5px 12px; cursor:pointer; font-family:'Noto Sans JP',sans-serif; white-space:nowrap; flex-shrink:0; }
        .feature-toggle.on { background:var(--red); color:white; }
        .feature-toggle.off { background:var(--bg3); color:var(--muted); }
      `}</style>

      <div style={{borderBottom:"1px solid var(--line)",padding:"16px 40px",display:"flex",alignItems:"center",gap:24,background:"white"}}>
        <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:"18px",fontWeight:900,color:"var(--text)"}}>カタリバ</span>
        <span style={{fontSize:"11px",letterSpacing:"3px",color:"var(--muted)"}}>ADMIN</span>
      </div>

      <div className="admin-wrap">
        <h1 className="admin-heading">管理画面</h1>
        <p className="admin-sub">OPERATOR CONSOLE</p>

        <div className="admin-section">
          <div className="section-title">週次スケジューラー</div>
          <div className="scheduler-box">
            <div className="scheduler-desc">
              <strong>手動実行</strong>：通常は毎週土曜9時(JST)に自動実行されます。<br />
              実行すると：reading→open→closed のステータス更新と新作2冊の追加が行われます。
            </div>
            <button className="run-btn" onClick={handleRunScheduler} disabled={schedulerRunning}>
              {schedulerRunning ? "実行中..." : "今すぐ実行"}
            </button>
          </div>
          {schedulerResult && <p className="scheduler-result">{schedulerResult}</p>}
        </div>

        <div className="admin-section">
          <div className="section-title">本を手動追加</div>
          <div className="add-book-form">
            <div className="form-row">
              <div className="form-field">
                <label className="form-label">タイトル *</label>
                <input
                  className="form-input"
                  placeholder="タイトルを入力すると楽天から自動検索"
                  value={newBook.title}
                  onChange={handleTitleChange}
                  autoComplete="off"
                />
                {searching && <div className="search-results"><div className="searching-note">検索中...</div></div>}
                {!searching && searchResults.length > 0 && (
                  <div className="search-results">
                    {searchResults.map((item, i) => (
                      <div key={i} className="search-item" onClick={() => applyResult(item)}>
                        {item.coverUrl
                          ? <img src={item.coverUrl} alt="" className="search-cover" />
                          : <div className="search-cover-empty" />
                        }
                        <div>
                          <div className="search-item-title">{item.title}</div>
                          <div className="search-item-author">{item.author}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="form-hint">2文字以上で楽天ブックスを自動検索します</div>
              </div>
              <div>
                <label className="form-label">著者名</label>
                <input
                  className="form-input"
                  placeholder="自動入力 or 手動入力"
                  value={newBook.author}
                  onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
                />
              </div>
            </div>
            <div className="form-row" style={{marginBottom:20}}>
              <div>
                <label className="form-label">楽天URL（アフィリエイト付き）</label>
                <input
                  className="form-input"
                  placeholder="自動入力 or 手動入力"
                  value={newBook.rakutenUrl}
                  onChange={(e) => setNewBook({ ...newBook, rakutenUrl: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">表紙画像URL</label>
                <input
                  className="form-input"
                  placeholder="自動入力 or 手動入力"
                  value={newBook.coverUrl}
                  onChange={(e) => setNewBook({ ...newBook, coverUrl: e.target.value })}
                />
                {newBook.coverUrl && (
                  <img src={newBook.coverUrl} alt="表紙プレビュー" className="preview-cover" />
                )}
              </div>
            </div>
            <button className="add-btn" onClick={handleAddBook} disabled={addingBook || !newBook.title.trim()}>
              {addingBook ? "追加中..." : "追加する"}
            </button>
          </div>
        </div>

        <div className="admin-section">
          <div className="section-title">本一覧・ステータス管理</div>
          <div className="books-table">
            {books.map((book) => (
              <div key={book.id} className="books-row">
                <div>
                  <div className="book-row-title">{book.title}</div>
                  <div className="book-row-author">{book.author} · Week {book.week}</div>
                </div>
                <select className="status-select" value={book.status} onChange={(e) => handleStatusChange(book.id, e.target.value)}>
                  <option value="reading">reading</option>
                  <option value="open">open</option>
                  <option value="closed">closed</option>
                </select>
                <button className="pick-btn" onClick={() => fetchComments(book.id)}>注目コメント</button>
                <button className="delete-btn" onClick={() => handleDeleteBook(book.id, book.title)}>削除</button>
              </div>
            ))}
          </div>

          {selectedBookId && featuredCandidates.length > 0 && (
            <div className="featured-panel">
              <div className="featured-panel-title">注目コメントを選ぶ（いいね順 上位20件）</div>
              {featuredCandidates.map((c) => (
                <div key={c.id} className="comment-row">
                  <div className="comment-row-likes">{c.likeCount || 0} いいね</div>
                  <div className="comment-row-text">{c.text}</div>
                  <button
                    className={`feature-toggle ${c.featured ? "on" : "off"}`}
                    onClick={() => toggleFeatured(selectedBookId, c.id, c.featured)}
                  >
                    {c.featured ? "注目中" : "選ぶ"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

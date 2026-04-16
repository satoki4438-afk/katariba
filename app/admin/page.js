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
const GENRES = ["SF","恋愛","ミステリー","サスペンス","ファンタジー","ラノベ","歴史","ホラー","純文学","ノンフィクション","その他"];

function generateSlug(title, date) {
  const d = date instanceof Date ? date : (date?.toDate ? date.toDate() : new Date());
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const sanitized = title
    .replace(/[　\s]+/g, "-")
    .replace(/[『』「」【】（）()。、・…！？!?〜～―—\/\\|]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  return `${sanitized}-${yyyy}-${mm}`;
}

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [books, setBooks] = useState([]);
  const [featuredCandidates, setFeaturedCandidates] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [schedulerRunning, setSchedulerRunning] = useState(false);
  const [schedulerResult, setSchedulerResult] = useState("");

  const [newBook, setNewBook] = useState({ title: "", author: "", rakutenUrl: "", coverUrl: "", genre: "", description: "", slug: "" });
  const [addingBook, setAddingBook] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef(null);

  const [editingBook, setEditingBook] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [bookTab, setBookTab] = useState("active"); // "active" | "archived"

  useEffect(() => {
    if (user === null) { router.push("/login"); return; }
    if (user && !ADMIN_EMAILS.includes(user.email)) { router.push("/home"); return; }
  }, [user, router]);

  useEffect(() => {
    if (!user || !ADMIN_EMAILS.includes(user.email)) return;
    fetchBooks();
  }, [user]);

  async function fetchBooks() {
    const snap = await getDocs(query(collection(db, "threads"), orderBy("created_at", "desc")));
    setBooks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  function handleTitleChange(e) {
    const val = e.target.value;
    setNewBook((prev) => ({ ...prev, title: val }));
    setSearchResults([]);
    clearTimeout(searchTimer.current);
    if (val.trim().length < 2) return;
    searchTimer.current = setTimeout(() => searchBooks(val.trim()), 600);
  }

  async function searchBooks(title) {
    setSearching(true);
    try {
      const res = await fetch(`/api/rakuten?title=${encodeURIComponent(title)}`);
      const data = await res.json();
      if (data.error) console.error("[search]", data.error, data);
      setSearchResults(data.items || []);
    } catch (e) {
      console.error("[search]", e);
      setSearchResults([]);
    }
    setSearching(false);
  }

  function applyResult(item) {
    setNewBook((prev) => ({
      ...prev,
      title: item.title,
      author: item.author,
      rakutenUrl: item.rakutenUrl || "",
      coverUrl: item.coverUrl || "",
      description: item.description || "",
      slug: generateSlug(item.title, new Date()),
    }));
    setSearchResults([]);
  }

  async function handleAddBook() {
    if (!newBook.title.trim()) return;
    setAddingBook(true);
    const slug = newBook.slug.trim() || generateSlug(newBook.title.trim(), new Date());
    await addDoc(collection(db, "threads"), {
      title: newBook.title.trim(),
      author: newBook.author.trim(),
      rakutenUrl: newBook.rakutenUrl.trim() || null,
      coverUrl: newBook.coverUrl.trim() || null,
      genre: newBook.genre || null,
      description: newBook.description.trim() || null,
      slug,
      status: "week1",
      week: 1,
      source: "manual",
      created_at: serverTimestamp(),
      likes_count: 0,
      reply_count: 0,
      score: 0,
      visible: false,
    });
    setNewBook({ title: "", author: "", rakutenUrl: "", coverUrl: "", genre: "", description: "", slug: "" });
    setAddingBook(false);
    fetchBooks();
  }

  function handleStartEdit(book) {
    if (editingBook?.id === book.id) { setEditingBook(null); return; }
    setEditingBook({
      id: book.id,
      title: book.title || "",
      author: book.author || "",
      description: book.description || "",
      coverUrl: book.coverUrl || "",
      rakutenUrl: book.rakutenUrl || "",
      genre: book.genre || "",
      slug: book.slug || generateSlug(book.title || "", book.createdAt || new Date()),
    });
  }

  async function handleSaveEdit() {
    if (!editingBook) return;
    setSavingEdit(true);
    await updateDoc(doc(db, "threads", editingBook.id), {
      title: editingBook.title.trim(),
      author: editingBook.author.trim(),
      description: editingBook.description.trim() || null,
      coverUrl: editingBook.coverUrl.trim() || null,
      rakutenUrl: editingBook.rakutenUrl.trim() || null,
      genre: editingBook.genre || null,
      slug: editingBook.slug.trim() || null,
    });
    setSavingEdit(false);
    setEditingBook(null);
    fetchBooks();
  }

  async function fetchComments(bookId) {
    setSelectedBookId(bookId);
    const snap = await getDocs(
      query(collection(db, "threads", bookId, "comments"), orderBy("likeCount", "desc"))
    );
    setFeaturedCandidates(snap.docs.map((d) => ({ id: d.id, ...d.data() })).slice(0, 20));
  }

  async function toggleFeatured(bookId, commentId, current) {
    await updateDoc(doc(db, "threads", bookId, "comments", commentId), { featured: !current });
    fetchComments(bookId);
  }

  const [slugging, setSluggin] = useState(false);
  const [slugResult, setSlugResult] = useState("");

  async function handleBulkSlug() {
    if (!window.confirm("スラグが未設定の本に一括でスラグを付与します。よろしいですか？")) return;
    setSluggin(true);
    setSlugResult("");
    const snap = await getDocs(collection(db, "threads"));
    const targets = snap.docs.filter((d) => !d.data().slug);
    let count = 0;
    for (const d of targets) {
      const data = d.data();
      const slug = generateSlug(data.title || "", data.created_at || new Date());
      await updateDoc(doc(db, "threads", d.id), { slug });
      count++;
    }
    setSlugResult(`完了：${count}件にスラグを付与しました`);
    setSluggin(false);
    fetchBooks();
  }

  async function handleRunScheduler() {
    setSchedulerRunning(true);
    setSchedulerResult("");
    try {
      const res = await fetch("https://runweeklyschedulermanual-4m65hweeqa-an.a.run.app", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Secret": process.env.NEXT_PUBLIC_ADMIN_SECRET || "" },
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
    await updateDoc(doc(db, "threads", bookId), { status });
    fetchBooks();
  }

  async function handleDeleteBook(bookId, title) {
    if (!window.confirm(`「${title}」を削除しますか？`)) return;
    await deleteDoc(doc(db, "threads", bookId));
    if (selectedBookId === bookId) { setSelectedBookId(""); setFeaturedCandidates([]); }
    if (editingBook?.id === bookId) setEditingBook(null);
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
        .form-input { width:100%; border:1px solid var(--line); padding:11px 14px; font-size:13px; font-family:'Noto Sans JP',sans-serif; color:var(--text); background:white; outline:none; box-sizing:border-box; }
        .form-input:focus { border-color:var(--text); }
        .form-label { font-size:10px; letter-spacing:2px; color:var(--muted); display:block; margin-bottom:6px; }
        .form-hint { font-size:11px; color:var(--muted); margin-top:4px; }

        .search-results { position:absolute; top:100%; left:0; right:0; z-index:10; background:white; border:1px solid var(--text); border-top:none; max-height:280px; overflow-y:auto; }
        .search-item { display:flex; gap:12px; align-items:center; padding:12px 14px; cursor:pointer; border-bottom:1px solid var(--line); transition:background 0.15s; }
        .search-item:last-child { border-bottom:none; }
        .search-item:hover { background:var(--bg2); }
        .search-cover { width:36px; height:48px; object-fit:cover; flex-shrink:0; }
        .search-cover-empty { width:36px; height:48px; background:var(--bg3); flex-shrink:0; }
        .search-item-title { font-size:13px; font-weight:500; color:var(--text); line-height:1.4; }
        .search-item-author { font-size:11px; color:var(--muted); margin-top:2px; }
        .searching-note { padding:12px 14px; font-size:12px; color:var(--muted); }
        .preview-cover { width:60px; height:80px; object-fit:cover; border:1px solid var(--line); margin-top:8px; }

        .add-btn { background:var(--text); color:white; border:none; padding:11px 28px; font-size:13px; font-weight:500; cursor:pointer; font-family:'Noto Sans JP',sans-serif; transition:opacity 0.2s; }
        .add-btn:hover { opacity:0.75; }
        .add-btn:disabled { opacity:0.4; cursor:not-allowed; }

        .books-table { width:100%; background:var(--line); display:flex; flex-direction:column; }
        .books-row { background:white; padding:16px 20px; display:grid; grid-template-columns:1fr auto auto auto auto; gap:12px; align-items:center; }
        .books-row:hover { background:var(--bg2); }
        .book-row-title { font-size:14px; font-weight:500; color:var(--text); }
        .book-row-author { font-size:12px; color:var(--muted); }
        .status-select { border:1px solid var(--line); padding:6px 10px; font-size:12px; font-family:'Noto Sans JP',sans-serif; color:var(--text); background:white; outline:none; cursor:pointer; }
        .edit-btn { font-size:12px; color:var(--text); background:none; border:none; cursor:pointer; font-family:'Noto Sans JP',sans-serif; white-space:nowrap; }
        .edit-btn:hover { text-decoration:underline; }
        .pick-btn { font-size:12px; color:var(--blue); background:none; border:none; cursor:pointer; font-family:'Noto Sans JP',sans-serif; white-space:nowrap; }
        .pick-btn:hover { text-decoration:underline; }
        .delete-btn { font-size:12px; color:var(--red); background:none; border:none; cursor:pointer; font-family:'Noto Sans JP',sans-serif; white-space:nowrap; }
        .delete-btn:hover { text-decoration:underline; }

        .edit-panel { background:var(--bg2); border:1px solid var(--line); border-top:none; padding:24px 28px; margin-bottom:2px; }
        .edit-panel-title { font-size:11px; letter-spacing:2px; color:var(--muted); margin-bottom:16px; }
        .edit-form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; }
        @media(max-width:600px){ .edit-form-row { grid-template-columns:1fr; } }
        .edit-actions { display:flex; gap:12px; margin-top:16px; }
        .save-btn { background:var(--text); color:white; border:none; padding:9px 24px; font-size:13px; font-weight:500; cursor:pointer; font-family:'Noto Sans JP',sans-serif; transition:opacity 0.2s; }
        .save-btn:hover { opacity:0.75; }
        .save-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .cancel-btn { background:none; border:1px solid var(--line); color:var(--muted); padding:9px 20px; font-size:13px; cursor:pointer; font-family:'Noto Sans JP',sans-serif; }
        .cancel-btn:hover { border-color:var(--text); color:var(--text); }

        .featured-panel { background:var(--bg2); border:1px solid var(--line); padding:24px 28px; margin-top:16px; }
        .featured-panel-title { font-size:12px; font-weight:500; color:var(--text); margin-bottom:16px; }
        .comment-row { background:white; padding:14px 16px; margin-bottom:2px; display:flex; gap:12px; align-items:flex-start; }
        .comment-row-text { font-size:13px; color:var(--text); line-height:1.8; flex:1; }
        .comment-row-likes { font-size:12px; color:var(--red); font-weight:500; flex-shrink:0; min-width:48px; }
        .feature-toggle { font-size:11px; border:none; padding:5px 12px; cursor:pointer; font-family:'Noto Sans JP',sans-serif; white-space:nowrap; flex-shrink:0; }
        .feature-toggle.on { background:var(--red); color:white; }
        .feature-toggle.off { background:var(--bg3); color:var(--muted); }

        .book-tabs { display:flex; border-bottom:1px solid var(--line); margin-bottom:16px; }
        .book-tab { padding:10px 20px; font-size:12px; font-weight:500; background:none; border:none; cursor:pointer; color:var(--muted); font-family:'Noto Sans JP',sans-serif; border-bottom:2px solid transparent; margin-bottom:-1px; transition:all 0.15s; letter-spacing:0.5px; }
        .book-tab.active { color:var(--text); border-bottom-color:var(--text); }
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
              <strong>手動実行</strong>：通常は毎週土曜0時(JST)に自動実行されます。<br />
              実行すると：reading→open→closed のステータス更新と新作2冊の追加が行われます。
            </div>
            <button className="run-btn" onClick={handleRunScheduler} disabled={schedulerRunning}>
              {schedulerRunning ? "実行中..." : "今すぐ実行"}
            </button>
          </div>
          {schedulerResult && <p className="scheduler-result">{schedulerResult}</p>}
        </div>

        <div className="admin-section">
          <div className="section-title">一括スラグ付与</div>
          <div className="scheduler-box">
            <div className="scheduler-desc">
              <strong>既存本のスラグ未設定分を一括付与</strong>：slugフィールドがない本に「タイトル-YYYY-MM」形式のスラグを自動生成します。
            </div>
            <button className="run-btn" onClick={handleBulkSlug} disabled={slugging}>
              {slugging ? "処理中..." : "一括付与する"}
            </button>
          </div>
          {slugResult && <p className="scheduler-result">{slugResult}</p>}
        </div>

        <div className="admin-section">
          <div className="section-title">本を手動追加</div>
          <div className="add-book-form">
            <div className="form-row">
              <div className="form-field">
                <label className="form-label">タイトル *</label>
                <input
                  className="form-input"
                  placeholder="タイトルを入力すると自動検索"
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
                <div className="form-hint">2文字以上で書籍を自動検索します</div>
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
            <div className="form-row">
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
            <div className="form-row" style={{marginBottom:12}}>
              <div>
                <label className="form-label">ジャンル</label>
                <select
                  className="form-input"
                  value={newBook.genre}
                  onChange={(e) => setNewBook({ ...newBook, genre: e.target.value })}
                >
                  <option value="">未選択</option>
                  {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">あらすじ</label>
                <textarea
                  className="form-input"
                  style={{resize:"vertical",minHeight:72}}
                  placeholder="自動入力 or 手動入力"
                  value={newBook.description}
                  onChange={(e) => setNewBook({ ...newBook, description: e.target.value })}
                />
              </div>
            </div>
            <div className="form-row" style={{marginBottom:20}}>
              <div>
                <label className="form-label">スラグ（URL用）</label>
                <input
                  className="form-input"
                  placeholder="タイトル選択時に自動生成"
                  value={newBook.slug}
                  onChange={(e) => setNewBook({ ...newBook, slug: e.target.value })}
                />
                <div className="form-hint">/book/スラグ でアクセス可能になります</div>
              </div>
            </div>
            <button className="add-btn" onClick={handleAddBook} disabled={addingBook || !newBook.title.trim()}>
              {addingBook ? "追加中..." : "追加する"}
            </button>
          </div>
        </div>

        <div className="admin-section">
          <div className="section-title">本一覧・ステータス管理</div>
          <div className="book-tabs">
            <button
              className={`book-tab${bookTab === "active" ? " active" : ""}`}
              onClick={() => { setBookTab("active"); setEditingBook(null); setSelectedBookId(""); setFeaturedCandidates([]); }}
            >運用中</button>
            <button
              className={`book-tab${bookTab === "archived" ? " active" : ""}`}
              onClick={() => { setBookTab("archived"); setEditingBook(null); setSelectedBookId(""); setFeaturedCandidates([]); }}
            >アーカイブ済み</button>
          </div>
          <div className="books-table">
            {books.filter((b) => bookTab === "active" ? b.status !== "closed" : b.status === "closed").map((book) => (
              <div key={book.id}>
                <div className="books-row">
                  <div>
                    <div className="book-row-title">{book.title}</div>
                    <div className="book-row-author">{book.author} · Week {book.week}{book.genre ? ` · ${book.genre}` : ""}</div>
                  </div>
                  <select className="status-select" value={book.status} onChange={(e) => handleStatusChange(book.id, e.target.value)}>
                    <option value="week1">week1</option>
                    <option value="week2">week2</option>
                    <option value="closed">closed</option>
                  </select>
                  <button className="edit-btn" onClick={() => handleStartEdit(book)}>
                    {editingBook?.id === book.id ? "閉じる" : "編集"}
                  </button>
                  <button className="pick-btn" onClick={() => fetchComments(book.id)}>注目コメント</button>
                  <button className="delete-btn" onClick={() => handleDeleteBook(book.id, book.title)}>削除</button>
                </div>

                {editingBook?.id === book.id && (
                  <div className="edit-panel">
                    <div className="edit-panel-title">EDIT · {book.title}</div>
                    <div className="edit-form-row">
                      <div>
                        <label className="form-label">タイトル</label>
                        <input className="form-input" value={editingBook.title} onChange={(e) => setEditingBook({ ...editingBook, title: e.target.value })} />
                      </div>
                      <div>
                        <label className="form-label">著者名</label>
                        <input className="form-input" value={editingBook.author} onChange={(e) => setEditingBook({ ...editingBook, author: e.target.value })} />
                      </div>
                    </div>
                    <div className="edit-form-row">
                      <div>
                        <label className="form-label">楽天URL</label>
                        <input className="form-input" value={editingBook.rakutenUrl} onChange={(e) => setEditingBook({ ...editingBook, rakutenUrl: e.target.value })} />
                      </div>
                      <div>
                        <label className="form-label">表紙画像URL</label>
                        <input className="form-input" value={editingBook.coverUrl} onChange={(e) => setEditingBook({ ...editingBook, coverUrl: e.target.value })} />
                        {editingBook.coverUrl && <img src={editingBook.coverUrl} alt="" className="preview-cover" />}
                      </div>
                    </div>
                    <div className="edit-form-row">
                      <div>
                        <label className="form-label">ジャンル</label>
                        <select className="form-input" value={editingBook.genre} onChange={(e) => setEditingBook({ ...editingBook, genre: e.target.value })}>
                          <option value="">未選択</option>
                          {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="form-label">あらすじ</label>
                        <textarea className="form-input" style={{resize:"vertical",minHeight:72}} value={editingBook.description} onChange={(e) => setEditingBook({ ...editingBook, description: e.target.value })} />
                      </div>
                    </div>
                    <div className="edit-form-row">
                      <div>
                        <label className="form-label">スラグ（URL用）</label>
                        <input className="form-input" value={editingBook.slug} onChange={(e) => setEditingBook({ ...editingBook, slug: e.target.value })} placeholder="例: コンビニ人間-2026-04" />
                        <div className="form-hint">/book/スラグ でアクセス可能になります</div>
                      </div>
                    </div>
                    <div className="edit-actions">
                      <button className="save-btn" onClick={handleSaveEdit} disabled={savingEdit}>{savingEdit ? "保存中..." : "保存する"}</button>
                      <button className="cancel-btn" onClick={() => setEditingBook(null)}>キャンセル</button>
                    </div>
                  </div>
                )}
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

"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase";
import {
  collection, getDocs, doc, getDoc, updateDoc, addDoc, deleteDoc,
  query, orderBy, serverTimestamp, collectionGroup, where,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import AppNav from "@/components/AppNav";

const GENRE_TAGS = [
  "文学・小説", "歴史・時代小説", "哲学・思想", "社会・政治",
  "経済・ビジネス", "科学・テクノロジー", "心理学", "芸術・文化",
  "エッセイ", "ノンフィクション", "詩歌・古典", "その他",
];

const RONKAKU = 1000;

export default function ProfilePage() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const iconInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState("bookshelf");

  // icon
  const [iconUrl, setIconUrl] = useState(null);
  const [iconUploading, setIconUploading] = useState(false);

  // genres
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [genreEditing, setGenreEditing] = useState(false);
  const [genreSaving, setGenreSaving] = useState(false);

  // stats
  const [totalLikes, setTotalLikes] = useState(0);
  const [threadCount, setThreadCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);

  // bookshelf
  const [bookshelf, setBookshelf] = useState([]);
  const [bookshelfLoading, setBookshelfLoading] = useState(true);
  const [addingBook, setAddingBook] = useState(false);
  const [newBook, setNewBook] = useState({ title: "", author: "", review: "" });
  const [bookSaving, setBookSaving] = useState(false);
  const [editingReview, setEditingReview] = useState(null);

  // connections
  const [likedUsers, setLikedUsers] = useState([]);
  const [likers, setLikers] = useState([]);
  const [bookmarkedBy, setBookmarkedBy] = useState([]);
  const [myBookmarks, setMyBookmarks] = useState(new Set());
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [likedExpanded, setLikedExpanded] = useState(false);
  const [likersExpanded, setLikersExpanded] = useState(false);
  const [bookmarkedExpanded, setBookmarkedExpanded] = useState(false);

  // history
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  useEffect(() => {
    if (user === null) router.push("/login");
  }, [user, router]);

  useEffect(() => {
    if (!userData) return;
    if (userData.iconUrl) setIconUrl(userData.iconUrl);
    if (userData.genres) setSelectedGenres(userData.genres);
  }, [userData]);

  useEffect(() => {
    if (!user) return;
    fetchStats();
    fetchConnections();
  }, [user, userData]);

  useEffect(() => {
    if (!user || activeTab !== "bookshelf") return;
    fetchBookshelf();
  }, [user, activeTab]);

  useEffect(() => {
    if (!user || activeTab !== "history") return;
    fetchHistory();
  }, [user, activeTab]);

  async function fetchStats() {
    setStatsLoading(true);
    try {
      const allLikesSnap = await getDocs(collection(db, "likes"));
      let total = 0;
      await Promise.all(allLikesSnap.docs.map(async (fromDoc) => {
        if (fromDoc.id === user.uid) return;
        const tSnap = await getDoc(doc(db, "likes", fromDoc.id, "targets", user.uid));
        if (tSnap.exists()) total += tSnap.data().count || 0;
      }));
      setTotalLikes(total);

      const cSnap = await getDocs(query(collectionGroup(db, "comments"), where("userId", "==", user.uid)));
      const bookIds = new Set(cSnap.docs.map((d) => d.ref.parent.parent.id));
      setThreadCount(bookIds.size);
    } finally {
      setStatsLoading(false);
    }
  }

  async function fetchConnections() {
    setConnectionsLoading(true);
    try {
      // いいねした人
      const likedSnap = await getDocs(collection(db, "likes", user.uid, "targets"));
      const likedList = likedSnap.docs.map((d) => ({ uid: d.id, count: d.data().count || 0 }));
      likedList.sort((a, b) => b.count - a.count);
      if (userData?.isPremium) {
        await Promise.all(likedList.map(async (u) => {
          const snap = await getDoc(doc(db, "users", u.uid));
          u.displayName = snap.exists() ? snap.data().displayName : null;
        }));
      }
      setLikedUsers(likedList);

      // いいねをくれた人
      const allLikesSnap = await getDocs(collection(db, "likes"));
      const likerList = [];
      await Promise.all(allLikesSnap.docs.map(async (fromDoc) => {
        const fromUid = fromDoc.id;
        if (fromUid === user.uid) return;
        const tSnap = await getDoc(doc(db, "likes", fromUid, "targets", user.uid));
        if (!tSnap.exists()) return;
        let displayName = null;
        if (userData?.isPremium) {
          const uSnap = await getDoc(doc(db, "users", fromUid));
          displayName = uSnap.exists() ? uSnap.data().displayName : null;
        }
        likerList.push({ uid: fromUid, count: tSnap.data().count || 0, displayName });
      }));
      likerList.sort((a, b) => b.count - a.count);
      setLikers(likerList);

      // 自分のブックマーク
      const myBmSnap = await getDocs(collection(db, "bookmarks", user.uid, "targets"));
      const myBmSet = new Set(myBmSnap.docs.map((d) => d.id));
      setMyBookmarks(myBmSet);

      // ブックマークされてる人（users/{uid}/bookmarkedBy サブコレクション）
      const bmBySnap = await getDocs(collection(db, "users", user.uid, "bookmarkedBy"));
      const bmByList = [];
      await Promise.all(bmBySnap.docs.map(async (fromDoc) => {
        const fromUid = fromDoc.id;
        const isMutual = myBmSet.has(fromUid);
        let displayName = null;
        if (userData?.isPremium || isMutual) {
          const uSnap = await getDoc(doc(db, "users", fromUid));
          displayName = uSnap.exists() ? uSnap.data().displayName : null;
        }
        bmByList.push({ uid: fromUid, isMutual, displayName });
      }));
      setBookmarkedBy(bmByList);
    } finally {
      setConnectionsLoading(false);
    }
  }

  async function fetchBookshelf() {
    setBookshelfLoading(true);
    const snap = await getDocs(
      query(collection(db, "users", user.uid, "bookshelf"), orderBy("order", "asc"))
    );
    setBookshelf(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setBookshelfLoading(false);
  }

  async function fetchHistory() {
    setHistoryLoading(true);
    try {
      const cSnap = await getDocs(
        query(collectionGroup(db, "comments"), where("userId", "==", user.uid))
      );
      const bookIds = [...new Set(cSnap.docs.map((d) => d.ref.parent.parent.id))];
      const books = await Promise.all(
        bookIds.map(async (bid) => {
          const bSnap = await getDoc(doc(db, "books", bid));
          return bSnap.exists() ? { id: bid, ...bSnap.data() } : null;
        })
      );
      setHistory(books.filter(Boolean));
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleIconChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setIconUploading(true);
    try {
      const storageRef = ref(storage, `icons/${user.uid}`);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "users", user.uid), { iconUrl: url });
      setIconUrl(url);
    } finally {
      setIconUploading(false);
      e.target.value = "";
    }
  }

  async function handleGenreSave() {
    setGenreSaving(true);
    await updateDoc(doc(db, "users", user.uid), { genres: selectedGenres });
    setGenreSaving(false);
    setGenreEditing(false);
  }

  function toggleGenre(tag) {
    setSelectedGenres((prev) =>
      prev.includes(tag) ? prev.filter((g) => g !== tag) : [...prev, tag]
    );
  }

  async function handleAddBook() {
    if (!newBook.title.trim() || bookSaving || bookshelf.length >= 10) return;
    setBookSaving(true);
    await addDoc(collection(db, "users", user.uid, "bookshelf"), {
      title: newBook.title.trim(),
      author: newBook.author.trim(),
      review: newBook.review.trim(),
      order: bookshelf.length,
      createdAt: serverTimestamp(),
    });
    setNewBook({ title: "", author: "", review: "" });
    setAddingBook(false);
    setBookSaving(false);
    await fetchBookshelf();
  }

  async function handleDeleteBook(id) {
    await deleteDoc(doc(db, "users", user.uid, "bookshelf", id));
    setBookshelf((prev) => prev.filter((b) => b.id !== id));
  }

  async function handleSaveReview(id, text) {
    await updateDoc(doc(db, "users", user.uid, "bookshelf", id), { review: text });
    setBookshelf((prev) => prev.map((b) => b.id === id ? { ...b, review: text } : b));
    setEditingReview(null);
  }

  if (user === undefined) return null;

  const ronkakuLeft = Math.max(0, RONKAKU - totalLikes);
  const likedDisplay = likedUsers.slice(0, likedExpanded ? 40 : 10);
  const likersDisplay = likers.slice(0, likersExpanded ? 40 : 10);
  const bookmarkedDisplay = bookmarkedExpanded ? bookmarkedBy : bookmarkedBy.slice(0, 5);
  const historyDisplay = historyExpanded ? history : history.slice(0, 5);

  return (
    <>
      <style>{`
        .p-wrap { max-width:720px; margin:0 auto; padding:60px 40px 120px; }
        @media(max-width:768px){ .p-wrap { padding:40px 16px 80px; } }

        /* ---- header ---- */
        .p-header { display:flex; gap:28px; align-items:flex-start; margin-bottom:40px; }
        .p-icon-wrap { flex-shrink:0; }
        .p-icon {
          width:88px; height:88px; background:var(--bg3);
          cursor:pointer; position:relative; overflow:hidden;
          display:flex; align-items:center; justify-content:center;
        }
        .p-icon img { width:100%; height:100%; object-fit:cover; display:block; }
        .p-icon-overlay {
          position:absolute; inset:0; background:rgba(0,0,0,0.45);
          display:flex; align-items:center; justify-content:center;
          opacity:0; transition:opacity 0.2s;
        }
        .p-icon:hover .p-icon-overlay { opacity:1; }
        .p-icon-overlay span { font-size:11px; color:white; letter-spacing:1px; }
        .p-icon-uploading { position:absolute; inset:0; background:rgba(255,255,255,0.7); display:flex; align-items:center; justify-content:center; }
        .p-header-body { flex:1; min-width:0; }
        .p-name { font-size:22px; font-weight:900; color:var(--text); letter-spacing:-0.5px; margin-bottom:12px; }

        .p-genres { display:flex; flex-wrap:wrap; gap:6px; }
        .p-genre-tag {
          font-size:11px; letter-spacing:1px; padding:4px 10px;
          background:var(--bg2); color:var(--text); border:1px solid var(--line);
        }
        .p-genre-empty { font-size:12px; color:var(--muted); }
        .p-genre-edit-btn {
          font-size:11px; color:var(--muted); background:none; border:none;
          cursor:pointer; font-family:'Noto Sans JP',sans-serif;
          padding:0; margin-top:10px; display:block; transition:color 0.2s;
        }
        .p-genre-edit-btn:hover { color:var(--text); }

        /* genre editor */
        .p-genre-editor { margin-top:16px; }
        .p-genre-choices { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px; }
        .p-genre-choice {
          font-size:11px; letter-spacing:0.5px; padding:5px 12px;
          background:var(--bg2); color:var(--muted); border:1px solid var(--line);
          cursor:pointer; transition:all 0.15s;
        }
        .p-genre-choice.on { background:var(--text); color:white; border-color:var(--text); }
        .p-genre-save {
          font-size:12px; background:var(--text); color:white; border:none;
          padding:8px 20px; cursor:pointer; font-family:'Noto Sans JP',sans-serif;
          transition:opacity 0.2s; letter-spacing:0.5px;
        }
        .p-genre-save:disabled { opacity:0.5; cursor:not-allowed; }
        .p-genre-cancel {
          font-size:12px; color:var(--muted); background:none; border:none;
          cursor:pointer; font-family:'Noto Sans JP',sans-serif; margin-left:12px;
        }

        /* ---- stats ---- */
        .p-stats { display:flex; gap:2px; background:var(--line); margin-bottom:40px; }
        .p-stat { background:var(--bg); flex:1; padding:24px 20px; }
        @media(max-width:480px){ .p-stats { flex-direction:column; } }
        .p-stat-label { font-size:10px; letter-spacing:2px; color:var(--muted); margin-bottom:6px; }
        .p-stat-value { font-family:'DM Sans',sans-serif; font-size:32px; font-weight:700; color:var(--text); letter-spacing:-1px; line-height:1; }
        .p-stat-unit { font-size:11px; color:var(--muted); margin-top:4px; }

        /* ---- tabs ---- */
        .p-tabs { display:flex; border-bottom:1px solid var(--line); margin-bottom:32px; }
        .p-tab {
          font-size:13px; padding:10px 20px; background:none; border:none;
          cursor:pointer; color:var(--muted); font-family:'Noto Sans JP',sans-serif;
          border-bottom:2px solid transparent; margin-bottom:-1px; transition:all 0.15s;
        }
        .p-tab:hover { color:var(--text); }
        .p-tab.active { color:var(--text); font-weight:700; border-bottom-color:var(--text); }

        /* ---- bookshelf ---- */
        .p-shelf { display:flex; flex-direction:column; gap:2px; background:var(--line); }
        .p-shelf-item { background:var(--bg); padding:20px 24px; }
        .p-shelf-meta { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; }
        .p-shelf-title { font-size:16px; font-weight:700; color:var(--text); letter-spacing:-0.3px; }
        .p-shelf-author { font-size:12px; color:var(--muted); margin-top:2px; }
        .p-shelf-del {
          font-size:11px; color:var(--muted); background:none; border:none;
          cursor:pointer; font-family:'Noto Sans JP',sans-serif; flex-shrink:0;
          padding:0; transition:color 0.2s;
        }
        .p-shelf-del:hover { color:var(--red); }
        .p-shelf-review { font-size:13px; color:var(--muted); line-height:1.9; cursor:pointer; transition:color 0.2s; }
        .p-shelf-review:hover { color:var(--text); }
        .p-shelf-review-empty { font-size:12px; color:var(--line); font-style:italic; cursor:pointer; }
        .p-shelf-textarea {
          width:100%; border:none; border-bottom:1px solid var(--line); padding:6px 0;
          font-size:13px; font-family:'Noto Sans JP',sans-serif; line-height:1.9;
          color:var(--text); outline:none; resize:none; background:transparent;
        }
        .p-shelf-save {
          font-size:11px; color:var(--text); background:none; border:none;
          cursor:pointer; font-family:'Noto Sans JP',sans-serif; padding:0; margin-top:6px;
        }

        .p-shelf-add {
          margin-top:2px; background:var(--bg2); padding:20px 24px;
          border:1px dashed var(--line);
        }
        .p-shelf-add-btn {
          font-size:13px; color:var(--muted); background:none; border:none;
          cursor:pointer; font-family:'Noto Sans JP',sans-serif; padding:0;
          transition:color 0.2s;
        }
        .p-shelf-add-btn:hover { color:var(--text); }
        .p-shelf-form { display:flex; flex-direction:column; gap:10px; }
        .p-input {
          border:none; border-bottom:1px solid var(--line); padding:8px 0;
          font-size:14px; font-family:'Noto Sans JP',sans-serif; color:var(--text);
          outline:none; background:transparent; width:100%;
        }
        .p-input::placeholder { color:var(--line); }
        .p-input:focus { border-bottom-color:var(--text); }
        .p-form-btns { display:flex; align-items:center; gap:12px; margin-top:4px; }
        .p-form-submit {
          font-size:12px; background:var(--text); color:white; border:none;
          padding:8px 20px; cursor:pointer; font-family:'Noto Sans JP',sans-serif;
          transition:opacity 0.2s; letter-spacing:0.5px;
        }
        .p-form-submit:disabled { opacity:0.4; cursor:not-allowed; }
        .p-form-cancel {
          font-size:12px; color:var(--muted); background:none; border:none;
          cursor:pointer; font-family:'Noto Sans JP',sans-serif;
        }
        .p-shelf-limit { font-size:12px; color:var(--muted); margin-top:12px; }

        /* ---- connections ---- */
        .p-conn-section { margin-bottom:40px; }
        .p-conn-label {
          font-size:10px; letter-spacing:3px; color:var(--muted); margin-bottom:12px;
        }
        .p-conn-list { display:flex; flex-direction:column; gap:2px; background:var(--line); }
        .p-conn-row {
          background:var(--bg); padding:16px 20px;
          display:flex; justify-content:space-between; align-items:center;
        }
        .p-conn-name { font-size:14px; color:var(--text); }
        .p-conn-count { font-family:'DM Sans',sans-serif; font-size:18px; font-weight:700; color:var(--red); }
        .p-conn-count-unit { font-size:11px; color:var(--muted); margin-left:3px; }
        .p-conn-mutual { font-size:10px; letter-spacing:1px; color:var(--blue); margin-left:8px; }
        .p-conn-expand {
          font-size:12px; color:var(--muted); background:none; border:none;
          cursor:pointer; font-family:'Noto Sans JP',sans-serif; padding:16px 20px;
          background:var(--bg2); text-align:left; width:100%; border-top:1px solid var(--line);
          transition:color 0.2s;
        }
        .p-conn-expand:hover { color:var(--text); }
        .p-conn-empty { font-size:12px; color:var(--muted); padding:16px 0; }
        .p-premium-gate {
          background:var(--bg2); border:1px solid var(--line);
          padding:16px 20px; font-size:12px; color:var(--muted); line-height:1.9;
          margin-top:2px;
        }
        .p-premium-gate a { color:var(--text); font-weight:500; }

        /* ---- history ---- */
        .p-history { display:flex; flex-direction:column; gap:2px; background:var(--line); }
        .p-history-row { background:var(--bg); padding:16px 20px; }
        .p-history-title { font-size:14px; color:var(--text); font-weight:500; }
        .p-history-author { font-size:12px; color:var(--muted); margin-top:2px; }
        .p-history-expand {
          font-size:12px; color:var(--muted); background:none; border:none;
          cursor:pointer; font-family:'Noto Sans JP',sans-serif; padding:16px 20px;
          background:var(--bg2); text-align:left; width:100%; border-top:1px solid var(--line);
          transition:color 0.2s;
        }
        .p-history-expand:hover { color:var(--text); }
        .p-empty { font-size:13px; color:var(--muted); line-height:2; }
        .p-loading { font-size:12px; color:var(--muted); letter-spacing:2px; }
      `}</style>

      <AppNav />

      <div className="p-wrap">

        {/* ---- HEADER ---- */}
        <div className="p-header">
          <div className="p-icon-wrap">
            <div className="p-icon" onClick={() => iconInputRef.current?.click()}>
              {iconUrl
                ? <img src={iconUrl} alt="アイコン" />
                : <span style={{fontSize:10,color:"var(--muted)",letterSpacing:1}}>画像</span>
              }
              {!iconUploading && (
                <div className="p-icon-overlay"><span>変更</span></div>
              )}
              {iconUploading && (
                <div className="p-icon-uploading">
                  <span style={{fontSize:10,color:"var(--muted)"}}>...</span>
                </div>
              )}
            </div>
            <input
              ref={iconInputRef}
              type="file"
              accept="image/*"
              style={{display:"none"}}
              onChange={handleIconChange}
            />
          </div>

          <div className="p-header-body">
            <div className="p-name">{userData?.displayName || "匿名ユーザー"}</div>

            {!genreEditing ? (
              <>
                <div className="p-genres">
                  {selectedGenres.length > 0
                    ? selectedGenres.map((g) => (
                        <span key={g} className="p-genre-tag">{g}</span>
                      ))
                    : <span className="p-genre-empty">好きなジャンルを設定</span>
                  }
                </div>
                <button className="p-genre-edit-btn" onClick={() => setGenreEditing(true)}>
                  ジャンルを編集
                </button>
              </>
            ) : (
              <div className="p-genre-editor">
                <div className="p-genre-choices">
                  {GENRE_TAGS.map((tag) => (
                    <button
                      key={tag}
                      className={`p-genre-choice${selectedGenres.includes(tag) ? " on" : ""}`}
                      onClick={() => toggleGenre(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <button
                  className="p-genre-save"
                  onClick={handleGenreSave}
                  disabled={genreSaving}
                >
                  {genreSaving ? "保存中" : "保存"}
                </button>
                <button className="p-genre-cancel" onClick={() => setGenreEditing(false)}>
                  キャンセル
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ---- STATS ---- */}
        <div className="p-stats">
          <div className="p-stat">
            <div className="p-stat-label">いいね累計</div>
            <div className="p-stat-value">{statsLoading ? "—" : totalLikes}</div>
          </div>
          <div className="p-stat">
            <div className="p-stat-label">参加スレ数</div>
            <div className="p-stat-value">{statsLoading ? "—" : threadCount}</div>
          </div>
          <div className="p-stat">
            <div className="p-stat-label">論客認定まで</div>
            {statsLoading ? (
              <div className="p-stat-value">—</div>
            ) : totalLikes >= RONKAKU ? (
              <>
                <div className="p-stat-value" style={{color:"var(--red)"}}>認定済</div>
              </>
            ) : (
              <>
                <div className="p-stat-value">{ronkakuLeft}</div>
                <div className="p-stat-unit">いいね</div>
              </>
            )}
          </div>
        </div>

        {/* ---- TABS ---- */}
        <div className="p-tabs">
          {["bookshelf", "connections", "history"].map((tab) => {
            const label = { bookshelf: "本棚", connections: "つながり", history: "履歴" }[tab];
            return (
              <button
                key={tab}
                className={`p-tab${activeTab === tab ? " active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* ---- BOOKSHELF ---- */}
        {activeTab === "bookshelf" && (
          <>
            {bookshelfLoading ? (
              <p className="p-loading">読み込み中</p>
            ) : (
              <>
                {bookshelf.length > 0 && (
                  <div className="p-shelf">
                    {bookshelf.map((book) => (
                      <div key={book.id} className="p-shelf-item">
                        <div className="p-shelf-meta">
                          <div>
                            <div className="p-shelf-title">{book.title}</div>
                            {book.author && <div className="p-shelf-author">{book.author}</div>}
                          </div>
                          <button className="p-shelf-del" onClick={() => handleDeleteBook(book.id)}>
                            削除
                          </button>
                        </div>

                        {editingReview?.id === book.id ? (
                          <>
                            <textarea
                              className="p-shelf-textarea"
                              rows={3}
                              value={editingReview.text}
                              onChange={(e) => setEditingReview({ ...editingReview, text: e.target.value })}
                              autoFocus
                            />
                            <div>
                              <button className="p-shelf-save" onClick={() => handleSaveReview(book.id, editingReview.text)}>
                                保存
                              </button>
                              <button className="p-form-cancel" style={{marginLeft:12}} onClick={() => setEditingReview(null)}>
                                キャンセル
                              </button>
                            </div>
                          </>
                        ) : book.review ? (
                          <div
                            className="p-shelf-review"
                            onClick={() => setEditingReview({ id: book.id, text: book.review })}
                          >
                            {book.review}
                          </div>
                        ) : (
                          <div
                            className="p-shelf-review-empty"
                            onClick={() => setEditingReview({ id: book.id, text: "" })}
                          >
                            批評コメントを追加
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-shelf-add">
                  {bookshelf.length >= 10 ? (
                    <p className="p-shelf-limit">本棚は最大10冊です</p>
                  ) : !addingBook ? (
                    <button className="p-shelf-add-btn" onClick={() => setAddingBook(true)}>
                      + 本を追加（{bookshelf.length}/10）
                    </button>
                  ) : (
                    <div className="p-shelf-form">
                      <input
                        className="p-input"
                        placeholder="書名（必須）"
                        value={newBook.title}
                        onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
                        autoFocus
                      />
                      <input
                        className="p-input"
                        placeholder="著者名"
                        value={newBook.author}
                        onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
                      />
                      <textarea
                        className="p-input"
                        placeholder="批評コメント"
                        rows={3}
                        value={newBook.review}
                        onChange={(e) => setNewBook({ ...newBook, review: e.target.value })}
                        style={{resize:"none"}}
                      />
                      <div className="p-form-btns">
                        <button
                          className="p-form-submit"
                          onClick={handleAddBook}
                          disabled={!newBook.title.trim() || bookSaving}
                        >
                          {bookSaving ? "保存中" : "追加"}
                        </button>
                        <button className="p-form-cancel" onClick={() => { setAddingBook(false); setNewBook({ title: "", author: "", review: "" }); }}>
                          キャンセル
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {bookshelf.length === 0 && !addingBook && (
                  <p className="p-empty" style={{marginTop:16}}>
                    おすすめ本を最大10冊まで登録できます。
                  </p>
                )}
              </>
            )}
          </>
        )}

        {/* ---- CONNECTIONS ---- */}
        {activeTab === "connections" && (
          <>
            {connectionsLoading ? (
              <p className="p-loading">読み込み中</p>
            ) : (
              <>
                {/* いいねした人 */}
                <div className="p-conn-section">
                  <div className="p-conn-label">自分がいいねした人</div>
                  {likedUsers.length === 0 ? (
                    <p className="p-conn-empty">まだいいねした人はいません</p>
                  ) : (
                    <>
                      <div className="p-conn-list">
                        {likedDisplay.map((u, i) => (
                          <div key={u.uid} className="p-conn-row">
                            <div className="p-conn-name">
                              {userData?.isPremium
                                ? (u.displayName || "名無し")
                                : `匿名${String.fromCharCode(65 + (i % 26))}`
                              }
                            </div>
                            <div>
                              <span className="p-conn-count">{u.count}</span>
                              <span className="p-conn-count-unit">いいね</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {likedUsers.length > 10 && (
                        <button className="p-conn-expand" onClick={() => setLikedExpanded((v) => !v)}>
                          {likedExpanded ? `閉じる` : `さらに表示（${Math.min(likedUsers.length, 40) - 10}件）`}
                        </button>
                      )}
                      {!userData?.isPremium && (
                        <div className="p-premium-gate">
                          正体の開帳はプレミアム会員限定です。
                          <a href="/premium">プレミアムにアップグレード →</a>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* いいねをくれた人 */}
                <div className="p-conn-section">
                  <div className="p-conn-label">いいねをくれた人</div>
                  {likers.length === 0 ? (
                    <p className="p-conn-empty">まだいいねはありません</p>
                  ) : (
                    <>
                      <div className="p-conn-list">
                        {likersDisplay.map((u, i) => (
                          <div key={u.uid} className="p-conn-row">
                            <div className="p-conn-name">
                              {userData?.isPremium
                                ? (u.displayName || "名無し")
                                : `匿名${String.fromCharCode(65 + (i % 26))}`
                              }
                            </div>
                            <div>
                              <span className="p-conn-count">{u.count}</span>
                              <span className="p-conn-count-unit">いいね</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {likers.length > 10 && (
                        <button className="p-conn-expand" onClick={() => setLikersExpanded((v) => !v)}>
                          {likersExpanded ? `閉じる` : `さらに表示（${Math.min(likers.length, 40) - 10}件）`}
                        </button>
                      )}
                      {!userData?.isPremium && (
                        <div className="p-premium-gate">
                          正体の開帳はプレミアム会員限定です。
                          <a href="/premium">プレミアムにアップグレード →</a>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* ブックマークされてる人 */}
                <div className="p-conn-section">
                  <div className="p-conn-label">ブックマークされてる人</div>
                  {bookmarkedBy.length === 0 ? (
                    <p className="p-conn-empty">まだブックマークされていません</p>
                  ) : (
                    <>
                      <div className="p-conn-list">
                        {bookmarkedDisplay.map((u, i) => (
                          <div key={u.uid} className="p-conn-row">
                            <div className="p-conn-name">
                              {userData?.isPremium || u.isMutual
                                ? (
                                  <>
                                    {u.displayName || "名無し"}
                                    {u.isMutual && <span className="p-conn-mutual">相互</span>}
                                  </>
                                )
                                : `匿名${String.fromCharCode(65 + (i % 26))}`
                              }
                            </div>
                            {u.isMutual && <span style={{fontSize:11,color:"var(--blue)"}}>相互ブックマーク</span>}
                          </div>
                        ))}
                      </div>
                      {bookmarkedBy.length > 5 && (
                        <button className="p-conn-expand" onClick={() => setBookmarkedExpanded((v) => !v)}>
                          {bookmarkedExpanded ? `閉じる` : `全件表示（${bookmarkedBy.length}件）`}
                        </button>
                      )}
                      {!userData?.isPremium && bookmarkedBy.some((u) => !u.isMutual) && (
                        <div className="p-premium-gate">
                          相互ブックマーク以外の正体開帳はプレミアム会員限定です。
                          <a href="/premium">プレミアムにアップグレード →</a>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ---- HISTORY ---- */}
        {activeTab === "history" && (
          <>
            {historyLoading ? (
              <p className="p-loading">読み込み中</p>
            ) : history.length === 0 ? (
              <p className="p-empty">まだ参加した討論はありません。</p>
            ) : (
              <>
                <div className="p-history">
                  {historyDisplay.map((book) => (
                    <div key={book.id} className="p-history-row">
                      <div className="p-history-title">{book.title}</div>
                      {book.author && <div className="p-history-author">{book.author}</div>}
                    </div>
                  ))}
                </div>
                {history.length > 5 && (
                  <button className="p-history-expand" onClick={() => setHistoryExpanded((v) => !v)}>
                    {historyExpanded ? `閉じる` : `全件表示（${history.length}件）`}
                  </button>
                )}
              </>
            )}
          </>
        )}

      </div>
    </>
  );
}

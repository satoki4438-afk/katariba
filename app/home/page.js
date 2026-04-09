"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { collection, query, orderBy, getDocs } from "firebase/firestore";

export default function HomePage() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user === null) router.push("/login");
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    async function fetchBooks() {
      const q = query(collection(db, "books"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setBooks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    fetchBooks();
  }, [user]);

  async function handleSignOut() {
    await signOut(auth);
    router.push("/");
  }

  if (user === undefined) return null;

  return (
    <>
      <style>{`
        .home-nav {
          position:sticky; top:0; z-index:100;
          padding:16px 40px; display:flex; justify-content:space-between; align-items:center;
          background:rgba(255,255,255,0.96); backdrop-filter:blur(10px);
          border-bottom:1px solid var(--line);
        }
        @media(max-width:768px){ .home-nav { padding:14px 20px; } }
        .home-logo { font-family:'DM Sans',sans-serif; font-size:18px; font-weight:900; color:var(--text); text-decoration:none; }
        .home-nav-right { display:flex; align-items:center; gap:24px; }
        .nav-text-btn { font-size:13px; color:var(--muted); background:none; border:none; cursor:pointer; font-family:'Noto Sans JP',sans-serif; transition:color 0.2s; }
        .nav-text-btn:hover { color:var(--text); }
        .nav-solid-btn { font-size:12px; font-weight:500; color:white; background:var(--text); border:none; padding:8px 20px; cursor:pointer; font-family:'Noto Sans JP',sans-serif; text-decoration:none; transition:opacity 0.2s; letter-spacing:0.5px; }
        .nav-solid-btn:hover { opacity:0.75; }

        .home-wrap { max-width:1100px; margin:0 auto; padding:60px 40px; }
        @media(max-width:768px){ .home-wrap { padding:40px 20px; } }

        .home-header { margin-bottom:48px; }
        .home-title { font-size:clamp(24px,3vw,36px); font-weight:900; color:var(--text); letter-spacing:-1px; margin-bottom:8px; }
        .home-sub { font-size:13px; color:var(--muted); }

        .books-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:2px; background:var(--line); }

        .book-card { background:var(--bg); padding:32px 28px; transition:background 0.2s; text-decoration:none; display:block; }
        .book-card:hover { background:var(--bg2); }

        .book-week-tag {
          display:inline-block; font-size:10px; font-weight:500; letter-spacing:2px;
          padding:3px 10px; margin-bottom:16px;
        }
        .tag-reading { background:rgba(59,91,219,0.08); color:var(--blue); }
        .tag-open { background:rgba(217,79,61,0.08); color:var(--red); }
        .tag-closed { background:var(--bg3); color:var(--muted); }

        .book-title { font-size:17px; font-weight:700; color:var(--text); margin-bottom:6px; letter-spacing:-0.3px; line-height:1.4; }
        .book-author { font-size:13px; color:var(--muted); margin-bottom:20px; }
        .book-footer { display:flex; justify-content:space-between; align-items:center; }
        .book-week-label { font-size:11px; color:var(--muted); letter-spacing:1px; }
        .book-arrow { font-size:13px; color:var(--muted); transition:transform 0.2s; }
        .book-card:hover .book-arrow { transform:translateX(4px); }

        .empty-state { text-align:center; padding:80px 20px; color:var(--muted); font-size:14px; line-height:2; }
        .empty-state strong { display:block; font-size:18px; font-weight:700; color:var(--text); margin-bottom:8px; }

        .loading-state { text-align:center; padding:80px 20px; color:var(--muted); font-size:13px; letter-spacing:2px; }
      `}</style>

      <nav className="home-nav">
        <Link href="/home" className="home-logo">カタリバ</Link>
        <div className="home-nav-right">
          <Link href="/request" className="nav-text-btn" style={{textDecoration:"none"}}>リクエスト</Link>
          <Link href="/ranking" className="nav-text-btn" style={{textDecoration:"none"}}>ランキング</Link>
          <Link href="/profile" className="nav-text-btn" style={{textDecoration:"none"}}>プロフィール</Link>
          {userData?.isPremium ? null : (
            <Link href="/premium" className="nav-solid-btn">プレミアム</Link>
          )}
          <button className="nav-text-btn" onClick={handleSignOut}>ログアウト</button>
        </div>
      </nav>

      <div className="home-wrap">
        <div className="home-header">
          <h1 className="home-title">討論中の本</h1>
          <p className="home-sub">常時8〜10冊が並走。いつ来ても必ず参加できる本がある。</p>
        </div>

        {loading ? (
          <p className="loading-state">読み込み中</p>
        ) : books.length === 0 ? (
          <div className="empty-state">
            <strong>準備中</strong>
            まもなく最初の本が発表されます。
          </div>
        ) : (
          <div className="books-grid">
            {books.map((book) => (
              <Link key={book.id} href={`/book/${book.id}`} className="book-card">
                <span className={`book-week-tag ${
                  book.status === "reading" ? "tag-reading" :
                  book.status === "open" ? "tag-open" : "tag-closed"
                }`}>
                  {book.status === "reading" ? "WEEK 1 · 読書中" :
                   book.status === "open" ? "WEEK 2 · 討論中" : "CLOSED"}
                </span>
                <div className="book-title">{book.title}</div>
                <div className="book-author">{book.author}</div>
                <div className="book-footer">
                  <span className="book-week-label">Week {book.week}</span>
                  <span className="book-arrow">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

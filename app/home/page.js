"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, getCountFromServer } from "firebase/firestore";
import AppNav from "@/components/AppNav";

function daysUntilNextSaturday() {
  const now = new Date();
  const day = now.getDay();
  return day === 6 ? 7 : 6 - day;
}

export default function HomePage() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeGenre, setActiveGenre] = useState("すべて");

  useEffect(() => {
    if (user === null) router.push("/login");
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    async function fetchBooks() {
      const q = query(collection(db, "books"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const booksData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const withCounts = await Promise.all(
        booksData.map(async (book) => {
          const countSnap = await getCountFromServer(collection(db, "books", book.id, "comments"));
          return { ...book, commentCount: countSnap.data().count };
        })
      );
      setBooks(withCounts);
      setLoading(false);
    }
    fetchBooks();
  }, [user]);

  if (user === undefined) return null;

  const activeBooks = books.filter((b) => b.status !== "closed");
  const genres = ["すべて", ...Array.from(new Set(activeBooks.map((b) => b.genre).filter(Boolean)))];
  const filtered = activeGenre === "すべて" ? activeBooks : activeBooks.filter((b) => b.genre === activeGenre);

  return (
    <>
      <style>{`
        .home-wrap { max-width:1100px; margin:0 auto; padding:60px 40px; }
        @media(max-width:768px){ .home-wrap { padding:32px 16px; } }

        .home-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }
        .home-title { font-size:clamp(22px,3vw,36px); font-weight:900; color:var(--text); letter-spacing:-1px; margin-bottom:8px; }
        .home-sub { font-size:13px; color:var(--muted); }
        .home-archive-link { font-size:13px; color:var(--muted); text-decoration:none; white-space:nowrap; transition:color 0.2s; padding-top:8px; }
        .home-archive-link:hover { color:var(--text); }

        .genre-tabs { display:flex; gap:0; flex-wrap:wrap; margin-bottom:24px; border-bottom:1px solid var(--line); }
        .genre-tab { font-size:12px; padding:8px 16px; background:none; border:none; cursor:pointer; color:var(--muted); font-family:'Noto Sans JP',sans-serif; border-bottom:2px solid transparent; transition:all 0.15s; white-space:nowrap; }
        .genre-tab:hover { color:var(--text); }
        .genre-tab.active { color:var(--text); font-weight:700; border-bottom-color:var(--text); }

        .books-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:2px; background:var(--line); }
        @media(max-width:600px){ .books-grid { grid-template-columns:1fr; } }

        .book-card { background:var(--bg); padding:20px 24px 24px; transition:background 0.2s; text-decoration:none; display:block; }
        .book-card:hover { background:var(--bg2); }

        .book-card-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
        .book-week-tag { display:inline-block; font-size:10px; font-weight:500; letter-spacing:2px; padding:3px 10px; }
        .tag-reading { background:rgba(59,91,219,0.08); color:var(--blue); }
        .tag-open { background:rgba(217,79,61,0.08); color:var(--red); }
        .tag-closed { background:var(--bg3); color:var(--muted); }
        .book-genre-tag { font-size:10px; color:var(--muted); letter-spacing:1px; }

        .book-card-body { display:flex; gap:16px; align-items:flex-start; }
        .book-cover { width:64px; flex-shrink:0; }
        .book-cover img { width:64px; height:90px; object-fit:cover; display:block; }
        .book-cover-empty { width:64px; height:90px; background:var(--bg3); }
        .book-card-info { flex:1; min-width:0; }

        .book-title { font-size:16px; font-weight:700; color:var(--text); margin-bottom:4px; letter-spacing:-0.3px; line-height:1.4; }
        .book-author { font-size:13px; color:var(--muted); margin-bottom:12px; }

        .book-footer { display:flex; justify-content:space-between; align-items:center; }
        .book-post-count { font-size:12px; color:var(--muted); }
        .book-post-count strong { color:var(--text); font-weight:700; font-family:'DM Sans',sans-serif; font-size:14px; }
        .book-post-count.has-posts strong { color:var(--red); }
        .book-arrow { font-size:13px; color:var(--muted); transition:transform 0.2s; }
        .book-card:hover .book-arrow { transform:translateX(4px); }
        .book-countdown { font-size:11px; color:var(--muted); margin-bottom:12px; letter-spacing:0.3px; }
        .book-countdown span { font-weight:700; color:var(--text); font-family:'DM Sans',sans-serif; font-size:13px; }

        .empty-state { text-align:center; padding:80px 20px; color:var(--muted); font-size:14px; line-height:2; }
        .empty-state strong { display:block; font-size:18px; font-weight:700; color:var(--text); margin-bottom:8px; }
        .loading-state { text-align:center; padding:80px 20px; color:var(--muted); font-size:13px; letter-spacing:2px; }
      `}</style>

      <AppNav />

      <div className="home-wrap">
        <div className="home-header">
          <div>
            <h1 className="home-title">討論中の本</h1>
            <p className="home-sub">読む。書く。討論する。</p>
          </div>
          <Link href="/archive" className="home-archive-link">過去ログ →</Link>
        </div>

        {!loading && genres.length > 1 && (
          <div className="genre-tabs">
            {genres.map((g) => (
              <button
                key={g}
                className={`genre-tab${activeGenre === g ? " active" : ""}`}
                onClick={() => setActiveGenre(g)}
              >
                {g}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <p className="loading-state">読み込み中</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <strong>準備中</strong>
            まもなく最初の本が発表されます。
          </div>
        ) : (
          <div className="books-grid">
            {filtered.map((book) => (
              <Link key={book.id} href={`/book/${book.slug || book.id}`} className="book-card">
                <div className="book-card-top">
                  <span className={`book-week-tag ${
                    book.status === "reading" ? "tag-reading" :
                    book.status === "open" ? "tag-open" : "tag-closed"
                  }`}>
                    {book.status === "reading" ? "WEEK 1 · 読書中" :
                     book.status === "open" ? "WEEK 2 · 討論中" : "CLOSED"}
                  </span>
                  {book.genre && <span className="book-genre-tag">{book.genre}</span>}
                </div>
                <div className="book-card-body">
                  <div className="book-cover">
                    {book.coverUrl
                      ? <img src={book.coverUrl} alt={book.title} />
                      : <div className="book-cover-empty" />
                    }
                  </div>
                  <div className="book-card-info">
                    <div className="book-title">{book.title}</div>
                    <div className="book-author">{book.author}</div>
                    {book.status === "reading" && (
                      <div className="book-countdown">開館まであと <span>{daysUntilNextSaturday()}</span> 日</div>
                    )}
                    {book.status === "open" && (
                      <div className="book-countdown">閉館まであと <span>{daysUntilNextSaturday()}</span> 日</div>
                    )}
                    <div className="book-footer">
                      <span className={`book-post-count${book.commentCount > 0 ? " has-posts" : ""}`}>
                        <strong>{book.commentCount}</strong> 人が投稿中
                      </span>
                      <span className="book-arrow">→</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

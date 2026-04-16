"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, getCountFromServer } from "firebase/firestore";
import AppNav from "@/components/AppNav";

export default function ArchivePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user === undefined) return;
    async function fetch() {
      const q = query(collection(db, "threads"), where("status", "==", "closed"));
      const snap = await getDocs(q);
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.created_at?.seconds || 0) - (a.createdAt?.seconds || 0));
      const withCounts = await Promise.all(
        list.map(async (book) => {
          const c = await getCountFromServer(collection(db, "threads", book.id, "comments"));
          return { ...book, commentCount: c.data().count };
        })
      );
      setBooks(withCounts);
      setLoading(false);
    }
    fetch();
  }, [user]);

  if (user === undefined) return null; // auth確認中のみnull

  return (
    <>
      <style>{`
        .arc-wrap { max-width:1100px; margin:0 auto; padding:60px 40px; }
        @media(max-width:768px){ .arc-wrap { padding:40px 16px; } }

        .arc-heading { font-size:clamp(22px,3vw,36px); font-weight:900; color:var(--text); letter-spacing:-1px; margin-bottom:8px; }
        .arc-sub { font-size:13px; color:var(--muted); margin-bottom:48px; line-height:1.9; }

        .arc-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:2px; background:var(--line); }
        @media(max-width:600px){ .arc-grid { grid-template-columns:1fr; } }

        .arc-card { background:var(--bg); padding:20px 24px 24px; text-decoration:none; display:block; transition:background 0.2s; }
        .arc-card:hover { background:var(--bg2); }

        .arc-card-top { margin-bottom:14px; }
        .arc-closed-tag { font-size:10px; font-weight:500; letter-spacing:2px; padding:3px 10px; background:var(--bg3); color:var(--muted); display:inline-block; }

        .arc-card-body { display:flex; gap:16px; align-items:flex-start; }
        .arc-cover { width:64px; flex-shrink:0; }
        .arc-cover img { width:64px; height:90px; object-fit:cover; display:block; }
        .arc-cover-empty { width:64px; height:90px; background:var(--bg3); }
        .arc-info { flex:1; min-width:0; }
        .arc-title { font-size:16px; font-weight:700; color:var(--text); margin-bottom:4px; letter-spacing:-0.3px; line-height:1.4; }
        .arc-author { font-size:13px; color:var(--muted); margin-bottom:12px; }
        .arc-footer { display:flex; justify-content:space-between; align-items:center; }
        .arc-count { font-size:12px; color:var(--muted); }
        .arc-count strong { color:var(--text); font-weight:700; font-family:'DM Sans',sans-serif; font-size:14px; }
        .arc-arrow { font-size:13px; color:var(--muted); transition:transform 0.2s; }
        .arc-card:hover .arc-arrow { transform:translateX(4px); }

        .arc-empty { text-align:center; padding:80px 20px; color:var(--muted); font-size:14px; line-height:2; }
        .arc-loading { text-align:center; padding:80px 20px; color:var(--muted); font-size:13px; letter-spacing:2px; }
      `}</style>

      <AppNav />

      <div className="arc-wrap">
        <h1 className="arc-heading">アーカイブ</h1>
        <p className="arc-sub">過去の討論ログを閲覧できます。</p>

        {loading ? (
          <p className="arc-loading">読み込み中</p>
        ) : books.length === 0 ? (
          <div className="arc-empty">まだアーカイブされた討論はありません。</div>
        ) : (
          <div className="arc-grid">
            {books.map((book) => (
              <Link key={book.id} href={`/archive/${book.slug || book.id}`} className="arc-card">
                <div className="arc-card-top">
                  <span className="arc-closed-tag">CLOSED</span>
                </div>
                <div className="arc-card-body">
                  <div className="arc-cover">
                    {book.coverUrl
                      ? <img src={book.coverUrl} alt={book.title} />
                      : <div className="arc-cover-empty" />
                    }
                  </div>
                  <div className="arc-info">
                    <div className="arc-title">{book.title}</div>
                    <div className="arc-author">{book.author}</div>
                    <div className="arc-footer">
                      <span className="arc-count"><strong>{book.commentCount}</strong> 件の投稿</span>
                      <span className="arc-arrow">→</span>
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

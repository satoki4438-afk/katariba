"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs, query, where, limit } from "firebase/firestore";
import AppNav from "@/components/AppNav";

export default function BookPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { slug } = useParams();
  const [book, setBook] = useState(null);
  const [bookId, setBookId] = useState(null);
  const [commentCount, setCommentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [descOpen, setDescOpen] = useState(false);

  useEffect(() => {
    if (user === null) router.push("/login");
  }, [user, router]);

  useEffect(() => {
    if (!user || !slug) return;
    async function resolve() {
      const decodedSlug = decodeURIComponent(slug);
      let bookDoc;
      const q = query(collection(db, "threads"), where("slug", "==", decodedSlug), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        bookDoc = snap.docs[0];
      } else {
        const direct = await getDoc(doc(db, "threads", decodedSlug));
        if (!direct.exists()) { router.push("/home"); return; }
        bookDoc = direct;
      }
      const data = { id: bookDoc.id, ...bookDoc.data() };
      setBook(data);
      setBookId(bookDoc.id);
      const cSnap = await getDocs(collection(db, "threads", bookDoc.id, "comments"));
      setCommentCount(cSnap.size);
      setLoading(false);
    }
    resolve();
  }, [user, slug, router]);

  if (user === undefined || loading || !book) return null;

  const statusLabel = book.status === "week1" ? "WEEK 1 · 読書中" :
                      book.status === "week2" ? "WEEK 2 · 討論中" : "CLOSED";
  const statusColor = book.status === "week1" ? "var(--blue)" :
                      book.status === "week2" ? "var(--red)" : "var(--muted)";

  return (
    <>
      <style>{`
        .book-wrap { max-width:800px; margin:0 auto; padding:60px 40px; }
        @media(max-width:768px){ .book-wrap { padding:40px 20px; } }
        .book-status-tag {
          display:inline-block; font-size:10px; font-weight:500; letter-spacing:2px;
          padding:4px 12px; border:1px solid; margin-bottom:24px;
        }
        .book-header { display:flex; gap:24px; align-items:flex-start; margin-bottom:12px; }
        .book-header-cover { flex-shrink:0; }
        .book-header-cover img { width:80px; height:112px; object-fit:cover; display:block; border:1px solid var(--line); }
        .book-header-cover-empty { width:80px; height:112px; background:var(--bg3); }
        .book-header-body { flex:1; min-width:0; }
        .book-detail-title { font-size:clamp(24px,4vw,40px); font-weight:900; color:var(--text); letter-spacing:-1.5px; line-height:1.2; margin-bottom:10px; }
        .book-detail-author { font-size:15px; color:var(--muted); margin-bottom:12px; }
        .book-desc-toggle { background:none; border:none; cursor:pointer; font-size:13px; color:var(--blue); font-family:'Noto Sans JP',sans-serif; padding:0; }
        .book-desc-text { font-size:13px; color:var(--muted); line-height:1.9; margin-top:10px; }
        .book-meta-row { display:flex; gap:40px; padding:24px 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line); margin-bottom:40px; margin-top:28px; }
        .book-meta-label { font-size:10px; letter-spacing:2px; color:var(--muted); margin-bottom:6px; }
        .book-meta-value { font-size:16px; font-weight:700; color:var(--text); }
        .book-week-note {
          background:var(--bg2); border:1px solid var(--line); padding:20px 24px;
          font-size:13px; color:var(--muted); line-height:1.9; margin-bottom:40px;
        }
        .book-week-note strong { color:var(--text); font-weight:500; }
        .btn-chat {
          display:inline-block; background:var(--text); color:white;
          padding:16px 48px; font-size:14px; font-weight:500; letter-spacing:0.5px;
          text-decoration:none; transition:opacity 0.2s;
        }
        .btn-chat:hover { opacity:0.75; }
        .back-link { font-size:13px; color:var(--muted); text-decoration:none; display:inline-flex; align-items:center; gap:6px; margin-bottom:32px; transition:color 0.2s; }
        .back-link:hover { color:var(--text); }
        .amazon-link { display:inline-block; margin-top:20px; font-size:13px; color:var(--blue); text-decoration:none; border-bottom:1px solid var(--blue); padding-bottom:1px; }
      `}</style>

      <AppNav />

      <div className="book-wrap">
        <Link href="/home" className="back-link">← ホームに戻る</Link>

        <span className="book-status-tag" style={{color:statusColor, borderColor:statusColor}}>
          {statusLabel}
        </span>

        <div className="book-header">
          <div className="book-header-cover">
            {book.coverUrl
              ? <img src={book.coverUrl} alt={book.title} />
              : <div className="book-header-cover-empty" />
            }
          </div>
          <div className="book-header-body">
            <h1 className="book-detail-title">{book.title}</h1>
            <p className="book-detail-author">{book.author}</p>
            {book.description && (
              <>
                <button className="book-desc-toggle" onClick={() => setDescOpen((v) => !v)}>
                  {descOpen ? "△ 閉じる" : "▽ あらすじ"}
                </button>
                {descOpen && <p className="book-desc-text">{book.description}</p>}
              </>
            )}
          </div>
        </div>

        <div className="book-meta-row">
          <div className="book-meta-item">
            <div className="book-meta-label">WEEK</div>
            <div className="book-meta-value">{book.week}</div>
          </div>
          <div className="book-meta-item">
            <div className="book-meta-label">投稿数</div>
            <div className="book-meta-value">{commentCount}</div>
          </div>
        </div>

        <div className="book-week-note">
          {book.status === "week1" ? (
            <><strong>Week 1（読書期間）</strong><br />自分の投稿は保存されますが、Week 2開始まで他の人には見えません。じっくり読みながら感想を残してください。</>
          ) : book.status === "week2" ? (
            <><strong>Week 2（討論期間）</strong><br />全コメントが解放されました。他の人の感想を読んで、リプライやいいねでやり取りしてください。</>
          ) : (
            <><strong>クローズ</strong><br />この本の討論期間は終了しました。過去ログは閲覧できます。</>
          )}
        </div>

        <Link href={`/book/${slug}/chat`} className="btn-chat">
          {book.status === "week1" ? "投稿する" : "討論スレを見る"}
        </Link>

        {book.rakutenUrl && (
          <div>
            <a href={book.rakutenUrl} target="_blank" rel="noopener noreferrer" className="amazon-link">
              楽天ブックスで見る →
            </a>
          </div>
        )}
      </div>
    </>
  );
}

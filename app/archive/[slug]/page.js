"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, query, orderBy, where, limit, getDocs } from "firebase/firestore";
import AppNav from "@/components/AppNav";

const FREE_LIMIT = 50;

export default function ArchiveBookPage() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const { slug } = useParams();
  const [book, setBook] = useState(null);
  const [bookId, setBookId] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [replies, setReplies] = useState({});

  useEffect(() => {
    if (user === undefined || !slug) return;
    async function resolve() {
      const decodedSlug = decodeURIComponent(slug);
      let bookDoc;
      const q = query(collection(db, "books"), where("slug", "==", decodedSlug), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        bookDoc = snap.docs[0];
      } else {
        const direct = await getDoc(doc(db, "books", decodedSlug));
        if (!direct.exists()) { router.push("/archive"); return; }
        bookDoc = direct;
      }
      const bookData = { id: bookDoc.id, ...bookDoc.data() };
      const id = bookDoc.id;
      if (bookData.status !== "closed") { router.push(`/book/${bookData.slug || slug}`); return; }
      setBook(bookData);
      setBookId(id);

      const cq = query(collection(db, "books", id, "comments"), orderBy("createdAt", "asc"));
      const cSnap = await getDocs(cq);
      const all = cSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((c) => c.visible !== false);
      setComments(all.map((c, i) => ({ ...c, num: i + 1 })));
      setLoading(false);
    }
    resolve();
  }, [user, slug, router]);

  async function loadReplies(commentId) {
    const q = query(
      collection(db, "books", bookId, "comments", commentId, "replies"),
      orderBy("createdAt", "asc")
    );
    const snap = await getDocs(q);
    setReplies((prev) => ({ ...prev, [commentId]: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }));
  }

  function toggleExpand(commentId) {
    setExpanded((prev) => {
      const next = { ...prev, [commentId]: !prev[commentId] };
      if (next[commentId] && !replies[commentId]) loadReplies(commentId);
      return next;
    });
  }

  if (loading) return null;

  const isPremium = userData?.isPremium;
  const visibleComments = isPremium ? comments : comments.slice(0, FREE_LIMIT);
  const isLimited = !isPremium && comments.length > FREE_LIMIT;

  return (
    <>
      <style>{`
        .alog-layout { display:flex; flex-direction:column; min-height:100vh; }

        .alog-header {
          padding:16px 40px; border-bottom:1px solid var(--line);
          background:white; position:sticky; top:56px; z-index:50;
        }
        @media(max-width:768px){ .alog-header { padding:14px 16px; top:56px; } }
        .alog-book-title { font-size:15px; font-weight:700; color:var(--text); letter-spacing:-0.3px; }
        .alog-book-author { font-size:12px; color:var(--muted); }
        .alog-header-inner { display:flex; justify-content:space-between; align-items:center; }
        .alog-closed-tag { font-size:10px; font-weight:500; letter-spacing:2px; padding:3px 10px; background:var(--bg3); color:var(--muted); }
        .alog-back { font-size:13px; color:var(--muted); text-decoration:none; transition:color 0.2s; }
        .alog-back:hover { color:var(--text); }

        .alog-body { flex:1; padding:24px 40px 60px; background:var(--bg2); }
        @media(max-width:768px){ .alog-body { padding:16px 16px 60px; } }

        .alog-count { font-size:12px; color:var(--muted); letter-spacing:1px; margin-bottom:16px; }

        .alog-comment {
          background:white; border-left:2px solid transparent;
          padding:16px 20px; margin-bottom:2px;
        }
        .alog-comment-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
        .alog-comment-id { font-size:11px; color:var(--muted); }
        .alog-comment-num { font-family:'DM Sans',sans-serif; font-size:11px; font-weight:600; color:var(--muted); margin-right:8px; }
        .alog-comment-text { font-size:14px; color:var(--text); line-height:1.9; white-space:pre-wrap; }
        .alog-comment-footer { display:flex; align-items:center; gap:16px; margin-top:10px; }
        .alog-like-count { font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; color:var(--red); margin-left:auto; }
        .alog-expand-btn {
          font-size:11px; color:var(--blue); background:none; border:none;
          cursor:pointer; font-family:'Noto Sans JP',sans-serif; padding:0;
        }

        .alog-replies-wrap { margin-top:8px; padding-left:16px; border-left:1px solid var(--line); }
        .alog-reply-item { padding:10px 0; border-bottom:1px solid var(--bg2); }
        .alog-reply-item:last-child { border-bottom:none; }
        .alog-reply-id { font-size:10px; color:var(--muted); margin-bottom:4px; }
        .alog-reply-anchor { color:var(--blue); font-weight:500; font-size:12px; }
        .alog-reply-text { font-size:13px; color:var(--text); line-height:1.8; }

        .alog-gate {
          background:white; border:1px solid var(--line);
          padding:32px 28px; text-align:center; margin-top:2px;
        }
        .alog-gate-title { font-size:16px; font-weight:700; color:var(--text); margin-bottom:8px; letter-spacing:-0.3px; }
        .alog-gate-sub { font-size:13px; color:var(--muted); line-height:1.9; margin-bottom:20px; }
        .alog-gate-btn {
          display:inline-block; background:var(--text); color:white;
          padding:13px 36px; font-size:13px; font-weight:500; text-decoration:none;
          letter-spacing:0.5px; transition:opacity 0.2s;
        }
        .alog-gate-btn:hover { opacity:0.75; }
      `}</style>

      <AppNav />

      <div className="alog-layout">
        <div className="alog-header">
          <div className="alog-header-inner">
            <div>
              <div className="alog-book-title">{book.title}</div>
              <div className="alog-book-author">{book.author}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:16}}>
              <span className="alog-closed-tag">CLOSED</span>
              <Link href="/archive" className="alog-back">← アーカイブ</Link>
            </div>
          </div>
        </div>

        <div className="alog-body">
          <p className="alog-count">{comments.length} 件の投稿</p>

          {visibleComments.map((c) => (
            <div key={c.id} className="alog-comment">
              <div className="alog-comment-header">
                <div>
                  <span className="alog-comment-num">{c.num}</span>
                  <span className="alog-comment-id">{c.anonymousId}</span>
                </div>
              </div>
              <div className="alog-comment-text">{c.text}</div>
              <div className="alog-comment-footer">
                {c.replyCount > 0 && (
                  <button className="alog-expand-btn" onClick={() => toggleExpand(c.id)}>
                    {expanded[c.id] ? "閉じる" : `返信 ${c.replyCount}件`}
                  </button>
                )}
                {c.likeCount > 0 && (
                  <span className="alog-like-count">♥ {c.likeCount}</span>
                )}
              </div>

              {expanded[c.id] && replies[c.id] && (
                <div className="alog-replies-wrap">
                  {replies[c.id].map((r) => (
                    <div key={r.id} className="alog-reply-item">
                      <div className="alog-reply-id">
                        <span className="alog-reply-anchor">&gt;&gt;{r.anchorNum}</span>　{r.anonymousId}
                      </div>
                      <div className="alog-reply-text">{r.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isLimited && (
            <div className="alog-gate">
              <div className="alog-gate-title">続きを読むにはプレミアムが必要です</div>
              <div className="alog-gate-sub">
                無料会員は {FREE_LIMIT} 件まで閲覧可能です。<br />
                プレミアム会員になると全 {comments.length} 件の討論ログが読めます。
              </div>
              <Link href="/premium" className="alog-gate-btn">プレミアムにアップグレード</Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

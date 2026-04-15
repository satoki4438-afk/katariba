"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc, getDoc, setDoc, collection, query, orderBy, where, limit, onSnapshot,
  addDoc, updateDoc, increment, serverTimestamp, getDocs
} from "firebase/firestore";
import AppNav from "@/components/AppNav";

function hashAnonymousId(userId, bookId) {
  let h = 0;
  const s = userId + bookId;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  const idx = Math.abs(h) % 26;
  return "匿名" + String.fromCharCode(65 + idx);
}

export default function ChatPage() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const { slug } = useParams();
  const [book, setBook] = useState(null);
  const [bookId, setBookId] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [replies, setReplies] = useState({});
  const [liked, setLiked] = useState({});
  const bottomRef = useRef(null);

  useEffect(() => {
    if (user === null) router.push("/login");
  }, [user, router]);

  useEffect(() => {
    if (!user || !slug) return;
    async function resolve() {
      const decodedSlug = decodeURIComponent(slug);
      let bookDoc;
      const q = query(collection(db, "books"), where("slug", "==", decodedSlug), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        bookDoc = snap.docs[0];
      } else {
        const direct = await getDoc(doc(db, "books", decodedSlug));
        if (!direct.exists()) { router.push("/home"); return; }
        bookDoc = direct;
      }
      const data = { id: bookDoc.id, ...bookDoc.data() };
      if (data.status === "closed") { router.push(`/archive/${data.slug || slug}`); return; }
      setBook(data);
      setBookId(bookDoc.id);
    }
    resolve();
  }, [user, slug, router]);

  useEffect(() => {
    if (!user || !bookId) return;
    async function loadLiked() {
      const snap = await getDocs(collection(db, "likes", user.uid, "targets"));
      const likedIds = {};
      snap.docs.forEach((d) => {
        (d.data().commentIds || []).forEach((cid) => { likedIds[cid] = true; });
      });
      setLiked(likedIds);
    }
    loadLiked();
  }, [user, bookId]);

  useEffect(() => {
    if (!user || !bookId) return;
    const q = query(collection(db, "books", bookId, "comments"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const visible = all.filter((c) => c.visible || c.userId === user.uid);
      setComments(visible.map((c, i) => ({ ...c, num: i + 1 })));
    });
    return unsub;
  }, [user, bookId]);

  async function loadReplies(commentId) {
    const q = query(collection(db, "books", bookId, "comments", commentId, "replies"), orderBy("createdAt", "asc"));
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

  async function handleLike(comment) {
    if (!user || liked[comment.id]) return;
    if (comment.userId === user.uid) return;
    setLiked((prev) => ({ ...prev, [comment.id]: true }));
    const ref = doc(db, "books", bookId, "comments", comment.id);
    await updateDoc(ref, { likeCount: increment(1) });
    const likeRef = doc(db, "likes", user.uid, "targets", comment.userId);
    const snap = await getDoc(likeRef);
    if (snap.exists()) {
      const existing = snap.data();
      await updateDoc(likeRef, {
        count: increment(1),
        bookIds: [...(existing.bookIds || []), bookId],
        commentIds: [...(existing.commentIds || []), comment.id],
      });
    } else {
      await setDoc(likeRef, { count: 1, bookIds: [bookId], commentIds: [comment.id] });
    }
  }

  async function handlePost() {
    if (!text.trim() || posting) return;
    setPosting(true);
    const anonymousId = hashAnonymousId(user.uid, bookId);
    const isOpen = book?.status === "open";

    if (replyTo) {
      await addDoc(collection(db, "books", bookId, "comments", replyTo.id, "replies"), {
        userId: user.uid,
        anonymousId,
        text: text.trim(),
        anchorNum: replyTo.num,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "books", bookId, "comments", replyTo.id), {
        replyCount: increment(1),
      });
      loadReplies(replyTo.id);
      setExpanded((prev) => ({ ...prev, [replyTo.id]: true }));
    } else {
      await addDoc(collection(db, "books", bookId, "comments"), {
        userId: user.uid,
        anonymousId,
        text: text.trim(),
        visible: isOpen,
        weekNum: book?.week || 1,
        likeCount: 0,
        createdAt: serverTimestamp(),
      });
    }

    setText("");
    setReplyTo(null);
    setPosting(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 300);
  }

  if (user === undefined || !book) return null;

  return (
    <>
      <style>{`
        .chat-layout { display:flex; flex-direction:column; height:100vh; }
        .chat-header {
          padding:16px 40px; border-bottom:1px solid var(--line);
          display:flex; justify-content:space-between; align-items:center;
          background:white; flex-shrink:0;
        }
        @media(max-width:768px){ .chat-header { padding:14px 16px; } }
        .chat-book-title { font-size:15px; font-weight:700; color:var(--text); letter-spacing:-0.3px; }
        .chat-book-author { font-size:12px; color:var(--muted); }
        .chat-status {
          font-size:10px; font-weight:500; letter-spacing:2px; padding:3px 10px;
        }
        .status-reading { background:rgba(59,91,219,0.08); color:var(--blue); }
        .status-open { background:rgba(217,79,61,0.08); color:var(--red); }
        .status-closed { background:var(--bg3); color:var(--muted); }

        .chat-body { flex:1; overflow-y:auto; padding:24px 40px; background:var(--bg2); }
        @media(max-width:768px){ .chat-body { padding:16px; } }

        .chat-week-notice {
          background:white; border:1px solid var(--line); padding:16px 20px;
          font-size:13px; color:var(--muted); line-height:1.8; margin-bottom:20px;
        }
        .chat-week-notice strong { color:var(--text); }

        .comment {
          background:white; border-left:2px solid transparent;
          padding:16px 20px; margin-bottom:2px;
        }
        .comment.own { border-left-color:var(--blue); }
        .comment-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
        .comment-id { font-size:11px; color:var(--muted); }
        .comment-num { font-family:'DM Sans',sans-serif; font-size:11px; font-weight:600; color:var(--muted); margin-right:8px; }
        .comment-text { font-size:14px; color:var(--text); line-height:1.9; white-space:pre-wrap; }
        .comment-anchor { color:var(--blue); font-weight:500; }
        .comment-footer { display:flex; align-items:center; gap:16px; margin-top:10px; }
        .like-count { font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; color:var(--red); margin-left:auto; }
        .like-btn {
          font-size:12px; color:var(--muted); background:none; border:none;
          cursor:pointer; font-family:'Noto Sans JP',sans-serif; transition:color 0.2s;
          display:flex; align-items:center; gap:4px; padding:0;
        }
        .like-btn:hover { color:var(--red); }
        .reply-btn {
          font-size:12px; color:var(--muted); background:none; border:none;
          cursor:pointer; font-family:'Noto Sans JP',sans-serif; transition:color 0.2s; padding:0;
        }
        .reply-btn:hover { color:var(--text); }
        .expand-btn {
          font-size:11px; color:var(--blue); background:none; border:none;
          cursor:pointer; font-family:'Noto Sans JP',sans-serif; padding:0;
        }

        .replies-wrap { margin-top:8px; padding-left:16px; border-left:1px solid var(--line); }
        .reply-item { padding:10px 0; border-bottom:1px solid var(--bg2); }
        .reply-item:last-child { border-bottom:none; }
        .reply-id { font-size:10px; color:var(--muted); margin-bottom:4px; }
        .reply-anchor { color:var(--blue); font-weight:500; font-size:12px; }
        .reply-text { font-size:13px; color:var(--text); line-height:1.8; }

        .chat-input-area {
          padding:16px 40px; border-top:1px solid var(--line); background:white; flex-shrink:0;
        }
        @media(max-width:768px){ .chat-input-area { padding:12px 16px; } }
        .reply-indicator {
          font-size:12px; color:var(--blue); margin-bottom:8px;
          display:flex; justify-content:space-between; align-items:center;
        }
        .reply-cancel { background:none; border:none; color:var(--muted); cursor:pointer; font-size:12px; }
        .input-row { display:flex; gap:8px; }
        .chat-textarea {
          flex:1; border:1px solid var(--line); padding:12px 16px;
          font-size:14px; font-family:'Noto Sans JP',sans-serif; resize:none;
          line-height:1.7; outline:none; color:var(--text); background:var(--bg2);
          min-height:48px; max-height:160px;
        }
        .chat-textarea:focus { border-color:var(--text); background:white; }
        .post-btn {
          background:var(--text); color:white; border:none; padding:0 24px;
          font-size:13px; font-weight:500; cursor:pointer; font-family:'Noto Sans JP',sans-serif;
          transition:opacity 0.2s; letter-spacing:0.5px; white-space:nowrap;
        }
        .post-btn:hover { opacity:0.75; }
        .post-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .week1-own-note { font-size:11px; color:var(--blue); margin-top:8px; }

        .back-link-chat { font-size:13px; color:var(--muted); text-decoration:none; }
        .back-link-chat:hover { color:var(--text); }
        .rakuten-link-chat { font-size:12px; color:var(--blue); text-decoration:none; white-space:nowrap; }
        .rakuten-link-chat:hover { text-decoration:underline; }
        @media(max-width:640px){ .rakuten-link-chat { display:none; } }
      `}</style>

      <div className="chat-layout">
        <AppNav />

        <div className="chat-header">
          <div>
            <div className="chat-book-title">{book.title}</div>
            <div className="chat-book-author">{book.author}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            {book.rakutenUrl && (
              <a href={book.rakutenUrl} target="_blank" rel="noopener noreferrer" className="rakuten-link-chat">
                この本を読む →
              </a>
            )}
            <span className={`chat-status ${
              book.status === "reading" ? "status-reading" :
              book.status === "open" ? "status-open" : "status-closed"
            }`}>
              {book.status === "reading" ? "WEEK 1" : book.status === "open" ? "WEEK 2" : "CLOSED"}
            </span>
            <Link href={`/book/${slug}`} className="back-link-chat">← 詳細</Link>
          </div>
        </div>

        <div className="chat-body">
          {book.status === "reading" && (
            <div className="chat-week-notice">
              <strong>Week 1（読書期間）</strong>　あなたの投稿はWeek 2開始まで自分にしか見えません。
            </div>
          )}

          {comments.length === 0 && (
            <div style={{textAlign:"center",padding:"60px 20px",color:"var(--muted)",fontSize:"13px"}}>
              最初の投稿をしてみよう。
            </div>
          )}

          {comments.map((c) => (
            <div key={c.id} className={`comment${c.userId === user.uid ? " own" : ""}`}>
              <div className="comment-header">
                <div>
                  <span className="comment-num">{c.num}</span>
                  <span className="comment-id">{c.anonymousId}{c.userId === user.uid ? "（自分）" : ""}</span>
                </div>
                <span />
              </div>
              <div className="comment-text">{c.text}</div>
              <div className="comment-footer">
                {book.status !== "closed" && c.userId !== user.uid && (
                  <button
                    className="like-btn"
                    onClick={() => handleLike(c)}
                    disabled={!!liked[c.id]}
                    style={liked[c.id] ? {color:"var(--red)",fontWeight:500} : {}}
                  >
                    <span style={{color:"var(--red)"}}>♥</span>
                    {liked[c.id] ? "いいね済み" : "いいね"}
                  </button>
                )}
                {book.status !== "closed" && (
                  <button className="reply-btn" onClick={() => setReplyTo(c)}>&gt;&gt;{c.num} 返信</button>
                )}
                {c.replyCount > 0 && (
                  <button className="expand-btn" onClick={() => toggleExpand(c.id)}>
                    {expanded[c.id] ? "閉じる" : `返信 ${c.replyCount}件`}
                  </button>
                )}
                {(c.likeCount > 0 || liked[c.id]) && (
                  <span className="like-count">♥ {c.likeCount || 0}</span>
                )}
              </div>

              {expanded[c.id] && replies[c.id] && (
                <div className="replies-wrap">
                  {replies[c.id].map((r) => (
                    <div key={r.id} className="reply-item">
                      <div className="reply-id">
                        <span className="reply-anchor">&gt;&gt;{r.anchorNum}</span>　{r.anonymousId}
                      </div>
                      <div className="reply-text">{r.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {book.status !== "closed" && (
          <div className="chat-input-area">
            {replyTo && (
              <div className="reply-indicator">
                <span>&gt;&gt;{replyTo.num} {replyTo.anonymousId} に返信</span>
                <button className="reply-cancel" onClick={() => setReplyTo(null)}>キャンセル</button>
              </div>
            )}
            <div className="input-row">
              <textarea
                className="chat-textarea"
                placeholder={replyTo ? `>>​${replyTo.num} への返信...` : "感想・考えを投稿する..."}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handlePost(); }}
                rows={2}
              />
              <button className="post-btn" onClick={handlePost} disabled={posting || !text.trim()}>
                {posting ? "..." : "投稿"}
              </button>
            </div>
            {book.status === "reading" && (
              <div className="week1-own-note">Week 1：投稿はWeek 2開始まで自分にしか見えません</div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

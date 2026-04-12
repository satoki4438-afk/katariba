"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

export default function AppNav() {
  const { userData } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSignOut() {
    await signOut(auth);
    router.push("/");
  }

  function close() { setMenuOpen(false); }

  return (
    <>
      <style>{`
        .app-nav {
          position:sticky; top:0; z-index:100;
          padding:0 40px; height:56px;
          display:flex; justify-content:space-between; align-items:center;
          background:rgba(255,255,255,0.97); backdrop-filter:blur(10px);
          border-bottom:1px solid var(--line);
        }
        @media(max-width:768px){ .app-nav { padding:0 20px; } }

        .app-nav-logo {
          font-family:'DM Sans',sans-serif; font-size:18px; font-weight:900;
          color:var(--text); text-decoration:none; letter-spacing:-0.5px;
        }

        .app-nav-links {
          display:flex; align-items:center; gap:24px;
        }
        .app-nav-link {
          font-size:13px; color:var(--muted); text-decoration:none;
          background:none; border:none; cursor:pointer;
          font-family:'Noto Sans JP',sans-serif; transition:color 0.2s; padding:0;
        }
        .app-nav-link:hover { color:var(--text); }
        .app-nav-premium {
          font-size:12px; font-weight:500; color:white; background:var(--text);
          padding:7px 18px; text-decoration:none; transition:opacity 0.2s;
        }
        .app-nav-premium:hover { opacity:0.75; }

        /* hamburger */
        .app-nav-hamburger {
          display:none; flex-direction:column; justify-content:center;
          gap:6px; background:none; border:none; cursor:pointer;
          padding:8px; width:40px; height:40px;
        }
        .app-nav-hamburger span {
          display:block; width:22px; height:1.5px; background:var(--text);
          transition:transform 0.25s, opacity 0.25s;
          transform-origin:center;
        }
        .app-nav-hamburger.open span:nth-child(1) { transform:translateY(7.5px) rotate(45deg); }
        .app-nav-hamburger.open span:nth-child(2) { opacity:0; }
        .app-nav-hamburger.open span:nth-child(3) { transform:translateY(-7.5px) rotate(-45deg); }

        @media(max-width:640px){
          .app-nav-links { display:none; }
          .app-nav-hamburger { display:flex; }
        }

        /* mobile menu */
        .app-mobile-menu {
          position:fixed; inset:0; z-index:200;
          background:white;
          display:flex; flex-direction:column;
          transform:translateX(100%);
          transition:transform 0.3s cubic-bezier(0.4,0,0.2,1);
        }
        .app-mobile-menu.open { transform:translateX(0); }

        .app-mobile-header {
          height:56px; padding:0 20px;
          display:flex; justify-content:space-between; align-items:center;
          border-bottom:1px solid var(--line); flex-shrink:0;
        }
        .app-mobile-logo {
          font-family:'DM Sans',sans-serif; font-size:18px; font-weight:900;
          color:var(--text); letter-spacing:-0.5px;
        }
        .app-mobile-close {
          display:flex; flex-direction:column; justify-content:center;
          gap:6px; background:none; border:none; cursor:pointer;
          padding:8px; width:40px; height:40px;
        }
        .app-mobile-close span {
          display:block; width:22px; height:1.5px; background:var(--text);
          transform-origin:center;
        }
        .app-mobile-close span:nth-child(1) { transform:translateY(3.75px) rotate(45deg); }
        .app-mobile-close span:nth-child(2) { transform:translateY(-3.75px) rotate(-45deg); }

        .app-mobile-links { flex:1; display:flex; flex-direction:column; padding:8px 0; overflow-y:auto; }
        .app-mobile-link {
          font-size:20px; font-weight:700; color:var(--text);
          text-decoration:none; padding:20px 28px;
          border-bottom:1px solid var(--line);
          background:none; border-left:none; border-right:none; border-top:none;
          text-align:left; cursor:pointer;
          font-family:'Noto Sans JP',sans-serif; letter-spacing:-0.5px;
          transition:color 0.15s;
        }
        .app-mobile-link:hover { color:var(--muted); }

        .app-mobile-footer { padding:24px 28px; flex-shrink:0; }
        .app-mobile-premium {
          display:block; background:var(--text); color:white;
          text-align:center; padding:16px; font-size:14px; font-weight:500;
          text-decoration:none; letter-spacing:0.5px;
        }
      `}</style>

      <nav className="app-nav">
        <Link href="/home" className="app-nav-logo">カタリバ</Link>

        <div className="app-nav-links">
          <Link href="/request" className="app-nav-link">リクエスト</Link>
          <Link href="/ranking" className="app-nav-link">ランキング</Link>
          <Link href="/profile" className="app-nav-link">プロフィール</Link>
          {!userData?.isPremium && (
            <Link href="/premium" className="app-nav-premium">プレミアム</Link>
          )}
          <button className="app-nav-link" onClick={handleSignOut}>ログアウト</button>
        </div>

        <button
          className={`app-nav-hamburger${menuOpen ? " open" : ""}`}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="メニュー"
        >
          <span /><span /><span />
        </button>
      </nav>

      <div className={`app-mobile-menu${menuOpen ? " open" : ""}`}>
        <div className="app-mobile-header">
          <span className="app-mobile-logo">カタリバ</span>
          <button className="app-mobile-close" onClick={close} aria-label="閉じる">
            <span /><span />
          </button>
        </div>

        <div className="app-mobile-links">
          <Link href="/home" className="app-mobile-link" onClick={close}>ホーム</Link>
          <Link href="/request" className="app-mobile-link" onClick={close}>リクエスト</Link>
          <Link href="/ranking" className="app-mobile-link" onClick={close}>ランキング</Link>
          <Link href="/profile" className="app-mobile-link" onClick={close}>プロフィール</Link>
          <button className="app-mobile-link" onClick={() => { close(); handleSignOut(); }}>ログアウト</button>
        </div>

        <div className="app-mobile-footer">
          {!userData?.isPremium && (
            <Link href="/premium" className="app-mobile-premium" onClick={close}>
              プレミアムにアップグレード
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

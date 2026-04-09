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

  return (
    <>
      <style>{`
        .app-nav {
          position:sticky; top:0; z-index:100;
          padding:16px 40px; display:flex; justify-content:space-between; align-items:center;
          background:rgba(255,255,255,0.96); backdrop-filter:blur(10px);
          border-bottom:1px solid var(--line);
        }
        @media(max-width:768px){ .app-nav { padding:14px 16px; } }
        .app-nav-logo { font-family:'DM Sans',sans-serif; font-size:18px; font-weight:900; color:var(--text); text-decoration:none; }
        .app-nav-right { display:flex; align-items:center; gap:20px; }
        .app-nav-link { font-size:13px; color:var(--muted); text-decoration:none; transition:color 0.2s; background:none; border:none; cursor:pointer; font-family:'Noto Sans JP',sans-serif; }
        .app-nav-link:hover { color:var(--text); }
        .app-nav-premium { font-size:12px; font-weight:500; color:white; background:var(--text); padding:7px 18px; text-decoration:none; transition:opacity 0.2s; }
        .app-nav-premium:hover { opacity:0.75; }

        .hamburger {
          display:none; flex-direction:column; gap:5px; background:none; border:none;
          cursor:pointer; padding:4px;
        }
        .hamburger span { display:block; width:22px; height:2px; background:var(--text); transition:all 0.2s; }
        @media(max-width:640px){
          .app-nav-right { display:none; }
          .hamburger { display:flex; }
        }

        .mobile-menu {
          position:fixed; top:0; left:0; right:0; bottom:0; z-index:200;
          background:white; display:flex; flex-direction:column;
          padding:20px;
        }
        .mobile-menu-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:40px; }
        .mobile-menu-logo { font-family:'DM Sans',sans-serif; font-size:18px; font-weight:900; color:var(--text); }
        .mobile-close { background:none; border:none; font-size:24px; color:var(--muted); cursor:pointer; line-height:1; }
        .mobile-menu-links { display:flex; flex-direction:column; }
        .mobile-link {
          font-size:22px; font-weight:700; color:var(--text); text-decoration:none;
          padding:18px 0; border-bottom:1px solid var(--line); letter-spacing:-0.5px;
          background:none; border-left:none; border-right:none; border-top:none;
          text-align:left; cursor:pointer; font-family:'Noto Sans JP',sans-serif;
          transition:color 0.2s;
        }
        .mobile-link:hover { color:var(--muted); }
        .mobile-menu-bottom { margin-top:auto; }
        .mobile-premium { display:block; background:var(--text); color:white; text-align:center; padding:16px; font-size:14px; font-weight:500; text-decoration:none; letter-spacing:0.5px; }
      `}</style>

      <nav className="app-nav">
        <Link href="/home" className="app-nav-logo">カタリバ</Link>
        <div className="app-nav-right">
          <Link href="/request" className="app-nav-link">リクエスト</Link>
          <Link href="/ranking" className="app-nav-link">ランキング</Link>
          <Link href="/profile" className="app-nav-link">プロフィール</Link>
          {!userData?.isPremium && (
            <Link href="/premium" className="app-nav-premium">プレミアム</Link>
          )}
          <button className="app-nav-link" onClick={handleSignOut}>ログアウト</button>
        </div>
        <button className="hamburger" onClick={() => setMenuOpen(true)} aria-label="メニュー">
          <span /><span /><span />
        </button>
      </nav>

      {menuOpen && (
        <div className="mobile-menu">
          <div className="mobile-menu-header">
            <span className="mobile-menu-logo">カタリバ</span>
            <button className="mobile-close" onClick={() => setMenuOpen(false)}>×</button>
          </div>
          <div className="mobile-menu-links">
            <Link href="/home" className="mobile-link" onClick={() => setMenuOpen(false)}>ホーム</Link>
            <Link href="/request" className="mobile-link" onClick={() => setMenuOpen(false)}>リクエスト</Link>
            <Link href="/ranking" className="mobile-link" onClick={() => setMenuOpen(false)}>ランキング</Link>
            <Link href="/profile" className="mobile-link" onClick={() => setMenuOpen(false)}>プロフィール</Link>
            <button className="mobile-link" onClick={handleSignOut}>ログアウト</button>
          </div>
          <div className="mobile-menu-bottom">
            {!userData?.isPremium && (
              <Link href="/premium" className="mobile-premium" onClick={() => setMenuOpen(false)}>
                プレミアムにアップグレード
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}

"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

export default function AppNav() {
  const { userData } = useAuth();
  const router = useRouter();

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
        @media(max-width:600px){
          .app-nav-right { gap:12px; }
          .hide-sp { display:none; }
        }
      `}</style>
      <nav className="app-nav">
        <Link href="/home" className="app-nav-logo">カタリバ</Link>
        <div className="app-nav-right">
          <Link href="/request" className="app-nav-link hide-sp">リクエスト</Link>
          <Link href="/ranking" className="app-nav-link hide-sp">ランキング</Link>
          <Link href="/profile" className="app-nav-link">プロフィール</Link>
          {!userData?.isPremium && (
            <Link href="/premium" className="app-nav-premium">プレミアム</Link>
          )}
          <button className="app-nav-link" onClick={handleSignOut}>ログアウト</button>
        </div>
      </nav>
    </>
  );
}

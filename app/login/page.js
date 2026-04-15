"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function setupNewUser(user) {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 60);
    await setDoc(doc(db, "users", user.uid), {
      displayName: user.displayName || "",
      isPremium: true,
      trialEndsAt: Timestamp.fromDate(trialEnd),
      stripeCustomerId: null,
      badgeCount: 0,
      setupCompleted: false,
      createdAt: serverTimestamp(),
    });
    router.push("/setup");
  }

  async function redirectExisting(snap) {
    if (!snap.data().setupCompleted) {
      router.push("/setup");
    } else {
      router.push("/home");
    }
  }

  async function handleEmail(e) {
    e.preventDefault();
    if (mode === "signup" && password !== passwordConfirm) {
      setError("パスワードが一致しません。");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (mode === "signup") {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await setupNewUser(result.user);
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const snap = await getDoc(doc(db, "users", result.user.uid));
        if (!snap.exists()) {
          await setupNewUser(result.user);
        } else {
          await redirectExisting(snap);
        }
      }
    } catch (e) {
      const msgs = {
        "auth/email-already-in-use": "このメールアドレスはすでに登録されています。",
        "auth/invalid-email": "メールアドレスの形式が正しくありません。",
        "auth/weak-password": "パスワードは6文字以上にしてください。",
        "auth/user-not-found": "メールアドレスまたはパスワードが違います。",
        "auth/wrong-password": "メールアドレスまたはパスワードが違います。",
        "auth/invalid-credential": "メールアドレスまたはパスワードが違います。",
      };
      setError(msgs[e.code] || "エラーが発生しました。もう一度お試しください。");
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists()) {
        await setupNewUser(user);
      } else {
        await redirectExisting(snap);
      }
    } catch (e) {
      setError("ログインに失敗しました。もう一度お試しください。");
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        .login-wrap {
          min-height:100vh; display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          background:var(--bg2); padding:20px;
        }
        .login-box {
          background:white; border:1px solid var(--line);
          padding:60px 48px; width:100%; max-width:420px;
        }
        .login-logo {
          font-family:'DM Sans',sans-serif; font-size:22px; font-weight:900;
          color:var(--text); letter-spacing:-0.5px; margin-bottom:8px;
        }
        .login-sub {
          font-size:13px; color:var(--muted); margin-bottom:40px; line-height:1.8;
        }
        .login-btn {
          width:100%; padding:14px 20px;
          background:var(--text); color:white;
          font-size:14px; font-weight:500; letter-spacing:0.5px;
          border:none; cursor:pointer; transition:opacity 0.2s;
          font-family:'Noto Sans JP',sans-serif;
          display:flex; align-items:center; justify-content:center; gap:12px;
        }
        .login-btn:hover { opacity:0.75; }
        .login-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .login-error {
          margin-top:16px; font-size:13px; color:var(--red);
        }
        .login-tabs { display:flex; border-bottom:1px solid var(--line); margin-bottom:32px; }
        .login-tab {
          flex:1; padding:12px; font-size:13px; font-weight:500; background:none; border:none;
          cursor:pointer; color:var(--muted); font-family:'Noto Sans JP',sans-serif;
          border-bottom:2px solid transparent; margin-bottom:-1px; transition:all 0.15s;
        }
        .login-tab.active { color:var(--text); border-bottom-color:var(--text); }
        .login-input {
          width:100%; padding:12px 14px; border:1px solid var(--line);
          font-size:14px; font-family:'Noto Sans JP',sans-serif; color:var(--text);
          outline:none; transition:border-color 0.2s; box-sizing:border-box; margin-bottom:10px;
        }
        .login-input:focus { border-color:var(--text); }
        .login-divider {
          display:flex; align-items:center; gap:12px;
          margin:24px 0; font-size:11px; color:var(--muted); letter-spacing:1px;
        }
        .login-divider::before,.login-divider::after { content:''; flex:1; height:1px; background:var(--line); }
        .login-terms {
          margin-top:24px; font-size:12px; color:var(--muted); line-height:1.8; text-align:center;
        }
        .back-link {
          margin-top:32px; font-size:12px; color:var(--muted); text-decoration:none;
          display:block; text-align:center; transition:color 0.2s;
        }
        .back-link:hover { color:var(--text); }
      `}</style>

      <div className="login-wrap">
        <div className="login-box">
          <div className="login-logo">カタリバ</div>
          <p className="login-sub">言葉で、人を好きになる。</p>

          <div className="login-tabs">
            <button className={`login-tab${mode === "login" ? " active" : ""}`} onClick={() => { setMode("login"); setError(""); }}>ログイン</button>
            <button className={`login-tab${mode === "signup" ? " active" : ""}`} onClick={() => { setMode("signup"); setError(""); }}>新規登録</button>
          </div>

          <form onSubmit={handleEmail}>
            <input
              className="login-input"
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            <input
              className="login-input"
              type="password"
              placeholder="パスワード（6文字以上）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
            {mode === "signup" && (
              <input
                className="login-input"
                type="password"
                placeholder="パスワード（確認）"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                disabled={loading}
              />
            )}
            <button className="login-btn" type="submit" disabled={loading} style={{marginTop:4}}>
              {loading ? "処理中..." : mode === "signup" ? "登録する" : "ログイン"}
            </button>
          </form>

          <div className="login-divider">または</div>

          <button className="login-btn" onClick={handleGoogle} disabled={loading} style={{background:"white",color:"var(--text)",border:"1px solid var(--line)"}}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Googleでログイン
          </button>

          {error && <p className="login-error">{error}</p>}

          <p className="login-terms">
            登録することで利用規約・プライバシーポリシーに同意したものとみなします。
          </p>
        </div>
        <a href="/" className="back-link">トップに戻る</a>
      </div>
    </>
  );
}

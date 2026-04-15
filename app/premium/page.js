"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppNav from "@/components/AppNav";

export default function PremiumPage() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user === null) router.push("/login");
  }, [user, router]);

  async function handleCheckout() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, email: user.email }),
      });
      const { url } = await res.json();
      if (url) { window.location.href = url; } else { setLoading(false); }
    } catch (e) {
      console.error("[checkout]", e);
      setLoading(false);
    }
  }

  async function handlePortal() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: userData.stripeCustomerId }),
      });
      const { url } = await res.json();
      if (url) { window.location.href = url; } else { setLoading(false); }
    } catch (e) {
      console.error("[portal]", e);
      setLoading(false);
    }
  }

  const trialEndsAt = userData?.trialEndsAt?.toDate?.();
  const isTrialing = trialEndsAt && trialEndsAt > new Date() && !userData?.stripeCustomerId;
  const trialDaysLeft = isTrialing ? Math.ceil((trialEndsAt - new Date()) / (1000 * 60 * 60 * 24)) : 0;

  if (user === undefined) return null;

  return (
    <>
      <style>{`
        .premium-wrap { max-width:700px; margin:0 auto; padding:60px 40px; }
        @media(max-width:768px){ .premium-wrap { padding:40px 20px; } }
        .premium-heading { font-size:clamp(24px,3vw,36px); font-weight:900; color:var(--text); letter-spacing:-1px; margin-bottom:8px; }
        .premium-sub { font-size:13px; color:var(--muted); margin-bottom:48px; line-height:1.9; }

        .plan-cards { display:grid; grid-template-columns:1fr 1fr; gap:2px; background:var(--line); margin-bottom:40px; }
        @media(max-width:600px){ .plan-cards { grid-template-columns:1fr; } }
        .plan-card { background:white; padding:36px 32px; }
        .plan-card.featured { background:var(--text); }
        .plan-type { font-size:10px; font-weight:500; letter-spacing:4px; color:var(--muted); text-transform:uppercase; margin-bottom:16px; }
        .plan-card.featured .plan-type { color:rgba(255,255,255,0.5); }
        .plan-price-big { font-family:'DM Sans',sans-serif; font-size:52px; font-weight:700; color:var(--text); letter-spacing:-2px; line-height:1; margin-bottom:6px; }
        .plan-card.featured .plan-price-big { color:white; }
        .plan-price-sub { font-size:13px; color:var(--muted); margin-bottom:28px; }
        .plan-card.featured .plan-price-sub { color:rgba(255,255,255,0.5); }
        .plan-features { list-style:none; }
        .plan-features li { font-size:13px; padding:9px 0; border-bottom:1px solid var(--line); color:var(--muted); display:flex; gap:10px; }
        .plan-card.featured .plan-features li { border-color:rgba(255,255,255,0.1); color:rgba(255,255,255,0.7); }
        .plan-features li.on { color:var(--text); }
        .plan-card.featured .plan-features li.on { color:white; }
        .plan-features li::before { content:'✓'; font-weight:700; font-size:11px; flex-shrink:0; color:var(--muted); }
        .plan-card.featured .plan-features li::before { color:rgba(255,255,255,0.4); }
        .plan-features li.on::before { color:var(--text); }
        .plan-card.featured .plan-features li.on::before { color:white; }

        .checkout-btn {
          width:100%; padding:16px; background:var(--text); color:white;
          border:none; font-size:14px; font-weight:500; cursor:pointer;
          font-family:'Noto Sans JP',sans-serif; letter-spacing:0.5px;
          transition:opacity 0.2s; margin-top:32px;
        }
        .checkout-btn:hover { opacity:0.75; }
        .checkout-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .checkout-btn.inverse { background:white; color:var(--text); border:1px solid var(--line); }

        .already-premium {
          background:var(--bg2); border:1px solid var(--line); padding:28px 32px; margin-bottom:40px;
        }
        .already-premium-title { font-size:17px; font-weight:700; color:var(--text); margin-bottom:8px; }
        .already-premium-sub { font-size:13px; color:var(--muted); line-height:1.9; }
        .trial-badge { display:inline-block; background:var(--bg2); border:1px solid var(--line); padding:6px 14px; font-size:12px; color:var(--muted); margin-bottom:12px; }
        .trial-badge strong { color:var(--text); }

        .stripe-note { font-size:12px; color:var(--muted); text-align:center; margin-top:20px; line-height:1.9; }
      `}</style>

      <AppNav />

      <div className="premium-wrap">
        <h1 className="premium-heading">プレミアム</h1>
        <p className="premium-sub">自分にいいねをくれた人の正体を知る。それだけで、月500円の価値がある。</p>

        {userData?.isPremium ? (
          <>
            <div className="already-premium">
              {isTrialing && (
                <div className="trial-badge">無料トライアル中 — <strong>残り{trialDaysLeft}日</strong></div>
              )}
              <div className="already-premium-title">{isTrialing ? "トライアル中" : "プレミアム会員です"}</div>
              <div className="already-premium-sub">
                {isTrialing
                  ? `登録から60日間、プレミアム機能を無料でお試しいただけます。トライアル終了後は月額¥500の課金が始まります。`
                  : "すべての機能が利用できます。解約・プラン変更はStripeのカスタマーポータルから行えます。"
                }
              </div>
              {userData?.stripeCustomerId && (
                <button className="checkout-btn inverse" onClick={handlePortal} disabled={loading} style={{marginTop:"20px"}}>
                  {loading ? "移動中..." : "プランを管理する"}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="plan-cards">
              <div className="plan-card">
                <div className="plan-type">Free</div>
                <div className="plan-price-big">¥0</div>
                <div className="plan-price-sub">/ 月</div>
                <ul className="plan-features">
                  <li className="on">討論スレ閲覧</li>
                  <li className="on">投稿・いいね</li>
                  <li className="on">過去スレ（50件）</li>
                  <li>正体開帳</li>
                  <li>スレ立て・リクエスト</li>
                  <li>お気に入り</li>
                </ul>
              </div>
              <div className="plan-card featured">
                <div className="plan-type">Premium</div>
                <div className="plan-price-big">¥500</div>
                <div className="plan-price-sub">/ 月</div>
                <ul className="plan-features">
                  <li className="on">討論スレ閲覧</li>
                  <li className="on">投稿・いいね</li>
                  <li className="on">過去スレ（全件）</li>
                  <li className="on">正体開帳</li>
                  <li className="on">スレ立て・リクエスト</li>
                  <li className="on">お気に入り</li>
                </ul>
                <button className="checkout-btn" onClick={handleCheckout} disabled={loading}>
                  {loading ? "移動中..." : "プレミアムにアップグレード"}
                </button>
              </div>
            </div>
            <p className="stripe-note">
              Stripe社の安全な決済システムを利用しています。<br />
              いつでも解約できます。
            </p>
          </>
        )}
      </div>
    </>
  );
}

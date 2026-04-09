"use client";
import Link from "next/link";

export default function PremiumSuccessPage() {
  return (
    <>
      <style>{`
        .success-wrap {
          min-height:100vh; display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          background:var(--bg2); padding:40px 20px; text-align:center;
        }
        .success-box { background:white; border:1px solid var(--line); padding:60px 48px; max-width:440px; width:100%; }
        .success-title { font-size:24px; font-weight:900; color:var(--text); letter-spacing:-0.5px; margin-bottom:12px; }
        .success-sub { font-size:14px; color:var(--muted); line-height:2; margin-bottom:36px; }
        .success-btn {
          display:inline-block; background:var(--text); color:white;
          padding:14px 40px; font-size:14px; font-weight:500;
          text-decoration:none; transition:opacity 0.2s; letter-spacing:0.5px;
        }
        .success-btn:hover { opacity:0.75; }
      `}</style>
      <div className="success-wrap">
        <div className="success-box">
          <div className="success-title">プレミアム登録完了</div>
          <p className="success-sub">
            ありがとうございます。<br />
            すべての機能が利用できるようになりました。
          </p>
          <Link href="/home" className="success-btn">ホームに戻る</Link>
        </div>
      </div>
    </>
  );
}

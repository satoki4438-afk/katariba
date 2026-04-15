"use client";
import { useEffect } from "react";
import Link from "next/link";

export default function TopPage() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((x) => { if (x.isIntersecting) x.target.classList.add("visible"); }),
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <style>{`
        nav {
          position:fixed; top:0; left:0; right:0; z-index:100;
          padding:20px 60px; display:flex; justify-content:space-between; align-items:center;
          background:rgba(255,255,255,0.96); backdrop-filter:blur(10px);
          border-bottom:1px solid var(--line);
        }
        @media(max-width:768px){ nav { padding:16px 20px; } }
        .nav-logo { font-family:'DM Sans',sans-serif; font-size:20px; font-weight:600; color:var(--text); letter-spacing:-0.5px; }
        .nav-logo b { font-weight:900; }
        .nav-right { display:flex; align-items:center; gap:32px; }
        .nav-link { font-size:13px; color:var(--muted); text-decoration:none; transition:color 0.2s; }
        .nav-link:hover { color:var(--text); }
        .nav-btn { background:var(--text); color:white; padding:10px 24px; font-size:13px; font-family:'Noto Sans JP',sans-serif; font-weight:500; text-decoration:none; transition:opacity 0.2s; letter-spacing:0.5px; }
        .nav-btn:hover { opacity:0.75; }

        .hero { padding:140px 60px 100px; max-width:1200px; margin:0 auto; display:grid; grid-template-columns:1fr 420px; gap:100px; align-items:center; }
        @media(max-width:1000px){ .hero { grid-template-columns:1fr; padding:120px 20px 80px; gap:60px; } }
        .hero-kicker { font-size:12px; font-weight:500; letter-spacing:3px; color:var(--muted); text-transform:uppercase; margin-bottom:28px; opacity:0; animation:up 0.7s 0.1s ease forwards; }
        .hero-title { font-size:clamp(44px,5.5vw,72px); font-weight:900; line-height:1.1; letter-spacing:-2px; color:var(--text); margin-bottom:28px; opacity:0; animation:up 0.7s 0.2s ease forwards; }
        .hero-body { font-size:16px; color:var(--muted); line-height:1.9; max-width:440px; margin-bottom:44px; opacity:0; animation:up 0.7s 0.4s ease forwards; }
        .hero-actions { display:flex; align-items:center; gap:20px; flex-wrap:wrap; opacity:0; animation:up 0.7s 0.5s ease forwards; }
        .btn-fill { background:var(--text); color:white; padding:15px 40px; font-size:14px; font-weight:500; letter-spacing:0.5px; text-decoration:none; transition:opacity 0.2s; display:inline-block; }
        .btn-fill:hover { opacity:0.75; }
        .btn-arrow { font-size:14px; color:var(--muted); text-decoration:none; display:flex; align-items:center; gap:8px; transition:color 0.2s; }
        .btn-arrow:hover { color:var(--text); }
        .btn-arrow::after { content:'→'; transition:transform 0.2s; }
        .btn-arrow:hover::after { transform:translateX(4px); }
        .hero-mock { opacity:0; animation:up 0.7s 0.7s ease forwards; }
        @media(max-width:1000px){ .hero-mock { display:none; } }

        .ticker { border-top:1px solid var(--line); border-bottom:1px solid var(--line); padding:14px 0; overflow:hidden; background:var(--bg2); }
        .ticker-inner { display:flex; gap:48px; white-space:nowrap; animation:ticker 20s linear infinite; }
        .ticker-item { font-size:12px; color:var(--muted); letter-spacing:2px; text-transform:uppercase; flex-shrink:0; }
        .ticker-dot { color:var(--line); margin-left:48px; }
        @keyframes ticker { from { transform:translateX(0); } to { transform:translateX(-50%); } }

        .statement { padding:120px 60px; max-width:900px; margin:0 auto; }
        @media(max-width:768px){ .statement { padding:80px 20px; } }
        .statement-big { font-size:clamp(22px,3.5vw,36px); font-weight:700; line-height:1.7; color:var(--text); letter-spacing:-0.5px; }
        .fade { color:var(--muted); font-weight:300; }
        .accent { color:var(--red); }

        .how { background:var(--bg2); padding:100px 60px; }
        @media(max-width:768px){ .how { padding:80px 20px; } }
        .how-inner { max-width:1100px; margin:0 auto; }
        .sec-label { font-size:11px; font-weight:500; letter-spacing:4px; color:var(--muted); text-transform:uppercase; margin-bottom:14px; }
        .sec-heading { font-size:clamp(28px,4vw,44px); font-weight:900; letter-spacing:-1px; color:var(--text); margin-bottom:60px; line-height:1.15; }
        .how-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:2px; background:var(--line); }
        @media(max-width:768px){ .how-grid { grid-template-columns:1fr; } }
        .how-cell { background:var(--bg2); padding:48px 40px; transition:background 0.2s; }
        .how-cell:hover { background:white; }
        .how-week { font-size:11px; font-weight:500; letter-spacing:3px; color:var(--muted); margin-bottom:20px; text-transform:uppercase; }
        .how-title { font-size:22px; font-weight:700; color:var(--text); margin-bottom:12px; letter-spacing:-0.5px; }
        .how-desc { font-size:14px; color:var(--muted); line-height:2; }
        .how-note { background:white; border:1px solid var(--line); padding:14px 20px; margin-top:12px; font-size:13px; color:var(--muted); line-height:1.7; }
        .how-note strong { color:var(--text); font-weight:500; }

        .features { padding:100px 60px; max-width:1100px; margin:0 auto; }
        @media(max-width:768px){ .features { padding:80px 20px; } }
        .feat-list { display:grid; grid-template-columns:repeat(2,1fr); gap:2px; background:var(--line); margin-top:60px; }
        @media(max-width:768px){ .feat-list { grid-template-columns:1fr; } }
        .feat { background:var(--bg); padding:44px 40px; transition:background 0.2s; }
        .feat:hover { background:var(--bg2); }
        .feat-num { font-family:'DM Sans',sans-serif; font-size:11px; font-weight:600; letter-spacing:3px; color:var(--muted); margin-bottom:20px; }
        .feat-title { font-size:19px; font-weight:700; color:var(--text); margin-bottom:12px; letter-spacing:-0.3px; }
        .feat-body { font-size:14px; color:var(--muted); line-height:2; }

        .plan-section { background:var(--bg2); padding:100px 60px; }
        @media(max-width:768px){ .plan-section { padding:80px 20px; } }
        .plan-inner { max-width:1100px; margin:0 auto; }
        .plan-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:20px; margin-top:60px; }
        @media(max-width:768px){ .plan-grid { grid-template-columns:1fr; } }
        .plan-card { background:white; border:1.5px solid var(--line); padding:44px 40px; transition:transform 0.2s; }
        .plan-card:hover { transform:translateY(-4px); }
        .plan-card.main { border-color:var(--text); }
        .plan-type { font-size:11px; font-weight:500; letter-spacing:4px; color:var(--muted); text-transform:uppercase; margin-bottom:16px; }
        .plan-price { font-family:'DM Sans',sans-serif; font-size:56px; font-weight:700; color:var(--text); letter-spacing:-2px; line-height:1; margin-bottom:6px; }
        .plan-price sub { font-size:16px; font-weight:400; letter-spacing:0; color:var(--muted); vertical-align:baseline; }
        .plan-items { list-style:none; margin-top:32px; }
        .plan-items li { font-size:14px; padding:11px 0; border-bottom:1px solid var(--line); color:var(--muted); display:flex; gap:12px; align-items:center; }
        .plan-items li.on { color:var(--text); font-weight:400; }
        .plan-items li.on::before { content:'✓'; color:var(--text); font-weight:700; font-size:12px; flex-shrink:0; }
        .plan-items li:not(.on)::before { content:'–'; color:var(--line); flex-shrink:0; }
        .limit-note { font-size:12px; color:var(--muted); margin-left:4px; }

        .cta-section { padding:160px 60px; text-align:center; }
        @media(max-width:768px){ .cta-section { padding:100px 20px; } }
        .cta-title { font-size:clamp(36px,6vw,72px); font-weight:900; letter-spacing:-2px; color:var(--text); line-height:1.1; margin-bottom:20px; }
        .cta-title span { color:var(--muted); font-weight:300; }
        .cta-sub { font-size:15px; color:var(--muted); line-height:2; margin-bottom:48px; }

        footer { border-top:1px solid var(--line); padding:36px 60px; display:flex; justify-content:space-between; align-items:center; }
        @media(max-width:768px){ footer { flex-direction:column; gap:12px; padding:32px 20px; text-align:center; } }
        .f-logo { font-family:'DM Sans',sans-serif; font-size:17px; font-weight:700; color:var(--text); }
        .f-copy { font-size:11px; color:var(--muted); letter-spacing:1px; }
      `}</style>

      <nav>
        <div className="nav-logo"><b>カタリバ</b></div>
        <div className="nav-right">
          <a href="#how" className="nav-link">仕組み</a>
          <a href="#plan" className="nav-link">料金</a>
          <Link href="/login" className="nav-btn">登録する</Link>
        </div>
      </nav>

      <div style={{maxWidth:"1200px",margin:"0 auto"}}>
        <section className="hero">
          <div>
            <p className="hero-kicker">語る場所が、ここにある</p>
            <h1 className="hero-title">本を読んだら、<br />語りたい。</h1>
            <p className="hero-body">本について、誰かと話したい。そんな気持ちに応えるコミュニティ。匿名で、でも本音で。</p>
            <div className="hero-actions">
              <Link href="/login" className="btn-fill">登録する</Link>
              <a href="#how" className="btn-arrow">仕組みを見る</a>
            </div>
          </div>
          <div className="hero-mock">
            <div style={{background:"var(--bg2)",border:"1px solid var(--line)",padding:"80px 40px",textAlign:"center"}}>
              <p style={{fontSize:"11px",fontWeight:500,letterSpacing:"4px",color:"var(--muted)",textTransform:"uppercase",marginBottom:"20px"}}>Coming Soon</p>
              <p style={{fontSize:"20px",fontWeight:700,color:"var(--text)",letterSpacing:"-0.5px",marginBottom:"16px"}}>討論スレ、準備中。</p>
              <p style={{fontSize:"13px",color:"var(--muted)",lineHeight:2}}>登録者には<br />オープン初日からご参加いただけます。</p>
            </div>
          </div>
        </section>
      </div>

      <div className="ticker">
        <div className="ticker-inner">
          {["本を語る場所","匿名で本音を","週2冊が並走","いいねランキング","正体開帳","論客認定",
            "本を語る場所","匿名で本音を","週2冊が並走","いいねランキング","正体開帳","論客認定"].map((t,i) => (
            <span key={i} className="ticker-item">{t}<span className="ticker-dot">·</span></span>
          ))}
        </div>
      </div>

      <section className="statement reveal">
        <p className="statement-big">
          本を語れる場所を増やしたい。
        </p>
      </section>

      <section className="how" id="how">
        <div className="how-inner">
          <p className="sec-label reveal">How it works</p>
          <h2 className="sec-heading reveal">2週間で、1冊を語り尽くす。</h2>
          <div className="how-grid reveal">
            <div className="how-cell">
              <p className="how-week">Week 1</p>
              <h3 className="how-title">作品発表 · 読書期間</h3>
              <p className="how-desc">毎週2冊が発表されます。ベストセラー1冊＋リクエスト1冊。1週間、じっくり作品と向き合う。</p>
              <div className="how-note" style={{marginTop:"12px",fontSize:"12px",color:"var(--muted)",lineHeight:1.8}}>
                <span style={{display:"inline-block",background:"var(--bg3)",padding:"2px 10px",fontSize:"10px",letterSpacing:"2px",color:"var(--muted)",marginBottom:"10px"}}>現在のカテゴリ</span><br />
                <strong style={{color:"var(--text)"}}>本</strong>　小説 · ビジネス書 · エッセイ · 詩 · ほか
              </div>
              <div className="how-note"><strong>投稿機能あり。</strong>読みながら感じたことをメモ代わりに投稿できます。この週はまだ他の人のコメントは見えません。</div>
            </div>
            <div className="how-cell">
              <p className="how-week">Week 2</p>
              <h3 className="how-title">ウォッチ解放 · 討論</h3>
              <p className="how-desc">全コメントが一斉に開放。他の人の感想が見えて、リプライやアンカーでやり取りができます。</p>
              <div className="how-note"><strong>いいね機能あり。</strong>共感したコメントにいいね。週間ランキングに反映されます。</div>
            </div>
          </div>
          <p className="reveal" style={{textAlign:"center",fontSize:"13px",color:"var(--muted)",marginTop:"28px",lineHeight:2,letterSpacing:"1px"}}>
            常時8〜10冊が並走。いつ来ても必ず参加できる本がある。
          </p>
        </div>
      </section>

      <section className="features">
        <p className="sec-label reveal">Features</p>
        <h2 className="sec-heading reveal">カタリバの4つの設計。</h2>
        <div className="feat-list reveal">
          {[
            {n:"01",t:"完全匿名の討論",b:"名前も肩書きも関係なし。Slack式タイムライン＋レス番号アンカーで、深い議論が生まれます。"},
            {n:"02",t:"自分が共感した人は、いったい誰なんだろう？",b:"いいねをつけた相手はプロフィールに匿名で表示されます。プレミアム会員になると名前が明かされます。コメントで人を好きになる。"},
            {n:"03",t:"ローリング方式で常に並走",b:"常時8〜10冊が議論中。いつ来ても必ず参加できる本がある。ハズレ本があっても他のスレがある。"},
            {n:"04",t:"選書はぜんぶ自動",b:"ベストセラーランキングから1冊、投票数1位のリクエストから1冊。半年縛りで重複なし。"},
          ].map((f) => (
            <div className="feat" key={f.n}>
              <p className="feat-num">{f.n}</p>
              <h3 className="feat-title">{f.t}</h3>
              <p className="feat-body">{f.b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="plan-section" id="plan">
        <div className="plan-inner">
          <p className="sec-label reveal">Pricing</p>
          <h2 className="sec-heading reveal">まず、無料で。</h2>
          <div className="plan-grid reveal">
            <div className="plan-card">
              <p className="plan-type">Free</p>
              <p className="plan-price">¥0<sub> / 月</sub></p>
              <ul className="plan-items">
                <li className="on">討論スレ閲覧（当週分）</li>
                <li className="on">過去スレ閲覧 <span className="limit-note">（50件まで）</span></li>
                <li className="on">チャット参加・いいね・投稿</li>
                <li>スレ立て・リクエスト</li>
                <li>ランキング正体開帳</li>
                <li>お気に入り登録</li>
                <li>論客認定バッジ</li>
              </ul>
            </div>
            <div className="plan-card main">
              <p className="plan-type">Premium</p>
              <p className="plan-price">¥500<sub> / 月</sub></p>
              <ul className="plan-items">
                <li className="on">討論スレ閲覧（当週分）</li>
                <li className="on">過去スレ閲覧 <span className="limit-note">（全件）</span></li>
                <li className="on">チャット参加・いいね・投稿</li>
                <li className="on">スレ立て・リクエスト</li>
                <li className="on">ランキング正体開帳</li>
                <li className="on">お気に入り登録</li>
                <li className="on">論客認定バッジ（1,000いいね達成）</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section" id="waitlist">
        <h2 className="cta-title reveal">語りに、<br /><span>行きませんか。</span></h2>
        <p className="cta-sub reveal">無料で始められます。</p>
        <Link href="/login" className="btn-fill reveal" style={{fontSize:"15px",padding:"18px 56px",letterSpacing:"2px"}}>登録する</Link>
      </section>

      <footer>
        <div className="f-logo">カタリバ</div>
        <div className="f-copy">© 2026 TAS Studio</div>
      </footer>
    </>
  );
}

export default function Landing() {
  return (
    <main>
      <style>{`
        :root {
          --bg: #0b0c0f;            /* near-black for subtle contrast */
          --surface: #0f1116;       /* page background */
          --card: #131722;          /* panels */
          --muted: #9aa4b2;         /* secondary text */
          --text: #e6e9ef;          /* primary text */
          --brand: #2563eb;         /* Taska blue */
          --brand-2: #22c55e;       /* accent green */
          --ring: rgba(37,99,235,.5);
          --border: #1f2430;
        }
        * { box-sizing: border-box; }
        html, body, main { margin: 0; padding: 0; background: var(--surface); color: var(--text); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; }
        a { color: inherit; text-decoration: none; }
        .container { max-width: 1100px; margin: 0 auto; padding: 0 20px; }
        .header { position: sticky; top: 0; z-index: 50; background: linear-gradient(180deg, rgba(15,17,22,.9), rgba(15,17,22,.6) 60%, rgba(15,17,22,0)); backdrop-filter: saturate(150%) blur(8px); border-bottom: 1px solid var(--border); }
        .nav { display: flex; align-items: center; justify-content: space-between; height: 64px; }
        .brand { display: flex; gap: 10px; align-items: center; font-weight: 800; letter-spacing: .2px; }
        .logo { width: 28px; height: 28px; border-radius: 8px; background: radial-gradient(60% 80% at 20% 20%, #60a5fa, #2563eb 60%, #1e40af); box-shadow: 0 0 0 4px rgba(37,99,235,.15), 0 8px 24px rgba(37,99,235,.35) inset; }
        .nav-links { display: none; gap: 18px; color: var(--muted); }
        .cta-row { display: flex; gap: 10px; }
        .btn { display: inline-flex; align-items: center; justify-content: center; border: 1px solid var(--border); background: #111522; color: var(--text); height: 40px; padding: 0 14px; border-radius: 12px; font-weight: 600; transition: all .18s ease; }
        .btn:hover { border-color: #2a3242; transform: translateY(-1px); }
        .btn.primary { background: linear-gradient(180deg, #2b6be7, #1d4ed8); border: none; box-shadow: 0 8px 20px rgba(37,99,235,.35); }
        .btn.primary:hover { filter: brightness(1.05); box-shadow: 0 12px 28px rgba(37,99,235,.45); }
        .btn.ghost { background: transparent; }

        .hero { padding: 72px 0 40px; position: relative; overflow: hidden; }
        .glow { position: absolute; inset: -20% -10% auto -10%; height: 420px; background: radial-gradient(600px 220px at 50% 10%, rgba(37,99,235,.18), transparent 60%), radial-gradient(800px 240px at 40% 0%, rgba(34,197,94,.12), transparent 60%); pointer-events:none; }
        .hero-grid { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 28px; align-items: center; }
        .eyebrow { display:inline-flex; gap:8px; align-items:center; padding:6px 10px; border-radius:999px; font-size:12px; color:#b7c0ce; border:1px solid var(--border); background: #0c111a; }
        .h1 { margin: 14px 0 10px; font-size: clamp(28px, 5vw, 48px); line-height: 1.06; font-weight: 900; letter-spacing:-.02em; }
        .lead { color: var(--muted); font-size: clamp(15px, 2.2vw, 18px); line-height: 1.65; max-width: 54ch; }
        .hero-ctas { display:flex; gap:12px; margin-top: 18px; flex-wrap: wrap; }
        .tiny { font-size: 12px; color: #9aa4b2; margin-top: 8px; }

        .mock { border: 1px solid var(--border); background: linear-gradient(180deg, #0f1420, #0c111a); border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,.5); overflow: hidden; }
        .mock .bar { height: 38px; background: #0b0f18; display:flex; gap:8px; align-items:center; padding:0 10px; border-bottom:1px solid var(--border); }
        .dot { width: 10px; height: 10px; border-radius: 50%; background: #374151; }
        .mock img, .mock video { width: 100%; display:block; aspect-ratio: 16/10; object-fit: cover; }
        .mock .placeholder { display:grid; place-items:center; aspect-ratio:16/10; background: repeating-linear-gradient(135deg, #0e1320, #0e1320 12px, #0f172a 12px, #0f172a 24px); color:#93c5fd; font-weight:700; letter-spacing:.2px; }

        .strip { padding: 46px 0; border-top:1px solid var(--border); border-bottom:1px solid var(--border); color: var(--muted); text-align:center; }

        .features { padding: 60px 0 30px; }
        .section-title { font-size: 28px; font-weight: 800; margin-bottom: 18px; text-align:center; }
        .feature-grid { display:grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .card { background: linear-gradient(180deg, #121722, #0f131d); border: 1px solid var(--border); border-radius: 16px; padding: 18px; }
        .card h3 { margin:10px 0 6px; font-size: 18px; }
        .card p { color: var(--muted); font-size: 14px; line-height: 1.6; }
        .icon { width: 36px; height: 36px; border-radius: 10px; display:grid; place-items:center; background: #0b1220; border:1px solid #1a2233; }

        .demo { padding: 30px 0 20px; }
        .demo-inner { display:grid; grid-template-columns: 1fr 1fr; gap: 22px; align-items:center; }
        .demo .note { color: var(--muted); font-size: 14px; margin-top: 8px; }

        .pricing { padding: 60px 0; }
        .pricing .switch { text-align:center; margin-bottom: 22px; color: var(--muted); }
        .price-grid { display:grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .price { background: linear-gradient(180deg, #131a27, #101520); border: 1px solid var(--border); border-radius: 18px; padding: 20px; display:flex; flex-direction:column; justify-content:space-between; }
        .price .pill { display:inline-block; font-size:12px; padding:6px 10px; border:1px solid var(--border); border-radius:999px; color:#b7c0ce; }
        .price h4 { margin:10px 0 8px; font-size: 18px; }
        .price .amount { font-size: 36px; font-weight: 900; display:flex; gap: 6px; align-items:flex-end; }
        .price ul { list-style:none; padding:0; margin: 12px 0; display:grid; gap: 8px; }
        .price li { display:flex; gap: 8px; align-items:flex-start; color: var(--muted); font-size: 14px; }
        .tick { width: 18px; height: 18px; border:1px solid #1a2a1d; border-radius:6px; background: radial-gradient(120px 60px at -10% -10%, rgba(34,197,94,.25), transparent); display:grid; place-items:center; }
        .price .cta { margin-top: 6px; }
        .popular { outline: 2px solid rgba(37,99,235,.5); box-shadow: 0 0 0 6px rgba(37,99,235,.1); position:relative; }
        .popular .ribbon { position:absolute; top: -12px; left: 16px; background: #1d4ed8; color:white; font-size:12px; padding:4px 8px; border-radius:999px; }

        .faq { padding: 10px 0 60px; }
        .faq-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        details { background:#0f131d; border:1px solid var(--border); border-radius:14px; padding:14px 16px; }
        summary { cursor:pointer; font-weight:700; }
        details p { color: var(--muted); margin:10px 0 0; }

        .footer { border-top:1px solid var(--border); padding: 24px 0 40px; color:#a2adbb; }
        .foot { display:flex; align-items:center; justify-content:space-between; gap: 20px; flex-wrap: wrap; }
        .fine { color:#7c8797; font-size:13px; }

        @media (max-width: 980px) {
          .hero-grid { grid-template-columns: 1fr; }
          .feature-grid, .price-grid, .demo-inner, .faq-grid { grid-template-columns: 1fr; }
          .nav-links { display: none; }
        }
        @media (min-width: 981px) {
          .nav-links { display: flex; }
        }
      `}</style>

      {/* Header */}
      <header className="header">
        <div className="container nav">
          <a href="/" className="brand" aria-label="Taska home">
            <span className="logo" /> <span>Taska</span>
          </a>
          <nav className="nav-links" aria-label="Primary">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="cta-row">
            <a className="btn ghost" href="/auth/login">Log in</a>
            <a className="btn primary" href="/auth/register">Get Started</a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="glow" aria-hidden />
        <div className="container hero-grid">
          <div>
            <span className="eyebrow">14‑day free trial · No credit card · Cancel anytime</span>
            <h1 className="h1">Run your trade business like a pro.</h1>
            <p className="lead">Taska is the fast, simple field‑service platform for jobs, scheduling, customers, equipment, and invoices — all in one place, on desktop and mobile.</p>
            <div className="hero-ctas">
              <a className="btn primary" href="/auth/register">Start free</a>
              <a className="btn" href="#pricing">See pricing</a>
              <a className="btn ghost" href="#demo">Watch demo</a>
            </div>
            <div className="tiny">Set up in minutes. Get paid faster. Less admin, more jobs done.</div>
          </div>

          <div className="mock" aria-label="App preview">
            <div className="bar">
              <span className="dot" /><span className="dot" /><span className="dot" />
            </div>
            {/* Replace this placeholder with a GIF/video or screenshot of Taska */}
            <div className="placeholder">Taska Demo Placeholder</div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <div className="strip">
        <div className="container">Built for crews in the field — forklift techs, sparkies, mobile mechanics & more.</div>
      </div>

      {/* Features */}
      <section id="features" className="features container">
        <h2 className="section-title">Everything you need to run your field service business</h2>
        <div className="feature-grid">
          <article className="card">
            <div className="icon">📋</div>
            <h3>Job Management</h3>
            <p>Schedule, track, and complete jobs with real‑time updates and photo attachments.</p>
          </article>
          <article className="card">
            <div className="icon">👤</div>
            <h3>Customer Portal</h3>
            <p>History, notes, and equipment — everything in one place so you look pro and move fast.</p>
          </article>
          <article className="card">
            <div className="icon">💸</div>
            <h3>Invoicing & Quotes</h3>
            <p>Generate quotes and invoices in seconds. Convert jobs to invoices with one click.</p>
          </article>
          <article className="card">
            <div className="icon">🗓️</div>
            <h3>Scheduling</h3>
            <p>Drag‑and‑drop calendar and a clean mobile schedule so your crew always knows what's next.</p>
          </article>
          <article className="card">
            <div className="icon">🛠️</div>
            <h3>Equipment</h3>
            <p>Track machines, serials, and service history. Scan and go when you're on site.</p>
          </article>
          <article className="card">
            <div className="icon">🧾</div>
            <h3>Payments & Xero</h3>
            <p>Stripe payments and Xero integration so you get paid faster and reconcile without pain.</p>
          </article>
        </div>
      </section>

      {/* Demo */}
      <section id="demo" className="demo container">
        <div className="demo-inner">
          <div className="mock">
            <div className="bar"><span className="dot" /><span className="dot" /><span className="dot" /></div>
            <div className="placeholder">Drop a 40s screen capture here</div>
          </div>
          <div>
            <h2 className="section-title" style={{textAlign:'left'}}>See Taska in action</h2>
            <p className="lead">Create a job, assign a tech, capture photos, and turn it into an invoice — all in under a minute. Replace this placeholder with a quick GIF or video to boost conversions.</p>
            <div className="hero-ctas">
              <a className="btn primary" href="/auth/register">Start your free trial</a>
              <a className="btn" href="/auth/login">Log in</a>
            </div>
            <div className="note">No credit card required · Cancel anytime</div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="pricing container">
        <h2 className="section-title">Choose your plan</h2>
        <p className="strip" style={{marginTop:12, marginBottom:22, background:'transparent', border:'none'}}>Start on any plan and upgrade as you grow</p>
        <div className="price-grid">
          <div className="price">
            <div>
              <span className="pill">Solo</span>
              <h4>Taska Solo</h4>
              <div className="amount"><span>$29</span><small>/month</small></div>
              <ul>
                <li><span className="tick">✓</span> 1 user, 1 team</li>
                <li><span className="tick">✓</span> Jobs, customers, equipment</li>
                <li><span className="tick">✓</span> Quotes & invoices</li>
                <li><span className="tick">✓</span> Email support</li>
              </ul>
            </div>
            <a className="btn cta" href="/auth/register?plan=solo">Choose Solo</a>
          </div>

          <div className="price popular">
            <div className="ribbon">Most Popular</div>
            <div>
              <span className="pill">Pro</span>
              <h4>Taska Pro</h4>
              <div className="amount"><span>$49</span><small>/month</small></div>
              <ul>
                <li><span className="tick">✓</span> Up to 5 users</li>
                <li><span className="tick">✓</span> Advanced scheduling</li>
                <li><span className="tick">✓</span> Customer portal & file uploads</li>
                <li><span className="tick">✓</span> Xero & Stripe integration</li>
              </ul>
            </div>
            <a className="btn primary cta" href="/auth/register?plan=pro">Choose Pro</a>
          </div>

          <div className="price">
            <div>
              <span className="pill">Enterprise</span>
              <h4>Taska Enterprise</h4>
              <div className="amount"><span>$99</span><small>/month</small></div>
              <ul>
                <li><span className="tick">✓</span> Unlimited users</li>
                <li><span className="tick">✓</span> SSO & advanced permissions</li>
                <li><span className="tick">✓</span> Priority support</li>
                <li><span className="tick">✓</span> Dedicated onboarding</li>
              </ul>
            </div>
            <a className="btn cta" href="/auth/register?plan=enterprise">Choose Enterprise</a>
          </div>
        </div>
        <p className="tiny container" style={{textAlign:'center', marginTop:16}}>All plans include 14‑day free trial · No setup fees · Cancel anytime</p>
      </section>

      {/* FAQ */}
      <section id="faq" className="faq container">
        <h2 className="section-title">Common questions</h2>
        <div className="faq-grid">
          <details>
            <summary>Do I need a credit card to start?</summary>
            <p>Nope. Start your 14‑day trial without a card. If Taska saves you time, upgrade in two clicks.</p>
          </details>
          <details>
            <summary>Is there a mobile app?</summary>
            <p>Yes — Taska runs beautifully on mobile. Your crew can see jobs, add notes, photos, and complete jobs on site.</p>
          </details>
          <details>
            <summary>Can I import my customers?</summary>
            <p>Absolutely. Upload a CSV and you're off. We'll guide you through it during onboarding.</p>
          </details>
          <details>
            <summary>Does Taska integrate with Xero?</summary>
            <p>Yes. Connect Xero to sync invoices and keep your books tight with minimal effort.</p>
          </details>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container foot">
          <div className="brand"><span className="logo" /><span>Taska</span></div>
          <div className="fine">© {new Date().getFullYear()} Taska. All rights reserved.</div>
        </div>
      </footer>
    </main>
  );
}
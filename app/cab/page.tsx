'use client';

import Link from 'next/link';

export default function Page() {
  return (
    <main className="page">
      <section className="card">
        <p>PRÓXIMA FASE</p>
        <h1>Agenda CAB</h1>
        <span>En Sprint 2 se podrá preparar la agenda de cambios a presentar, filtrando por fecha CAB y estado.</span>
        <Link href="/">← Volver al portal</Link>
      </section>
      <style jsx global>{`
        * { box-sizing:border-box; }
        html, body { margin:0; }
        body { background:#f2f7fa; }
        .page { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; border-top:6px solid #00c16e; font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:#073b5d; }
        .card { max-width:720px; background:white; border:1px solid #dfeaf0; border-radius:24px; padding:34px; box-shadow:0 18px 45px rgba(7,59,93,.07); }
        p { margin:0 0 10px; color:#00a967; font-size:13px; font-weight:950; letter-spacing:.16em; }
        h1 { font-size:54px; line-height:.95; letter-spacing:-.06em; margin:0 0 18px; }
        span { display:block; color:#5d7890; line-height:1.45; margin-bottom:24px; }
        a { color:#02568c; font-weight:900; text-decoration:none; }
      `}</style>
    </main>
  );
}

'use client';

import Link from 'next/link';

const cards = [
  {
    title: 'Aprobaciones',
    description: 'Gestiona y revisa el estado de aprobación por área de cada RDC antes de crear el PAP.',
    href: '/approvals',
    cta: 'Ver aprobaciones',
  },
  {
    title: 'Agenda CAB',
    description: 'Prepara los cambios a presentar en el comité, filtrando por fecha y estado.',
    href: '/cab',
    cta: 'Abrir agenda',
  },
  {
    title: 'Dashboard DORA',
    description: 'Métricas de entregas a producción, calidad, fallas y tendencias.',
    href: '/dashboard',
    cta: 'Ver métricas',
  },
];

const pendientes = [
  { area: 'DBA', n: 3 },
  { area: 'Release Mgmt', n: 5 },
  { area: 'Redes', n: 2 },
  { area: 'Seguridad', n: 1 },
];

export default function ReleaseHome() {
  return (
    <main className="rel">
      <section className="hero">
        <p className="kicker">ÁREA RELEASE MANAGEMENT</p>
        <h1>Gestión de cambios y métricas</h1>
        <p className="lead">
          Revisa aprobaciones, arma la agenda CAB, crea los PAP en Jira y monitorea las métricas DORA.
        </p>
      </section>

      <section className="cards">
        {cards.map((c) => (
          <Link className="card" href={c.href} key={c.title}>
            <h2>{c.title}</h2>
            <p>{c.description}</p>
            <strong>{c.cta} →</strong>
          </Link>
        ))}
      </section>

      <section className="panel">
        <div>
          <h2>Pendientes de aprobación</h2>
          <p>Identifica cuellos de botella por área antes de la ventana de implementación.</p>
        </div>
        <div className="stats">
          {pendientes.map((p) => (
            <div key={p.area}>
              <b>{p.area}</b>
              <span>{p.n} pendientes</span>
            </div>
          ))}
        </div>
      </section>

      <style jsx>{`
        .rel { max-width: 1100px; margin: 0 auto; padding: 40px 6vw 64px; }
        .kicker { color: var(--green-d); font-size: 13px; font-weight: 800; letter-spacing: 0.16em; margin: 0 0 12px; }
        h1 { font-size: clamp(30px, 4vw, 46px); line-height: 1.05; letter-spacing: -0.03em; color: var(--navy-d); margin: 0; }
        .lead { color: var(--ink-soft); font-size: 17px; line-height: 1.5; max-width: 62ch; margin: 14px 0 0; }
        .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 30px; }
        .card { background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 24px; display: flex; flex-direction: column; min-height: 170px; transition: 0.18s ease; }
        .card:hover { transform: translateY(-3px); box-shadow: 0 18px 40px -20px rgba(7, 59, 93, 0.25); }
        .card h2 { margin: 0 0 8px; font-size: 22px; letter-spacing: -0.02em; color: var(--navy-d); }
        .card p { color: var(--ink-soft); line-height: 1.45; margin: 0 0 18px; }
        .card strong { margin-top: auto; color: var(--green-d); font-weight: 700; }
        .panel { background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 24px; margin-top: 20px; display: flex; gap: 24px; justify-content: space-between; align-items: center; flex-wrap: wrap; }
        .panel h2 { margin: 0 0 6px; font-size: 20px; color: var(--navy-d); }
        .panel p { margin: 0; color: var(--ink-soft); }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; min-width: 460px; }
        .stats div { background: var(--bg); border-radius: 12px; padding: 14px; display: grid; gap: 5px; }
        .stats b { color: var(--navy-d); font-weight: 800; }
        .stats span { color: var(--green-d); font-weight: 700; font-size: 13px; }
        @media (max-width: 900px) { .cards { grid-template-columns: 1fr; } .stats { min-width: 0; width: 100%; grid-template-columns: 1fr 1fr; } }
      `}</style>
    </main>
  );
}

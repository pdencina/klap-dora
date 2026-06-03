'use client';

import Link from 'next/link';

const cards = [
  {
    title: 'Nuevo RDC',
    description: 'Registra un cambio de producción: descripción, responsables, fechas y plan de despliegue.',
    href: '/rdc',
    cta: 'Registrar cambio',
  },
  {
    title: 'Mis Cambios',
    description: 'Sigue el estado de tus RDC: aprobaciones por área y el PAP en Jira cuando queda listo.',
    href: '/mis-cambios',
    cta: 'Ver mis cambios',
  },
];

export default function HomePage() {
  return (
    <main className="home">
      <section className="hero">
        <p className="kicker">PORTAL DE CAMBIOS</p>
        <h1>Gestiona tus cambios de producción desde un solo lugar</h1>
        <p className="lead">
          Registra el RDC, sigue las aprobaciones por área y deja el dato listo para el paso a producción.
          Menos correos, más trazabilidad.
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

      <section className="flow">
        <h2>Cómo funciona</h2>
        <div className="steps">
          <div><b>1</b><span>Registrar RDC</span></div>
          <div><b>2</b><span>Aprobación por área</span></div>
          <div><b>3</b><span>Paso a producción (PAP)</span></div>
          <div><b>4</b><span>Cambio cerrado</span></div>
        </div>
      </section>

      <style jsx>{`
        .home { max-width: 1100px; margin: 0 auto; padding: 40px 6vw 64px; }
        .kicker { color: var(--green-d); font-size: 13px; font-weight: 800; letter-spacing: 0.16em; margin: 0 0 12px; }
        h1 { font-size: clamp(32px, 4.5vw, 52px); line-height: 1.05; letter-spacing: -0.03em; color: var(--navy-d); margin: 0; }
        .lead { color: var(--ink-soft); font-size: 18px; line-height: 1.5; max-width: 60ch; margin: 16px 0 0; }
        .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 32px; }
        .card { background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 26px; display: flex; flex-direction: column; min-height: 180px; transition: 0.18s ease; }
        .card:hover { transform: translateY(-3px); box-shadow: 0 18px 40px -20px rgba(7, 59, 93, 0.25); }
        .card h2 { margin: 0 0 8px; font-size: 24px; letter-spacing: -0.02em; color: var(--navy-d); }
        .card p { color: var(--ink-soft); line-height: 1.5; margin: 0 0 20px; }
        .card strong { margin-top: auto; color: var(--green-d); font-weight: 700; }
        .flow { background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 24px; margin-top: 22px; }
        .flow h2 { margin: 0 0 16px; font-size: 18px; color: var(--navy-d); }
        .steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .steps div { background: var(--bg); border-radius: 12px; padding: 14px; display: grid; gap: 6px; }
        .steps b { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border-radius: 999px; background: var(--green-soft); color: var(--green-d); font-size: 13px; }
        .steps span { font-weight: 600; color: var(--ink); font-size: 13px; }
        @media (max-width: 760px) { .cards, .steps { grid-template-columns: 1fr; } }
      `}</style>
    </main>
  );
}

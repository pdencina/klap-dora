'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createSupabaseBrowser } from '../lib/supabase-browser';

type Role = 'client' | 'approver' | 'rm';

const cardsByRole: Record<Role, Array<{ title: string; description: string; href: string; cta: string }>> = {
  client: [
    {
      title: 'Nuevo RDC',
      description: 'Registra un cambio de producción con estructura RDC 2.0: origen, impacto, riesgo, ejecución, despliegue y rollback.',
      href: '/rdc',
      cta: 'Registrar cambio',
    },
    {
      title: 'Mis Cambios',
      description: 'Sigue el estado de tus RDC: aprobaciones por área, evidencias y el PAP en Jira cuando queda listo.',
      href: '/mis-cambios',
      cta: 'Ver mis cambios',
    },
  ],
  approver: [
    {
      title: 'Mis Aprobaciones',
      description: 'Revisa las solicitudes CAB asignadas a tu correo, valida identidad con OTP y toma una decisión.',
      href: '/mis-aprobaciones',
      cta: 'Revisar pendientes',
    },
  ],
  rm: [
    {
      title: 'Nuevo RDC',
      description: 'Registra o apoya la carga de un cambio con la estructura completa del RDC 2.0.',
      href: '/rdc',
      cta: 'Registrar cambio',
    },
    {
      title: 'Agenda CAB',
      description: 'Gestiona bloqueos, riesgo, pendientes y readiness para PAP Jira.',
      href: '/cab',
      cta: 'Abrir agenda',
    },
    {
      title: 'Aprobaciones',
      description: 'Monitorea el estado de aprobaciones digitales y evidencias por RDC.',
      href: '/approvals',
      cta: 'Ver aprobaciones',
    },
    {
      title: 'Plan PAP',
      description: 'Construye el paso a producción desde el RDC aprobado: actividades, responsables, horarios, estados y evidencias.',
      href: '/pap',
      cta: 'Planificar PAP',
    },
    {
      title: 'Dashboard DORA',
      description: 'Consulta métricas de despliegue, lead time, fallos y recuperación.',
      href: '/dashboard',
      cta: 'Ver métricas',
    },
  ],
};

function getRole(user: any): Role {
  const raw = String(user?.app_metadata?.role || user?.user_metadata?.role || '').toLowerCase();
  if (raw === 'rm' || raw === 'release_manager' || raw === 'release-manager') return 'rm';
  if (raw === 'approver' || raw === 'aprobador') return 'approver';
  return 'client';
}

const roleText: Record<Role, { kicker: string; title: string; lead: string }> = {
  client: {
    kicker: 'CLIENTE INTERNO',
    title: 'Registra tus cambios de producción desde un solo lugar',
    lead: 'Completa el RDC, responde observaciones y sigue el estado hasta que quede listo para CAB y PAP Jira.',
  },
  approver: {
    kicker: 'APROBADOR CAB',
    title: 'Revisa y decide tus aprobaciones pendientes',
    lead: 'Entra a tus solicitudes, valida identidad por correo y deja una decisión trazable: aprobar, observar o rechazar.',
  },
  rm: {
    kicker: 'RELEASE MANAGEMENT',
    title: 'Gobierna el flujo completo RM / CAB / DORA',
    lead: 'Centraliza RDC, aprobaciones, evidencias, PAP Jira, implementación, cierre y métricas DORA.',
  },
};

export default function HomePage() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('client');
  const [showWelcome, setShowWelcome] = useState(false);

  const firstName = useMemo(() => {
    const local = email.split('@')[0] || '';
    const cleaned = local.replace(/[._-]+/g, ' ').trim();
    if (!cleaned) return 'bienvenido';
    return cleaned
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }, [email]);

  useEffect(() => {
    async function loadUser() {
      const supabase = createSupabaseBrowser();
      const { data } = await supabase.auth.getUser();
      const userEmail = data.user?.email || '';
      const userRole = getRole(data.user);

      setEmail(userEmail);
      setRole(userRole);

      if (!userEmail) return;

      const welcomeKey = `klap-dora-welcome-v2:${userEmail}:${userRole}`;
      const alreadySeen = window.localStorage.getItem(welcomeKey);

      const configuredEmails = (process.env.NEXT_PUBLIC_WELCOME_EMAILS || '')
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);

      const shouldShowByEmail =
        configuredEmails.length === 0 || configuredEmails.includes(userEmail.toLowerCase());

      if (!alreadySeen && shouldShowByEmail) {
        setShowWelcome(true);
        window.localStorage.setItem(welcomeKey, 'seen');
      }
    }

    loadUser();
  }, []);

  function closeWelcome() {
    setShowWelcome(false);
  }

  const cards = cardsByRole[role];
  const copy = roleText[role];

  return (
    <main className="home">
      {showWelcome ? (
        <div className="welcomeBackdrop" role="dialog" aria-modal="true">
          <section className="welcomeCard">
            <button className="welcomeClose" onClick={closeWelcome} aria-label="Cerrar">×</button>
            <span className="welcomeBadge">Bienvenido al portal</span>
            <h2>Hola {firstName}, bienvenido a Klap DORA</h2>
            <p>
              Este portal te muestra solo lo necesario para tu rol actual. Así el cliente interno registra,
              el aprobador decide y Release Management gobierna el flujo completo.
            </p>
            <div className="welcomeGrid">
              <div><b>1</b><span>RDC estructurado</span></div>
              <div><b>2</b><span>CAB digital</span></div>
              <div><b>3</b><span>PAP Jira</span></div>
              <div><b>4</b><span>DORA</span></div>
            </div>
            <div className="welcomeActions">
              {cards.map((card) => <Link key={card.href} href={card.href} onClick={closeWelcome}>{card.cta}</Link>)}
              <button onClick={closeWelcome}>Explorar portal</button>
            </div>
          </section>
        </div>
      ) : null}

      <section className="hero">
        <p className="kicker">{copy.kicker}</p>
        <h1>{copy.title}</h1>
        <p className="lead">{copy.lead}</p>
      </section>

      <section className={`cards ${cards.length === 1 ? 'single' : ''}`}>
        {cards.map((c) => (
          <Link className="card" href={c.href} key={c.title}>
            <h2>{c.title}</h2>
            <p>{c.description}</p>
            <strong>{c.cta} →</strong>
          </Link>
        ))}
      </section>

      <section className="flow">
        <h2>Flujo por roles</h2>
        <div className="steps">
          <div><b>1</b><span>Cliente interno crea RDC</span></div>
          <div><b>2</b><span>RM revisa y activa CAB</span></div>
          <div><b>3</b><span>Aprobador decide con OTP</span></div>
          <div><b>4</b><span>RM genera PAP y cierra</span></div>
        </div>
      </section>

      <style jsx>{`
        .home { max-width: 1100px; margin: 0 auto; padding: 40px 6vw 64px; }
        .kicker { color: var(--green-d); font-size: 13px; font-weight: 800; letter-spacing: 0.16em; margin: 0 0 12px; }
        h1 { font-size: clamp(32px, 4.5vw, 52px); line-height: 1.05; letter-spacing: -0.03em; color: var(--navy-d); margin: 0; }
        .lead { color: var(--ink-soft); font-size: 18px; line-height: 1.5; max-width: 65ch; margin: 16px 0 0; }
        .cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin-top: 32px; }
        .cards.single { grid-template-columns: minmax(0, 540px); }
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
        .welcomeBackdrop { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(1, 51, 86, .35); backdrop-filter: blur(8px); }
        .welcomeCard { position: relative; width: min(680px, 100%); background: #fff; border: 1px solid var(--line); border-radius: 24px; padding: 34px; box-shadow: 0 30px 90px rgba(7, 59, 93, .24); }
        .welcomeClose { position: absolute; top: 16px; right: 16px; width: 34px; height: 34px; border-radius: 999px; border: 1px solid var(--line); background: #fff; color: var(--ink-soft); font-size: 24px; cursor: pointer; }
        .welcomeBadge { display: inline-flex; background: var(--green-soft); color: var(--green-d); border-radius: 999px; padding: 8px 12px; font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        .welcomeCard h2 { margin: 16px 0 10px; color: var(--navy-d); font-size: clamp(28px, 4vw, 40px); letter-spacing: -.04em; line-height: 1; }
        .welcomeCard p { color: var(--ink-soft); line-height: 1.55; margin: 0; font-size: 16px; }
        .welcomeGrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 22px 0; }
        .welcomeGrid div { background: var(--bg); border: 1px solid var(--line); border-radius: 14px; padding: 13px; }
        .welcomeGrid b { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: var(--green); color: white; border-radius: 999px; font-size: 13px; margin-bottom: 8px; }
        .welcomeGrid span { color: var(--ink); font-size: 13px; font-weight: 700; }
        .welcomeActions { display: flex; gap: 10px; flex-wrap: wrap; }
        .welcomeActions a, .welcomeActions button { border: 0; background: var(--green); color: white; border-radius: 999px; padding: 12px 16px; font-weight: 800; font: inherit; cursor: pointer; }
        .welcomeActions button { background: #fff; color: var(--navy); border: 1px solid var(--line); }
        @media (max-width: 760px) { .cards, .steps, .welcomeGrid { grid-template-columns: 1fr; } .welcomeCard { padding: 26px; } }
      `}</style>
    </main>
  );
}

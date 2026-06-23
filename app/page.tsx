'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import { roleOf } from '@/lib/roles';

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
      title: 'Deploy Center',
      description: 'Ejecuta y monitorea pipelines Jenkins asociados a cambios aprobados, sin mezclarlo con el RDC.',
      href: '/deploy',
      cta: 'Abrir Deploy Center',
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
  const raw = roleOf(user);
  if (raw === 'rm' || raw === 'super_admin') return 'rm';
  if (raw === 'approver') return 'approver';
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
        .home { max-width: 1100px; margin: 0 auto; padding: 44px 6vw 64px; }
        .kicker { color: var(--green-d); font-size: 12px; font-weight: 900; letter-spacing: 0.18em; margin: 0 0 12px; text-transform: uppercase; }
        h1 { font-size: clamp(32px, 4.5vw, 48px); line-height: 1.08; letter-spacing: -0.04em; color: var(--navy-d); margin: 0; }
        .lead { color: var(--ink-soft); font-size: 17px; line-height: 1.55; max-width: 60ch; margin: 16px 0 0; }
        .cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin-top: 34px; }
        .cards.single { grid-template-columns: minmax(0, 540px); }
        .card { background: #fff; border: 1px solid var(--line); border-radius: 20px; padding: 28px; display: flex; flex-direction: column; min-height: 180px; transition: all 0.22s cubic-bezier(0.4,0,0.2,1); position: relative; overflow: hidden; }
        .card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, var(--green), var(--green-d)); opacity: 0; transition: opacity 0.22s; }
        .card:hover { transform: translateY(-3px); box-shadow: 0 20px 50px -18px rgba(7, 59, 93, 0.2); }
        .card:hover::before { opacity: 1; }
        .card h2 { margin: 0 0 10px; font-size: 22px; letter-spacing: -0.02em; color: var(--navy-d); }
        .card p { color: var(--ink-soft); line-height: 1.55; margin: 0 0 20px; font-size: 14px; }
        .card strong { margin-top: auto; color: var(--green-d); font-weight: 800; font-size: 14px; display: inline-flex; align-items: center; gap: 6px; }
        .flow { background: #fff; border: 1px solid var(--line); border-radius: 20px; padding: 26px; margin-top: 24px; }
        .flow h2 { margin: 0 0 18px; font-size: 17px; color: var(--navy-d); font-weight: 800; }
        .steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .steps div { background: var(--bg); border: 1px solid var(--line); border-radius: 14px; padding: 16px; display: grid; gap: 8px; transition: border-color 0.2s; }
        .steps div:hover { border-color: var(--green); }
        .steps b { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 999px; background: var(--green-soft); color: var(--green-d); font-size: 13px; font-weight: 900; }
        .steps span { font-weight: 700; color: var(--ink); font-size: 13px; }
        .welcomeBackdrop { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(1, 51, 86, .4); backdrop-filter: blur(10px); }
        .welcomeCard { position: relative; width: min(680px, 100%); background: #fff; border: 1px solid var(--line); border-radius: 24px; padding: 38px; box-shadow: 0 32px 100px rgba(7, 59, 93, .25); }
        .welcomeClose { position: absolute; top: 16px; right: 16px; width: 36px; height: 36px; border-radius: 999px; border: 1px solid var(--line); background: #fff; color: var(--ink-soft); font-size: 22px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
        .welcomeClose:hover { background: var(--red-soft); color: var(--red); border-color: #ffd6d2; }
        .welcomeBadge { display: inline-flex; background: var(--green-soft); color: var(--green-d); border-radius: 999px; padding: 8px 14px; font-size: 11px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
        .welcomeCard h2 { margin: 18px 0 12px; color: var(--navy-d); font-size: clamp(26px, 3.5vw, 36px); letter-spacing: -.04em; line-height: 1.05; }
        .welcomeCard p { color: var(--ink-soft); line-height: 1.55; margin: 0; font-size: 15px; }
        .welcomeGrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 24px 0; }
        .welcomeGrid div { background: var(--bg); border: 1px solid var(--line); border-radius: 14px; padding: 14px; }
        .welcomeGrid b { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--green), var(--green-d)); color: white; border-radius: 999px; font-size: 13px; margin-bottom: 10px; box-shadow: 0 3px 8px rgba(0,193,110,.3); }
        .welcomeGrid span { color: var(--ink); font-size: 13px; font-weight: 800; }
        .welcomeActions { display: flex; gap: 10px; flex-wrap: wrap; }
        .welcomeActions a, .welcomeActions button { border: 0; background: linear-gradient(135deg, var(--green), var(--green-d)); color: white; border-radius: 999px; padding: 12px 18px; font-weight: 800; font: inherit; font-size: 14px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,193,110,.3); transition: all 0.15s; }
        .welcomeActions a:hover, .welcomeActions button[type="button"]:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,193,110,.4); }
        .welcomeActions button { background: #fff; color: var(--navy); border: 1px solid var(--line); box-shadow: none; }
        .welcomeActions button:hover { background: var(--bg); }
        @media (max-width: 760px) { .cards, .steps, .welcomeGrid { grid-template-columns: 1fr; } .welcomeCard { padding: 26px; } }
      `}</style>
    </main>
  );
}

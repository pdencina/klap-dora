'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Approval = { id: string; approver_role: string; status: string };
type Change = {
  id: string;
  title: string;
  system?: string | null;
  cell?: string | null;
  category?: string | null;
  status: string;
  proposed_deploy_date?: string | null;
  jira_key?: string | null;
  created_at?: string | null;
  approval_requests?: Approval[];
};

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDIENTE_APROBACIONES: { label: 'Pendiente aprobación', cls: 'pending' },
  APROBADO_PARA_EJECUCION: { label: 'Aprobado para ejecución', cls: 'ok' },
  OBSERVADO: { label: 'Observado', cls: 'watch' },
  RECHAZADO: { label: 'Rechazado', cls: 'bad' },
};

const JIRA_BROWSE = 'https://multicaja-cloud.atlassian.net/browse/';

function fmtDate(d?: string | null) {
  if (!d) return 'Sin fecha';
  const date = new Date(d);
  if (isNaN(+date)) return String(d);
  return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function progress(c: Change) {
  const reqs = c.approval_requests || [];
  const total = reqs.length || 0;
  const approved = reqs.filter((r) => r.status === 'APROBADO').length;
  return { approved, total, pct: total ? Math.round((approved / total) * 100) : 0 };
}

export default function MisCambiosPage() {
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/rdc/mine', { cache: 'no-store' });
        const d = await r.json();
        if (!r.ok || !d.ok) throw new Error(d.error || 'No se pudieron cargar tus cambios');
        setChanges(Array.isArray(d.changes) ? d.changes : []);
      } catch (e: any) {
        setError(e?.message || 'Error cargando tus cambios');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rows = useMemo(
    () =>
      [...changes].sort(
        (a, b) => (b.created_at ? +new Date(b.created_at) : 0) - (a.created_at ? +new Date(a.created_at) : 0),
      ),
    [changes],
  );

  return (
    <main className="mine">
      <header className="head">
        <p className="kicker">PORTAL DE CAMBIOS</p>
        <h1>Mis Cambios</h1>
        <p className="sub">Estado de tus RDC: aprobaciones por área y el PAP en Jira cuando queda listo.</p>
      </header>

      {loading ? (
        <div className="state">Cargando tus cambios…</div>
      ) : error ? (
        <div className="state err">{error}</div>
      ) : rows.length === 0 ? (
        <div className="state empty">
          <p>Todavía no has registrado cambios.</p>
          <Link className="cta" href="/rdc">Registrar un RDC →</Link>
        </div>
      ) : (
        <div className="list">
          {rows.map((c) => {
            const st = STATUS[c.status] || { label: c.status, cls: 'pending' };
            const p = progress(c);
            return (
              <article className="card" key={c.id}>
                <div className="top">
                  <h3>{c.title}</h3>
                  <span className={`badge ${st.cls}`}>{st.label}</span>
                </div>
                <div className="meta">
                  {c.system ? <span>{c.system}</span> : null}
                  {c.cell ? <span>{c.cell}</span> : null}
                  {c.category ? <span>{c.category}</span> : null}
                  <span className="date">PAP propuesto: {fmtDate(c.proposed_deploy_date)}</span>
                </div>
                <div className="foot">
                  <div className="prog">
                    <div className="bar"><i style={{ width: `${p.pct}%` }} /></div>
                    <span>{p.approved}/{p.total} aprobaciones</span>
                  </div>
                  {c.jira_key ? (
                    <a className="jira" href={`${JIRA_BROWSE}${c.jira_key}`} target="_blank" rel="noreferrer">PAP {c.jira_key} ↗</a>
                  ) : (
                    <span className="nopap">PAP aún no creado</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <style jsx global>{`
        .mine { max-width: 960px; margin: 0 auto; padding: 36px 5vw 64px; }
        .mine .kicker { color: var(--green-d); font-size: 12px; font-weight: 900; letter-spacing: .18em; margin: 0 0 8px; text-transform: uppercase; }
        .mine h1 { font-size: clamp(28px, 3.5vw, 42px); line-height: 1.08; letter-spacing: -.04em; color: var(--navy-d); margin: 0; }
        .mine .sub { color: var(--ink-soft); margin: 10px 0 0; font-size: 15px; line-height: 1.5; }

        .mine .state { background: #fff; border: 1px solid var(--line); border-radius: var(--radius-lg); padding: 44px; text-align: center; color: var(--ink-soft); margin-top: 22px; box-shadow: var(--shadow-sm); }
        .mine .state.err { color: #b42318; background: #fff5f5; border-color: #fecaca; }
        .mine .state.empty .cta { display: inline-block; margin-top: 12px; color: var(--green-d); font-weight: 800; }

        .mine .list { display: grid; gap: 12px; margin-top: 22px; }
        .mine .card { background: #fff; border: 1px solid var(--line); border-radius: var(--radius-md); padding: 20px 22px; box-shadow: var(--shadow-sm); transition: all .2s; }
        .mine .card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
        .mine .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .mine .top h3 { margin: 0; font-size: 16px; color: var(--navy-d); letter-spacing: -.01em; font-weight: 800; }
        .mine .meta { display: flex; gap: 6px; flex-wrap: wrap; margin: 10px 0 16px; }
        .mine .meta span { font-size: 11px; font-weight: 700; color: var(--ink-soft); background: var(--bg); border-radius: var(--radius-pill); padding: 4px 10px; }
        .mine .meta .date { background: transparent; color: var(--ink-soft); padding-left: 0; }
        .mine .foot { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .mine .prog { flex: 1; min-width: 200px; }
        .mine .prog .bar { height: 6px; background: #e5eef3; border-radius: 999px; overflow: hidden; }
        .mine .prog .bar i { display: block; height: 100%; background: linear-gradient(90deg, var(--green), var(--green-d)); border-radius: 999px; transition: width .5s ease; }
        .mine .prog span { display: block; margin-top: 6px; font-size: 12px; color: var(--ink-soft); font-weight: 700; }
        .mine .badge { font-size: 11px; font-weight: 800; padding: 5px 11px; border-radius: var(--radius-pill); white-space: nowrap; }
        .mine .badge.pending { background: #fffbeb; color: #92630c; }
        .mine .badge.ok { background: var(--green-soft); color: var(--green-d); }
        .mine .badge.watch { background: #ecf7ff; color: var(--navy); }
        .mine .badge.bad { background: #fff5f5; color: #b42318; }
        .mine .jira { font-size: 13px; font-weight: 800; color: var(--navy); }
        .mine .nopap { font-size: 12px; color: #b45309; font-weight: 800; background: #fffbeb; padding: 4px 10px; border-radius: var(--radius-pill); }
      `}</style>
    </main>
  );
}

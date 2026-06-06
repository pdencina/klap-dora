'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { evaluateCabRoute, type CabRoute } from '../../lib/cab-routing';

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
  approval_requests?: Approval[];
  rdc_details?: any;
  form_data?: any;
};
type Annotated = Change & { _route: ReturnType<typeof evaluateCabRoute> };

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDIENTE_APROBACIONES: { label: 'Pendiente aprobación', cls: 'pending' },
  APROBADO_PARA_EJECUCION: { label: 'Aprobado', cls: 'ok' },
  OBSERVADO: { label: 'Observado', cls: 'watch' },
  RECHAZADO: { label: 'Rechazado', cls: 'bad' },
};

const ROUTE_TABS: Array<[CabRoute | 'ALL', string]> = [
  ['CAB', 'Requieren CAB'],
  ['DIGITAL', 'Aprobación digital'],
  ['ALL', 'Todos'],
];

const STATUS_FILTERS: Array<[string, string]> = [
  ['ALL', 'Todos los estados'],
  ['PENDIENTE_APROBACIONES', 'Pendientes'],
  ['APROBADO_PARA_EJECUCION', 'Aprobados'],
  ['OBSERVADO', 'Observados'],
  ['RECHAZADO', 'Rechazados'],
];

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

export default function CabPage() {
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [routeFilter, setRouteFilter] = useState<CabRoute | 'ALL'>('CAB');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/approvals/list', { cache: 'no-store' });
        const d = await r.json();
        if (!r.ok || !d.ok) throw new Error(d.error || 'No se pudo cargar la agenda');
        setChanges(Array.isArray(d.changes) ? d.changes : []);
      } catch (e: any) {
        setError(e?.message || 'Error cargando la agenda');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const annotated: Annotated[] = useMemo(
    () => changes.map((c) => ({ ...c, _route: evaluateCabRoute(c) })),
    [changes],
  );

  const routeCounts = useMemo(() => {
    let cab = 0;
    for (const c of annotated) if (c._route.route === 'CAB') cab++;
    return { CAB: cab, DIGITAL: annotated.length - cab, ALL: annotated.length };
  }, [annotated]);

  const rows = useMemo(() => {
    let list = annotated;
    if (routeFilter !== 'ALL') list = list.filter((c) => c._route.route === routeFilter);
    if (statusFilter !== 'ALL') list = list.filter((c) => c.status === statusFilter);
    return [...list].sort((a, b) => {
      const da = a.proposed_deploy_date ? +new Date(a.proposed_deploy_date) : Infinity;
      const db = b.proposed_deploy_date ? +new Date(b.proposed_deploy_date) : Infinity;
      return da - db;
    });
  }, [annotated, routeFilter, statusFilter]);

  return (
    <main className="cab">
      <header className="head">
        <p className="kicker">ÁREA RELEASE MANAGEMENT</p>
        <h1>Agenda CAB</h1>
        <p className="sub">La CAB se reserva para cambios críticos. El resto se aprueba digital por las áreas, sin reunión.</p>
      </header>

      <div className="summary">
        <div className="card cab"><b>{routeCounts.CAB}</b><span>requieren CAB</span></div>
        <div className="card digital"><b>{routeCounts.DIGITAL}</b><span>aprobación digital</span></div>
      </div>

      <div className="tabs">
        {ROUTE_TABS.map(([key, label]) => (
          <button key={key} className={`tab ${routeFilter === key ? 'active' : ''}`} onClick={() => setRouteFilter(key)}>
            {label}<span className="n">{routeCounts[key]}</span>
          </button>
        ))}
      </div>

      <div className="filters">
        {STATUS_FILTERS.map(([key, label]) => (
          <button key={key} className={`chip ${statusFilter === key ? 'active' : ''}`} onClick={() => setStatusFilter(key)}>{label}</button>
        ))}
      </div>

      {loading ? (
        <div className="state">Cargando agenda…</div>
      ) : error ? (
        <div className="state err">{error}</div>
      ) : rows.length === 0 ? (
        <div className="state">No hay cambios en este filtro.</div>
      ) : (
        <div className="list">
          {rows.map((c) => {
            const st = STATUS[c.status] || { label: c.status, cls: 'pending' };
            const p = progress(c);
            const isCab = c._route.route === 'CAB';
            return (
              <article className="row" key={c.id}>
                <div className="date">
                  <b>{fmtDate(c.proposed_deploy_date)}</b>
                  <span>PAP propuesto</span>
                </div>
                <div className="main">
                  <h3>{c.title}</h3>
                  <div className="route">
                    <span className={`rbadge ${isCab ? 'cab' : 'digital'}`}>{isCab ? 'Requiere CAB' : 'Aprobación digital'}</span>
                    {isCab && c._route.reasons.length ? <small>{c._route.reasons.join(' · ')}</small> : null}
                  </div>
                  <div className="meta">
                    {c.system ? <span>{c.system}</span> : null}
                    {c.cell ? <span>{c.cell}</span> : null}
                    {c.category ? <span>{c.category}</span> : null}
                  </div>
                </div>
                <div className="approvals">
                  <div className="bar"><i style={{ width: `${p.pct}%` }} /></div>
                  <span>{p.approved}/{p.total} aprobadas</span>
                </div>
                <div className="end">
                  <span className={`badge ${st.cls}`}>{st.label}</span>
                  {c.jira_key ? (
                    <a className="jira" href={`${JIRA_BROWSE}${c.jira_key}`} target="_blank" rel="noreferrer">{c.jira_key} ↗</a>
                  ) : (
                    <Link className="link" href={`/rdc/${c.id}`}>Ver detalle →</Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <style jsx global>{`
        .cab { max-width: 1040px; margin: 0 auto; padding: 32px 6vw 64px; }
        .cab .kicker { color: var(--green-d); font-size: 13px; font-weight: 800; letter-spacing: .16em; margin: 0 0 8px; }
        .cab h1 { font-size: clamp(30px, 4vw, 44px); line-height: 1.05; letter-spacing: -.03em; color: var(--navy-d); margin: 0; }
        .cab .sub { color: var(--ink-soft); margin: 10px 0 0; font-size: 16px; max-width: 70ch; }

        .cab .summary { display: grid; grid-template-columns: repeat(2, minmax(0, 220px)); gap: 12px; margin: 22px 0 18px; }
        .cab .summary .card { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 16px 18px; display: flex; align-items: baseline; gap: 10px; }
        .cab .summary .card b { font-size: 28px; letter-spacing: -.03em; }
        .cab .summary .card span { color: var(--ink-soft); font-weight: 700; font-size: 13px; }
        .cab .summary .card.cab { border-color: #ffd9b0; background: #fff8ef; }
        .cab .summary .card.cab b { color: #b5651d; }
        .cab .summary .card.digital { border-color: #9be7bf; background: #f0fff7; }
        .cab .summary .card.digital b { color: var(--green-d); }

        .cab .tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
        .cab .tab { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--line); background: #fff; color: var(--ink-soft); font: inherit; font-size: 14px; font-weight: 800; padding: 9px 16px; border-radius: 12px; cursor: pointer; }
        .cab .tab.active { border-color: var(--navy); background: var(--navy); color: #fff; }
        .cab .tab .n { background: #eef4f8; color: var(--navy); border-radius: 999px; padding: 1px 8px; font-size: 12px; }
        .cab .tab.active .n { background: rgba(255,255,255,.25); color: #fff; }

        .cab .filters { display: flex; gap: 8px; flex-wrap: wrap; margin: 0 0 18px; }
        .cab .chip { border: 1px solid var(--line); background: #fff; color: var(--ink-soft); font: inherit; font-size: 13px; font-weight: 700; padding: 7px 13px; border-radius: 999px; cursor: pointer; }
        .cab .chip.active { border-color: #9be7bf; background: var(--green-soft); color: var(--green-d); }

        .cab .state { background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 40px; text-align: center; color: var(--ink-soft); }
        .cab .state.err { color: #c0392b; }

        .cab .list { display: grid; gap: 12px; }
        .cab .row { display: grid; grid-template-columns: 120px 1fr 180px 170px; gap: 18px; align-items: center; background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 16px 18px; }
        .cab .date b { display: block; color: var(--navy-d); font-size: 14px; }
        .cab .date span { font-size: 11px; color: var(--ink-soft); font-weight: 600; }
        .cab .main h3 { margin: 0 0 8px; font-size: 16px; color: var(--ink); letter-spacing: -.01em; }
        .cab .route { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
        .cab .rbadge { font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 999px; }
        .cab .rbadge.cab { background: #fff1e0; color: #b5651d; }
        .cab .rbadge.digital { background: var(--green-soft); color: var(--green-d); }
        .cab .route small { color: var(--ink-soft); font-size: 12px; font-weight: 600; }
        .cab .meta { display: flex; gap: 6px; flex-wrap: wrap; }
        .cab .meta span { font-size: 11px; font-weight: 700; color: var(--ink-soft); background: var(--bg); border-radius: 999px; padding: 3px 9px; }
        .cab .approvals .bar { height: 7px; background: #eef4f8; border-radius: 999px; overflow: hidden; }
        .cab .approvals .bar i { display: block; height: 100%; background: var(--green); border-radius: 999px; transition: width .5s ease; }
        .cab .approvals span { display: block; margin-top: 6px; font-size: 12px; color: var(--ink-soft); font-weight: 600; }
        .cab .end { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
        .cab .badge { font-size: 11px; font-weight: 700; padding: 5px 11px; border-radius: 999px; }
        .cab .badge.pending { background: #fdf2e0; color: var(--amber); }
        .cab .badge.ok { background: var(--green-soft); color: var(--green-d); }
        .cab .badge.watch { background: #eef4f8; color: var(--navy); }
        .cab .badge.bad { background: #fff1f0; color: #c0392b; }
        .cab .jira { font-size: 12px; font-weight: 700; color: var(--navy); }
        .cab .link { font-size: 12px; font-weight: 700; color: var(--green-d); }

        @media (max-width: 820px) {
          .cab .summary { grid-template-columns: 1fr 1fr; }
          .cab .row { grid-template-columns: 1fr; gap: 10px; }
          .cab .end { align-items: flex-start; flex-direction: row; justify-content: space-between; }
        }
      `}</style>
    </main>
  );
}

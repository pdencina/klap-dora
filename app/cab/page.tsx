'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Approval = {
  id: string;
  approver_role: string;
  approver_name: string;
  approver_email?: string | null;
  status: string;
  approval_token?: string | null;
  approved_at?: string | null;
  approved_by_email?: string | null;
};

type Change = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  system?: string | null;
  cell?: string | null;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
  jira_key?: string | null;
  jira_origin?: string | null;
  rfc?: string | null;
  presenter?: string | null;
  technical_lead?: string | null;
  qa_analyst?: string | null;
  business_validator?: string | null;
  proposed_deploy_date?: string | null;
  validation_date?: string | null;
  deployment_result?: string | null;
  approval_requests?: Approval[];
};

const statusLabel: Record<string, string> = {
  PENDIENTE_APROBACIONES: 'En aprobación',
  APROBADO_PARA_EJECUCION: 'Listo para PAP',
  OBSERVADO: 'Observado',
  RECHAZADO: 'Rechazado',
};

const statusTone: Record<string, string> = {
  PENDIENTE_APROBACIONES: 'pending',
  APROBADO_PARA_EJECUCION: 'ok',
  OBSERVADO: 'watch',
  RECHAZADO: 'bad',
};

const filters = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'PENDIENTE_APROBACIONES', label: 'En aprobación' },
  { key: 'APROBADO_PARA_EJECUCION', label: 'Listos para PAP' },
  { key: 'OBSERVADO', label: 'Observados' },
  { key: 'RECHAZADO', label: 'Rechazados' },
];

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  try {
    return new Date(value).toLocaleDateString('es-CL');
  } catch {
    return value;
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Sin fecha';
  try {
    return new Date(value).toLocaleString('es-CL');
  } catch {
    return value;
  }
}

function getProgress(change: Change) {
  const approvals = change.approval_requests || [];
  const total = approvals.length || 1;
  const approved = approvals.filter((item) => item.status === 'APROBADO').length;
  const pending = approvals.filter((item) => item.status === 'PENDIENTE').length;
  const observed = approvals.filter((item) => item.status === 'OBSERVADO').length;
  const rejected = approvals.filter((item) => item.status === 'RECHAZADO').length;

  return {
    total,
    approved,
    pending,
    observed,
    rejected,
    percent: Math.round((approved / total) * 100),
  };
}

function getCabPriority(change: Change) {
  const progress = getProgress(change);
  if (progress.rejected > 0) return 'Bloqueado';
  if (progress.observed > 0) return 'Revisar observación';
  if (change.status === 'APROBADO_PARA_EJECUCION') return 'Preparar PAP';
  if (progress.pending > 0) return 'Gestionar pendientes';
  return 'Sin acción';
}

export default function CabAgendaPage() {
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [query, setQuery] = useState('');

  async function load() {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/approvals/list', { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'No fue posible cargar la agenda CAB');
      }

      setChanges(data.changes || []);
    } catch (err: any) {
      setError(err?.message || 'Error cargando agenda CAB');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filteredChanges = useMemo(() => {
    const text = query.trim().toLowerCase();

    return changes.filter((change) => {
      const byStatus = statusFilter === 'TODOS' || change.status === statusFilter;
      const byText = !text || [
        change.title,
        change.system,
        change.cell,
        change.category,
        change.presenter,
        change.jira_origin,
        change.jira_key,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(text);

      return byStatus && byText;
    });
  }, [changes, statusFilter, query]);

  const stats = useMemo(() => {
    const allApprovals = changes.flatMap((change) => change.approval_requests || []);

    return {
      total: changes.length,
      enAprobacion: changes.filter((change) => change.status === 'PENDIENTE_APROBACIONES').length,
      listosPap: changes.filter((change) => change.status === 'APROBADO_PARA_EJECUCION').length,
      observados: changes.filter((change) => change.status === 'OBSERVADO').length,
      rechazados: changes.filter((change) => change.status === 'RECHAZADO').length,
      pendientesAprobacion: allApprovals.filter((approval) => approval.status === 'PENDIENTE').length,
    };
  }, [changes]);

  const agendaText = useMemo(() => {
    return filteredChanges
      .map((change, index) => {
        const progress = getProgress(change);
        return `${index + 1}. ${change.title}\nSistema: ${change.system || 'Sin sistema'}\nEstado: ${statusLabel[change.status] || change.status}\nAvance: ${progress.approved}/${progress.total} (${progress.percent}%)\nFecha deploy: ${formatDate(change.proposed_deploy_date)}\nJira origen: ${change.jira_origin || 'No informado'}\n`;
      })
      .join('\n');
  }, [filteredChanges]);

  async function copyAgenda() {
    try {
      await navigator.clipboard.writeText(agendaText || 'Sin cambios en agenda CAB');
      alert('Agenda CAB copiada al portapapeles');
    } catch {
      alert('No fue posible copiar la agenda');
    }
  }

  return (
    <main className="page">
      <header className="header">
        <div>
          <p className="kicker">CAB Digital · Agenda de cambios</p>
          <h1>Agenda CAB</h1>
          <p>Prepara la reunión CAB con cambios priorizados, estado de aprobaciones, pendientes y readiness para PAP Jira.</p>
        </div>
        <div className="headerActions">
          <button onClick={load} className="ghost">Actualizar</button>
          <Link href="/" className="back">← Volver al portal</Link>
        </div>
      </header>

      <section className="summaryGrid">
        <div><span>RDC en agenda</span><strong>{stats.total}</strong></div>
        <div><span>En aprobación</span><strong>{stats.enAprobacion}</strong></div>
        <div><span>Listos para PAP</span><strong>{stats.listosPap}</strong></div>
        <div><span>Aprobaciones pendientes</span><strong>{stats.pendientesAprobacion}</strong></div>
      </section>

      <section className="toolbar">
        <div className="filters">
          {filters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setStatusFilter(filter.key)}
              className={statusFilter === filter.key ? 'activeFilter' : ''}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="searchBox">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por título, sistema, célula, Jira…"
          />
          <button onClick={copyAgenda}>Copiar agenda</button>
        </div>
      </section>

      {loading ? <div className="empty">Cargando agenda CAB…</div> : null}
      {error ? <div className="error">{error}</div> : null}
      {!loading && !error && filteredChanges.length === 0 ? (
        <div className="empty">No hay cambios que coincidan con el filtro seleccionado.</div>
      ) : null}

      <section className="agendaGrid">
        {filteredChanges.map((change) => {
          const progress = getProgress(change);
          const priority = getCabPriority(change);
          const tone = statusTone[change.status] || 'pending';
          const pendingApprovals = (change.approval_requests || []).filter((approval) => approval.status === 'PENDIENTE');
          const approvedApprovals = (change.approval_requests || []).filter((approval) => approval.status === 'APROBADO');

          return (
            <article className="changeCard" key={change.id}>
              <div className="cardTop">
                <div>
                  <div className="tagRow">
                    <span className="tag">RDC</span>
                    <span className={`statePill ${tone}`}>{statusLabel[change.status] || change.status}</span>
                    <span className="priority">{priority}</span>
                  </div>
                  <h2>{change.title}</h2>
                  <p>{change.system || 'Sin sistema'} · {change.cell || 'Sin célula'} · {change.category || 'Sin categoría'}</p>
                </div>
                <Link href={`/rdc/${change.id}`} className="openRdc">Abrir RDC →</Link>
              </div>

              <div className="metaGrid">
                <div><span>Fecha deploy</span><b>{formatDate(change.proposed_deploy_date)}</b></div>
                <div><span>Presentador</span><b>{change.presenter || change.created_by || 'No informado'}</b></div>
                <div><span>Jira origen</span><b>{change.jira_origin || 'No informado'}</b></div>
                <div><span>PAP Jira</span><b>{change.jira_key || 'Pendiente'}</b></div>
              </div>

              <div className="progressBox">
                <div className="progressHead">
                  <div>
                    <b>{progress.approved} / {progress.total} aprobaciones</b>
                    <span>{progress.percent}% completado</span>
                  </div>
                  <strong>{progress.percent}%</strong>
                </div>
                <div className="progressBar"><i style={{ width: `${progress.percent}%` }} /></div>
                <div className="progressStats">
                  <span className="okText">{progress.approved} aprobados</span>
                  <span>{progress.pending} pendientes</span>
                  <span className="watchText">{progress.observed} observados</span>
                  <span className="badText">{progress.rejected} rechazados</span>
                </div>
              </div>

              <div className="agendaColumns">
                <section>
                  <h3>Pendientes CAB</h3>
                  {pendingApprovals.length ? pendingApprovals.slice(0, 4).map((approval) => (
                    <div className="person" key={approval.id}>
                      <div><b>{approval.approver_role}</b><span>{approval.approver_name}</span></div>
                      <Link href={`/approve/${approval.approval_token || approval.id}`}>Solicitar</Link>
                    </div>
                  )) : <p className="muted">Sin pendientes.</p>}
                  {pendingApprovals.length > 4 ? <p className="muted">+{pendingApprovals.length - 4} pendientes adicionales</p> : null}
                </section>

                <section>
                  <h3>Evidencia registrada</h3>
                  {approvedApprovals.length ? approvedApprovals.slice(0, 4).map((approval) => (
                    <div className="person approved" key={approval.id}>
                      <div>
                        <b>{approval.approver_role}</b>
                        <span>{approval.approved_by_email || approval.approver_name}</span>
                        {approval.approved_at ? <small>{formatDateTime(approval.approved_at)}</small> : null}
                      </div>
                      <em>✓</em>
                    </div>
                  )) : <p className="muted">Aún no hay aprobaciones.</p>}
                </section>
              </div>
            </article>
          );
        })}
      </section>

      <style jsx global>{`
        *{box-sizing:border-box}html,body{margin:0}body{background:#edf5f9}
        a{color:inherit;text-decoration:none}button,input{font:inherit}
        .page{min-height:100vh;padding:26px 6vw 60px;border-top:6px solid #00c16e;color:#073b5d;background:radial-gradient(circle at top right,rgba(0,193,110,.10),transparent 32%),#edf5f9;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        .header,.summaryGrid,.toolbar,.agendaGrid,.empty,.error{max-width:1280px;margin:0 auto}
        .header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:24px}.kicker{margin:0 0 10px;color:#00a967;font-size:13px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}
        h1{font-size:56px;line-height:.95;letter-spacing:-.06em;margin:0 0 12px}.header p{color:#5d7890;max-width:820px;line-height:1.45;margin:0}.headerActions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
        .back,.ghost{background:white;border:1px solid #dfeaf0;border-radius:999px;padding:11px 16px;font-weight:950;color:#02568c}.ghost{cursor:pointer}
        .summaryGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:18px}.summaryGrid div,.toolbar,.changeCard,.empty,.error{background:white;border:1px solid #dfeaf0;border-radius:22px;box-shadow:0 18px 45px rgba(7,59,93,.07)}.summaryGrid div{padding:20px}.summaryGrid span{color:#5d7890;font-weight:900;font-size:13px}.summaryGrid strong{display:block;font-size:36px;margin-top:8px;color:#00a967}
        .toolbar{padding:14px;display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;margin-bottom:18px}.filters{display:flex;gap:8px;flex-wrap:wrap}.filters button,.searchBox button{border:0;border-radius:999px;padding:10px 13px;font-weight:950;cursor:pointer;background:#ecf7ff;color:#02568c}.filters button.activeFilter,.searchBox button{background:#00c16e;color:white}.searchBox{display:flex;gap:10px;align-items:center}input{min-width:320px;border:1px solid #d9e7ef;border-radius:999px;padding:11px 15px;color:#073b5d}
        .agendaGrid{display:grid;gap:18px}.changeCard{padding:22px}.cardTop{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.tagRow{display:flex;gap:9px;align-items:center;flex-wrap:wrap}.tag,.statePill,.priority{border-radius:999px;padding:7px 11px;font-size:12px;font-weight:950}.tag{background:#ecf7ff;color:#02568c}.priority{background:#f8fbfd;border:1px solid #e5eef3;color:#5d7890}.ok{background:#e8fff3;color:#008f57}.pending{background:#ecf7ff;color:#02568c}.watch{background:#fff7e6;color:#9a6700}.bad{background:#fff1f0;color:#b42318}
        h2{margin:16px 0 8px;font-size:30px;letter-spacing:-.04em}.changeCard p{margin:0;color:#5d7890}.openRdc{display:inline-flex;background:#fff7e6;color:#9a6700;border-radius:999px;padding:11px 15px;font-weight:950;white-space:nowrap}
        .metaGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:18px}.metaGrid div,.progressBox,.agendaColumns section{background:#f8fbfd;border:1px solid #e5eef3;border-radius:18px;padding:14px}.metaGrid span{display:block;color:#5d7890;font-size:12px;font-weight:900;margin-bottom:6px}.metaGrid b{display:block;font-size:15px}
        .progressBox{margin-top:14px}.progressHead{display:flex;justify-content:space-between;gap:14px;align-items:center}.progressHead b{display:block}.progressHead span,.progressStats span{color:#5d7890;font-size:13px;font-weight:900}.progressHead strong{font-size:36px;color:#00a967}.progressBar{height:13px;background:#e9f2f7;border-radius:999px;overflow:hidden;margin:12px 0}.progressBar i{display:block;height:100%;background:#00c16e;border-radius:inherit}.progressStats{display:flex;gap:10px;flex-wrap:wrap}.okText{color:#008f57!important}.watchText{color:#9a6700!important}.badText{color:#b42318!important}
        .agendaColumns{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.agendaColumns h3{margin:0 0 10px;font-size:16px}.person{display:flex;justify-content:space-between;gap:12px;align-items:center;background:white;border:1px solid #e5eef3;border-radius:14px;padding:11px;margin-top:9px}.person b,.person span,.person small{display:block}.person span,.person small,.muted{color:#5d7890;font-size:12px}.person a{background:#ecf7ff;color:#02568c;border-radius:999px;padding:8px 11px;font-size:12px;font-weight:950}.person em{font-style:normal;background:#e8fff3;color:#008f57;border-radius:999px;padding:8px 11px;font-weight:950}.empty,.error{padding:24px;margin-bottom:18px;color:#5d7890}.error{color:#b42318;background:#fff1f0;border-color:#ffd6d2}
        @media(max-width:1000px){.summaryGrid,.metaGrid,.agendaColumns{grid-template-columns:repeat(2,1fr)}.toolbar{grid-template-columns:1fr}.searchBox{justify-content:space-between}input{min-width:0;width:100%}}
        @media(max-width:700px){.page{padding:20px 18px 44px}.header,.cardTop,.progressHead{flex-direction:column}.summaryGrid,.metaGrid,.agendaColumns{grid-template-columns:1fr}.searchBox{flex-direction:column;align-items:stretch}.searchBox button{width:100%}h1{font-size:42px}}
      `}</style>
    </main>
  );
}

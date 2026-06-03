'use client';

import { useEffect, useMemo, useState } from 'react';

type Approval = {
  id: string;
  approver_role: string;
  approver_name: string;
  approver_email?: string | null;
  status: string;
  comment?: string | null;
  approved_at?: string | null;
  approved_by_email?: string | null;
  approval_token?: string | null;
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
  proposed_deploy_date?: string | null;
  validation_date?: string | null;
  deployment_result?: string | null;
  approval_requests: Approval[];
};

const filters = [
  { key: 'ALL', label: 'Todos' },
  { key: 'PENDIENTE_APROBACIONES', label: 'En aprobación' },
  { key: 'APROBADO_PARA_EJECUCION', label: 'Listos para PAP' },
  { key: 'OBSERVADO', label: 'Observados' },
  { key: 'RECHAZADO', label: 'Rechazados' },
];

const statusLabel: Record<string, string> = {
  PENDIENTE_APROBACIONES: 'En aprobación',
  APROBADO_PARA_EJECUCION: 'Listo para PAP',
  OBSERVADO: 'Observado',
  RECHAZADO: 'Rechazado',
};

const tone: Record<string, string> = {
  APROBADO: 'ok',
  PENDIENTE: 'pending',
  OBSERVADO: 'watch',
  RECHAZADO: 'bad',
};

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

function getCabRisk(change: Change) {
  const progress = getProgress(change);

  if (progress.rejected > 0) return { label: 'Alto', tone: 'bad', reason: 'Existe al menos un rechazo.' };
  if (progress.observed > 0) return { label: 'Medio', tone: 'watch', reason: 'Existe al menos una observación.' };
  if (progress.pending >= 5) return { label: 'Medio', tone: 'watch', reason: 'Aún hay muchas aprobaciones pendientes.' };
  if (progress.pending === 0) return { label: 'Bajo', tone: 'ok', reason: 'Todas las aprobaciones están completas.' };
  return { label: 'Controlado', tone: 'pending', reason: 'Pendiente de cierre CAB.' };
}

function getNextBlockers(change: Change) {
  return (change.approval_requests || []).filter((approval) => approval.status === 'PENDIENTE');
}

function buildAgendaText(changes: Change[]) {
  return changes.map((change, index) => {
    const progress = getProgress(change);
    const blockers = getNextBlockers(change).map((item) => item.approver_role).join(', ') || 'Sin pendientes';
    return [
      `${index + 1}. ${change.title}`,
      `Sistema: ${change.system || 'Sin sistema'}`,
      `Estado: ${statusLabel[change.status] || change.status}`,
      `Fecha deploy: ${formatDate(change.proposed_deploy_date)}`,
      `Avance CAB: ${progress.approved}/${progress.total} (${progress.percent}%)`,
      `Pendientes: ${blockers}`,
      `PAP Jira: ${change.jira_key || 'Pendiente'}`,
    ].join('\n');
  }).join('\n\n');
}

export default function CabAgendaPage() {
  const [changes, setChanges] = useState<Change[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    const normalized = query.trim().toLowerCase();

    return changes.filter((change) => {
      const matchesFilter = filter === 'ALL' || change.status === filter;
      const haystack = [
        change.title,
        change.system,
        change.cell,
        change.category,
        change.jira_origin,
        change.jira_key,
        change.presenter,
      ].filter(Boolean).join(' ').toLowerCase();

      return matchesFilter && (!normalized || haystack.includes(normalized));
    });
  }, [changes, filter, query]);

  const stats = useMemo(() => {
    const flat = changes.flatMap((change) => change.approval_requests || []);

    return {
      total: changes.length,
      inApproval: changes.filter((change) => change.status === 'PENDIENTE_APROBACIONES').length,
      ready: changes.filter((change) => change.status === 'APROBADO_PARA_EJECUCION').length,
      pendingApprovals: flat.filter((approval) => approval.status === 'PENDIENTE').length,
    };
  }, [changes]);

  async function copyAgenda() {
    const text = buildAgendaText(filteredChanges);
    await navigator.clipboard.writeText(text || 'Sin cambios en agenda');
    alert('Agenda CAB copiada al portapapeles');
  }

  function reminderMessage(change: Change, approval: Approval) {
    return [
      `Hola ${approval.approver_name},`,
      '',
      `Te comparto recordatorio de aprobación pendiente para el cambio: ${change.title}.`,
      `Área: ${approval.approver_role}`,
      `Sistema: ${change.system || 'Sin sistema'}`,
      `Fecha deploy: ${formatDate(change.proposed_deploy_date)}`,
      '',
      `Link de aprobación: ${window.location.origin}/approve/${approval.approval_token || approval.id}`,
      '',
      'Muchas gracias.',
    ].join('\n');
  }

  async function copyReminder(change: Change, approval: Approval) {
    await navigator.clipboard.writeText(reminderMessage(change, approval));
    alert(`Recordatorio copiado para ${approval.approver_role}`);
  }

  return (
    <main className="page">
      <header className="header">
        <div>
          <p className="kicker">CAB Digital · Agenda de cambios</p>
          <h1>Agenda CAB</h1>
          <p>Prepara la reunión CAB con cambios priorizados, bloqueos, riesgo, evidencias y readiness para PAP Jira.</p>
        </div>
        <div className="headerActions">
          <button onClick={load} className="secondary">Actualizar</button>
          <a className="back" href="/">← Volver al portal</a>
        </div>
      </header>

      <section className="summaryGrid">
        <div><span>RDC en agenda</span><strong>{stats.total}</strong></div>
        <div><span>En aprobación</span><strong>{stats.inApproval}</strong></div>
        <div><span>Listos para PAP</span><strong>{stats.ready}</strong></div>
        <div><span>Aprobaciones pendientes</span><strong>{stats.pendingApprovals}</strong></div>
      </section>

      <section className="toolbar">
        <div className="filters">
          {filters.map((item) => (
            <button
              key={item.key}
              className={filter === item.key ? 'active' : 'secondary'}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="searchActions">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por título, sistema, célula, Jira..."
          />
          <button onClick={copyAgenda}>Copiar agenda</button>
        </div>
      </section>

      {loading ? <div className="empty">Cargando agenda CAB…</div> : null}
      {error ? <div className="error">{error}</div> : null}
      {!loading && !error && filteredChanges.length === 0 ? <div className="empty">No hay cambios para este filtro.</div> : null}

      <section className="agendaList">
        {filteredChanges.map((change) => {
          const progress = getProgress(change);
          const risk = getCabRisk(change);
          const blockers = getNextBlockers(change);
          const approvedEvidence = (change.approval_requests || []).filter((approval) => approval.status !== 'PENDIENTE');
          const primaryBlocker = blockers[0];

          return (
            <article className="card" key={change.id}>
              <div className="cardHeader">
                <div>
                  <div className="tagRow">
                    <span className="tag">RDC</span>
                    <span className={`pill ${risk.tone}`}>Riesgo {risk.label}</span>
                    <span className="pill pending">{statusLabel[change.status] || change.status}</span>
                  </div>
                  <h2>{change.title}</h2>
                  <p>{change.system || 'Sin sistema'} · {change.cell || 'Sin célula'} · {change.category || 'Sin categoría'}</p>
                </div>

                <div className="cardActions">
                  {change.status === 'APROBADO_PARA_EJECUCION' && !change.jira_key ? (
                    <span className="mainAction ok">Listo para generar PAP</span>
                  ) : change.jira_key ? (
                    <span className="mainAction ok">PAP creado: {change.jira_key}</span>
                  ) : (
                    <span className="mainAction pending">Esperando aprobaciones</span>
                  )}
                  <a className="openRdc" href={`/rdc/${change.id}`}>Abrir RDC →</a>
                </div>
              </div>

              <div className="cabInsight">
                <div className="blockerBox">
                  <span>Próximo bloqueo</span>
                  <b>{primaryBlocker ? `${primaryBlocker.approver_role} · ${primaryBlocker.approver_name}` : 'Sin bloqueos pendientes'}</b>
                  <small>{primaryBlocker ? 'Se requiere aprobación para avanzar.' : 'El cambio está listo para la siguiente etapa.'}</small>
                </div>
                <div className={`riskBox ${risk.tone}`}>
                  <span>Riesgo CAB</span>
                  <b>{risk.label}</b>
                  <small>{risk.reason}</small>
                </div>
              </div>

              <div className="metaGrid">
                <div><span>Fecha deploy</span><b>{formatDate(change.proposed_deploy_date)}</b></div>
                <div><span>Presentador</span><b>{change.presenter || 'No informado'}</b></div>
                <div><span>Jira origen</span><b>{change.jira_origin || 'No informado'}</b></div>
                <div><span>PAP Jira</span><b>{change.jira_key || 'Pendiente'}</b></div>
              </div>

              <div className="progressArea">
                <div className="progressTop">
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

              <div className="split">
                <section className="panel">
                  <h3>Pendientes CAB</h3>
                  {blockers.length === 0 ? <p className="muted">Sin pendientes CAB.</p> : null}
                  {blockers.map((approval) => (
                    <div className="approvalLine" key={approval.id}>
                      <div>
                        <b>{approval.approver_role}</b>
                        <span>{approval.approver_name}</span>
                      </div>
                      <div className="lineActions">
                        <button className="secondary small" onClick={() => copyReminder(change, approval)}>Copiar recordatorio</button>
                        <a href={`/approve/${approval.approval_token || approval.id}`} target="_blank" rel="noreferrer">Abrir</a>
                      </div>
                    </div>
                  ))}
                </section>

                <section className="panel">
                  <h3>Historial CAB</h3>
                  {approvedEvidence.length === 0 ? <p className="muted">Aún no hay aprobaciones registradas.</p> : null}
                  {approvedEvidence.map((approval) => (
                    <div className="evidenceLine" key={approval.id}>
                      <div>
                        <b>{approval.approver_role}</b>
                        <span>{approval.approver_name}</span>
                        {approval.approved_by_email ? <small>{approval.approved_by_email}</small> : null}
                      </div>
                      <em className={tone[approval.status] || 'pending'}>{approval.status}</em>
                    </div>
                  ))}
                </section>
              </div>
            </article>
          );
        })}
      </section>

      <style jsx global>{`
        *{box-sizing:border-box}html,body{margin:0}body{background:#edf5f9}a{color:inherit;text-decoration:none}
        .page{min-height:100vh;padding:26px 6vw 60px;border-top:6px solid #00c16e;color:#073b5d;background:radial-gradient(circle at top right,rgba(0,193,110,.10),transparent 32%),#edf5f9;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        .header,.summaryGrid,.toolbar,.agendaList,.empty,.error{max-width:1280px;margin:0 auto}.header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:24px}
        .kicker{margin:0 0 10px;color:#00a967;font-size:13px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}
        h1{font-size:56px;line-height:.95;letter-spacing:-.06em;margin:0 0 12px}.header p{color:#5d7890;max-width:860px;line-height:1.45;margin:0}.headerActions{display:flex;gap:10px;align-items:center}
        .back,.secondary,button{border:0;border-radius:999px;padding:11px 16px;font-weight:950;cursor:pointer}.back,.secondary{background:white;border:1px solid #dfeaf0;color:#02568c}button{background:#00c16e;color:white}.small{padding:8px 11px;font-size:12px}
        .summaryGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px}.summaryGrid div,.toolbar,.card,.empty,.error{background:white;border:1px solid #dfeaf0;border-radius:22px;box-shadow:0 18px 45px rgba(7,59,93,.07)}.summaryGrid div{padding:20px}.summaryGrid span{color:#5d7890;font-weight:900;font-size:13px}.summaryGrid strong{display:block;font-size:36px;margin-top:8px;color:#00a967}
        .toolbar{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:14px;margin-bottom:18px}.filters,.searchActions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.active{background:#00c16e;color:white}.searchActions input{min-width:320px;border:1px solid #d9e7ef;border-radius:999px;padding:12px 16px;font:inherit;color:#073b5d}
        .agendaList{display:grid;gap:18px}.card{padding:22px}.cardHeader{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.tagRow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.tag,.pill,.mainAction{padding:7px 12px;border-radius:999px;font-weight:950;font-size:12px}.tag{background:#ecf7ff;color:#02568c}.ok{background:#e8fff3!important;color:#008f57!important}.pending{background:#ecf7ff!important;color:#02568c!important}.watch{background:#fff7e6!important;color:#9a6700!important}.bad{background:#fff1f0!important;color:#b42318!important}
        h2{margin:16px 0 8px;font-size:30px;letter-spacing:-.04em}.card p{margin:0;color:#5d7890}.cardActions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.openRdc{background:#fff7e6;color:#9a6700;border-radius:999px;padding:10px 14px;font-weight:950}
        .cabInsight{display:grid;grid-template-columns:1.2fr .8fr;gap:12px;margin-top:18px}.blockerBox,.riskBox,.metaGrid div,.progressArea,.panel{background:#f8fbfd;border:1px solid #e5eef3;border-radius:18px;padding:14px}.blockerBox span,.riskBox span,.metaGrid span{display:block;color:#5d7890;font-size:12px;font-weight:900;margin-bottom:6px}.blockerBox b,.riskBox b,.metaGrid b{display:block}.blockerBox small,.riskBox small{display:block;color:#5d7890;margin-top:6px}
        .metaGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:14px}.progressArea{margin-top:14px}.progressTop{display:flex;justify-content:space-between;gap:14px;align-items:center}.progressTop b{display:block;font-size:18px}.progressTop span,.progressStats span{color:#5d7890;font-weight:900;font-size:13px}.progressTop strong{font-size:36px;color:#00a967}.progressBar{height:13px;background:#e9f2f7;border-radius:999px;overflow:hidden;margin:12px 0}.progressBar i{display:block;height:100%;background:#00c16e;border-radius:inherit}.progressStats{display:flex;flex-wrap:wrap;gap:10px}.okText{color:#008f57!important}.watchText{color:#9a6700!important}.badText{color:#b42318!important}
        .split{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.panel h3{margin:0 0 12px;font-size:18px}.approvalLine,.evidenceLine{display:flex;justify-content:space-between;gap:12px;align-items:center;background:white;border:1px solid #e5eef3;border-radius:14px;padding:12px;margin-top:8px}.approvalLine b,.evidenceLine b{display:block}.approvalLine span,.evidenceLine span,.evidenceLine small,.muted{display:block;color:#5d7890;font-size:13px}.lineActions{display:flex;gap:8px;align-items:center}.lineActions a{background:#ecf7ff;color:#02568c;border-radius:999px;padding:8px 11px;font-weight:950;font-size:12px}em{font-style:normal;border-radius:999px;padding:7px 10px;font-weight:950;font-size:11px;white-space:nowrap}
        .empty,.error{padding:24px;margin-bottom:18px;color:#5d7890}.error{color:#b42318;background:#fff1f0;border-color:#ffd6d2}
        @media(max-width:1000px){.summaryGrid,.metaGrid,.split,.cabInsight{grid-template-columns:repeat(2,1fr)}}@media(max-width:760px){.page{padding:20px 18px 44px}.header,.toolbar,.cardHeader,.progressTop{flex-direction:column;align-items:flex-start}.summaryGrid,.metaGrid,.split,.cabInsight{grid-template-columns:1fr}.searchActions input{min-width:100%;width:100%}h1{font-size:42px}.headerActions,.cardActions{justify-content:flex-start}}
      `}</style>
    </main>
  );
}

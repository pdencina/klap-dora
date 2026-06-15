'use client';

import { useEffect, useMemo, useState } from 'react';

type Approval = {
  id: string;
  approver_role: string;
  approver_name: string;
  status: string;
  approval_token?: string | null;
  approved_at?: string | null;
  approved_by_email?: string | null;
};

type Change = {
  id: string;
  title: string;
  system?: string | null;
  status: string;
  approval_requests: Approval[];
  jira_key?: string | null;
};

const stateLabel: Record<string, string> = {
  PENDIENTE_APROBACIONES: 'Pendiente aprobación',
  APROBADO_PARA_EJECUCION: 'Aprobado para ejecución',
  PAP_CREADO: 'Plan PAP creado',
  EN_IMPLEMENTACION: 'En implementación',
  OBSERVADO: 'Observado',
  RECHAZADO: 'Rechazado',
};

const tone: Record<string, string> = {
  APROBADO: 'ok',
  PENDIENTE: 'pending',
  OBSERVADO: 'watch',
  RECHAZADO: 'bad',
};

function getProgress(change: Change) {
  const approvals = change.approval_requests || [];
  const total = approvals.length || 1;
  const approved = approvals.filter((item) => item.status === 'APROBADO').length;
  const pending = approvals.filter((item) => item.status === 'PENDIENTE').length;
  const observed = approvals.filter((item) => item.status === 'OBSERVADO').length;
  const rejected = approvals.filter((item) => item.status === 'RECHAZADO').length;

  return {
    approved,
    pending,
    observed,
    rejected,
    total,
    percent: Math.round((approved / total) * 100),
    cabState: rejected > 0 ? 'Rechazado' : observed > 0 ? 'Observado' : pending === 0 ? 'Listo para PAP' : 'En aprobación',
  };
}

export default function ApprovalsPage() {
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  async function load() {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/approvals/list', { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'No fue posible cargar aprobaciones');
      }

      setChanges(data.changes || []);
    } catch (err: any) {
      setError(err?.message || 'Error cargando aprobaciones');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createPap(rdcId: string) {
    try {
      setBusyId(rdcId);

      const response = await fetch('/api/jira/create-pap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rdcId }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        const detail = data.details ? `\n${JSON.stringify(data.details, null, 2)}` : '';
        throw new Error((data.error || 'No fue posible crear PAP Jira') + detail);
      }

      alert(data.alreadyCreated ? `PAP ya creado: ${data.jiraKey}` : `PAP creado correctamente: ${data.jiraKey}`);
      await load();
    } catch (err: any) {
      alert(err?.message || 'Error creando PAP Jira');
    } finally {
      setBusyId('');
    }
  }

  const stats = useMemo(() => {
    const flat = changes.flatMap((change) => change.approval_requests || []);

    return {
      cambios: changes.length,
      pendientes: flat.filter((approval) => approval.status === 'PENDIENTE').length,
      listos: changes.filter((change) => change.status === 'APROBADO_PARA_EJECUCION').length,
      observados: changes.filter((change) => change.status === 'OBSERVADO').length,
      rechazados: changes.filter((change) => change.status === 'RECHAZADO').length,
    };
  }, [changes]);

  return (
    <main className="page">
      <header className="header">
        <div>
          <p className="kicker">CAB DIGITAL · Release Management</p>
          <h1>Aprobaciones</h1>
          <p>Vista ejecutiva para seguimiento de RDC, aprobadores, evidencias y readiness para PAP Jira.</p>
        </div>
        <a href="/" className="back">← Volver al portal</a>
      </header>

      <section className="summaryGrid">
        <div><span>RDC activos</span><strong>{stats.cambios}</strong></div>
        <div><span>Aprobaciones pendientes</span><strong>{stats.pendientes}</strong></div>
        <div><span>Listos para PAP</span><strong>{stats.listos}</strong></div>
        <div><span>Observados / Rechazados</span><strong>{stats.observados + stats.rechazados}</strong></div>
      </section>

      {loading ? <div className="empty">Cargando aprobaciones…</div> : null}
      {error ? <div className="error">{error}</div> : null}
      {!loading && !error && changes.length === 0 ? <div className="empty">No hay RDC registrados todavía. Crea uno desde /rdc.</div> : null}

      <section className="list">
        {changes.map((change) => {
          const progress = getProgress(change);
          const cabTone = progress.rejected > 0 ? 'bad' : progress.observed > 0 ? 'watch' : progress.pending === 0 ? 'ok' : 'watch';

          return (
            <article className="card" key={change.id}>
              <div className="cardHead">
                <div>
                  <div className="tagRow">
                    <span className="tag">RDC</span>
                    <span className={`cabPill ${cabTone}`}>{progress.cabState}</span>
                  </div>
                  <h2>{change.title}</h2>
                  <p>{change.system || 'Sin sistema'} · {stateLabel[change.status] || change.status}</p>
                </div>

                <div className="cardActions">
                  {change.status === 'APROBADO_PARA_EJECUCION' ? (
                    change.jira_key ? (
                      <button className="secondary">PAP creado: {change.jira_key}</button>
                    ) : (
                      <button disabled={busyId === change.id} onClick={() => createPap(change.id)}>
                        {busyId === change.id ? 'Creando PAP…' : 'Crear PAP Jira'}
                      </button>
                    )
                  ) : (
                    <a className="detailLink" href={`/rdc/${change.id}`}>Abrir RDC →</a>
                  )}
                </div>
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

              <div className="approvers">
                {(change.approval_requests || []).map((approval) => (
                  <div className="approver" key={approval.id}>
                    <div className="approverTop">
                      <div>
                        <b>{approval.approver_role}</b>
                        <span>{approval.approver_name}</span>
                        {approval.approved_at ? <small>{new Date(approval.approved_at).toLocaleString('es-CL')}</small> : null}
                        {approval.approved_by_email ? <small>{approval.approved_by_email}</small> : null}
                      </div>
                      <em className={tone[approval.status] || 'pending'}>{approval.status}</em>
                    </div>
                    <a className="approvalLink" href={`/approve/${approval.approval_token || approval.id}`} target="_blank" rel="noreferrer">
                      Abrir aprobación
                    </a>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <style jsx global>{`
        .page { min-height:100vh; padding:26px 6vw 60px; border-top:6px solid #00c16e; color:#073b5d; background:radial-gradient(circle at top right,rgba(0,193,110,.10),transparent 32%),#edf5f9; font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .header, .summaryGrid, .list, .empty, .error { max-width:1280px; margin:0 auto; }
        .header { display:flex; justify-content:space-between; gap:24px; align-items:flex-start; margin-bottom:24px; }
        .kicker { margin:0 0 10px; color:#00a967; font-size:13px; font-weight:950; letter-spacing:.16em; }
        h1 { font-size:56px; line-height:.95; letter-spacing:-.06em; margin:0 0 12px; }
        .header p { color:#5d7890; max-width:860px; line-height:1.45; margin:0; }
        .back { background:white; border:1px solid #dfeaf0; border-radius:999px; padding:11px 16px; font-weight:900; color:#02568c; }
        .summaryGrid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:20px; }
        .summaryGrid div, .card, .empty, .error { background:white; border:1px solid #dfeaf0; border-radius:22px; box-shadow:0 18px 45px rgba(7,59,93,.07); }
        .summaryGrid div { padding:20px; }
        .summaryGrid span { color:#5d7890; font-weight:900; font-size:13px; }
        .summaryGrid strong { display:block; font-size:36px; margin-top:8px; color:#00a967; }
        .list { display:grid; gap:18px; }
        .card { padding:22px; }
        .cardHead { display:flex; justify-content:space-between; gap:18px; align-items:flex-start; }
        .tagRow { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
        .tag, .cabPill { padding:7px 12px; border-radius:999px; font-weight:950; font-size:12px; }
        .tag { background:#ecf7ff; color:#02568c; }
        .ok { background:#e8fff3; color:#008f57; }
        .pending { background:#ecf7ff; color:#02568c; }
        .watch { background:#fff7e6; color:#9a6700; }
        .bad { background:#fff1f0; color:#b42318; }
        h2 { margin:16px 0 8px; font-size:28px; letter-spacing:-.04em; }
        .card p { margin:0; color:#5d7890; }
        button { border:0; background:#00c16e; color:white; border-radius:999px; padding:10px 14px; font-weight:950; cursor:pointer; }
        button:disabled { opacity:.55; cursor:not-allowed; }
        button.secondary { background:#fff7e6; color:#9a6700; }
        .detailLink { display:inline-flex; align-items:center; justify-content:center; background:#fff7e6; color:#9a6700; border-radius:999px; padding:10px 14px; font-weight:950; }
        .progressArea { margin-top:20px; background:#f8fbfd; border:1px solid #e5eef3; border-radius:18px; padding:16px; }
        .progressTop { display:flex; justify-content:space-between; gap:14px; align-items:center; }
        .progressTop b { display:block; font-size:18px; }
        .progressTop span, .progressStats span { color:#5d7890; font-weight:900; font-size:13px; }
        .progressTop strong { font-size:34px; color:#00a967; }
        .progressBar { height:13px; background:#e9f2f7; border-radius:999px; overflow:hidden; margin:12px 0; }
        .progressBar i { display:block; height:100%; background:#00c16e; border-radius:inherit; }
        .progressStats { display:flex; flex-wrap:wrap; gap:10px; }
        .okText { color:#008f57 !important; }
        .watchText { color:#9a6700 !important; }
        .badText { color:#b42318 !important; }
        .approvers { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; margin:18px 0 0; }
        .approver { background:#f8fbfd; border:1px solid #e5eef3; border-radius:16px; padding:14px; display:grid; gap:12px; }
        .approverTop { display:flex; justify-content:space-between; gap:14px; align-items:flex-start; }
        .approver b { display:block; }
        .approver span, .approver small { display:block; color:#5d7890; font-size:13px; }
        em { justify-self:start; font-style:normal; border-radius:999px; padding:7px 10px; font-weight:950; font-size:12px; white-space:nowrap; }
        em.ok { background:#e8fff3; color:#008f57; }
        em.pending { background:#ecf7ff; color:#02568c; }
        em.watch { background:#fff7e6; color:#9a6700; }
        em.bad { background:#fff1f0; color:#b42318; }
        .approvalLink { justify-self:start; display:inline-flex; background:#ecf7ff; color:#02568c; border-radius:999px; padding:8px 11px; font-weight:950; font-size:12px; text-decoration:none; }
        .empty, .error { padding:24px; margin-bottom:18px; color:#5d7890; }
        .error { color:#b42318; background:#fff1f0; border-color:#ffd6d2; }
        @media(max-width: 1000px) { .summaryGrid, .approvers { grid-template-columns:repeat(2,1fr); } }
        @media(max-width: 700px) { .page { padding:20px 18px 44px; } .header, .cardHead, .progressTop { flex-direction:column; align-items:flex-start; } h1 { font-size:42px; } .summaryGrid, .approvers { grid-template-columns:1fr; } button { width:100%; } }
      `}</style>
    </main>
  );
}

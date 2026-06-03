'use client';

import { useParams } from 'next/navigation';
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
  created_by?: string | null;
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
  approval_requests: Approval[];
};

const tone: Record<string, string> = {
  APROBADO: 'ok',
  PENDIENTE: 'pending',
  OBSERVADO: 'watch',
  RECHAZADO: 'bad',
};

const statusLabel: Record<string, string> = {
  PENDIENTE_APROBACIONES: 'Pendiente aprobaciones CAB',
  APROBADO_PARA_EJECUCION: 'Aprobado para ejecución',
  OBSERVADO: 'Observado',
  RECHAZADO: 'Rechazado',
};

function formatDate(value?: string | null) {
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

export default function RdcDetailPage() {
  const params = useParams();
  const id = useMemo(() => String(params?.id || ''), [params]);

  const [change, setChange] = useState<Change | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/approvals/list', { cache: 'no-store' });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'No fue posible cargar RDC');
      }

      const found = (data.changes || []).find((item: Change) => item.id === id);

      if (!found) {
        throw new Error('RDC no encontrado');
      }

      setChange(found);
    } catch (err: any) {
      setError(err?.message || 'Error cargando RDC');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  const progress = change ? getProgress(change) : null;
  const cabState = progress
    ? progress.rejected > 0
      ? 'CAB RECHAZADO'
      : progress.observed > 0
        ? 'CAB OBSERVADO'
        : progress.pending === 0
          ? 'LISTO PARA PAP'
          : 'CAB EN APROBACIÓN'
    : 'CARGANDO';

  const cabTone = progress
    ? progress.rejected > 0
      ? 'bad'
      : progress.observed > 0
        ? 'watch'
        : progress.pending === 0
          ? 'ok'
          : 'pending'
    : 'pending';

  return (
    <main className="page">
      <header className="header">
        <div>
          <p className="kicker">RDC · Vista maestra del cambio</p>
          <h1>{change?.title || 'Detalle RDC'}</h1>
          <p>Resumen ejecutivo, aprobación CAB, evidencias y trazabilidad del cambio.</p>
        </div>
        <div className="headerActions">
          <span className={`cabState ${cabTone}`}>{cabState}</span>
          <a className="back" href="/approvals">← Volver a aprobaciones</a>
        </div>
      </header>

      {loading ? <div className="empty">Cargando RDC…</div> : null}
      {error ? <div className="error">{error}</div> : null}

      {change && progress ? (
        <section className="layout">
          <article className="mainCard">
            <section className="executive">
              <div className="sectionHead">
                <div>
                  <p className="sectionLabel">Resumen ejecutivo</p>
                  <h2>{change.title}</h2>
                </div>
                <span className={`statePill ${cabTone}`}>{statusLabel[change.status] || change.status}</span>
              </div>

              <div className="grid">
                <div><span>Sistema</span><b>{change.system || 'Sin sistema'}</b></div>
                <div><span>Célula</span><b>{change.cell || 'Sin célula'}</b></div>
                <div><span>Categoría</span><b>{change.category || 'Sin categoría'}</b></div>
                <div><span>Fecha deploy</span><b>{formatDate(change.proposed_deploy_date)}</b></div>
                <div><span>Jira origen</span><b>{change.jira_origin || 'No informado'}</b></div>
                <div><span>RFC</span><b>{change.rfc || 'No aplica'}</b></div>
                <div><span>PAP Jira</span><b>{change.jira_key || 'Pendiente'}</b></div>
                <div><span>Resultado deploy</span><b>{change.deployment_result || 'Pendiente'}</b></div>
              </div>
            </section>

            <section className="block">
              <h2>Contexto del cambio</h2>
              <p>{change.description || 'No se registró descripción del cambio.'}</p>
            </section>

            <section className="block">
              <h2>Responsables</h2>
              <div className="grid">
                <div><span>Presentador</span><b>{change.presenter || change.created_by || 'No informado'}</b></div>
                <div><span>Líder técnico</span><b>{change.technical_lead || 'No informado'}</b></div>
                <div><span>Analista QA</span><b>{change.qa_analyst || 'No informado'}</b></div>
                <div><span>Validador negocio</span><b>{change.business_validator || 'No informado'}</b></div>
              </div>
            </section>

            <section className="block">
              <div className="sectionHead">
                <div>
                  <h2>Aprobaciones CAB</h2>
                  <p className="muted">{progress.approved} de {progress.total} aprobaciones completadas.</p>
                </div>
                <strong className="bigPercent">{progress.percent}%</strong>
              </div>
              <div className="progressBar"><i style={{ width: `${progress.percent}%` }} /></div>

              <div className="approvalTable">
                {(change.approval_requests || []).map((approval) => (
                  <div className="approvalRow" key={approval.id}>
                    <div>
                      <b>{approval.approver_role}</b>
                      <span>{approval.approver_name}</span>
                    </div>
                    <div>
                      <em className={tone[approval.status] || 'pending'}>{approval.status}</em>
                    </div>
                    <div className="evidence">
                      {approval.approved_at ? <span>{formatDate(approval.approved_at)}</span> : <span>Pendiente</span>}
                      {approval.approved_by_email ? <small>{approval.approved_by_email}</small> : null}
                    </div>
                    <a href={`/approve/${approval.approval_token || approval.id}`} target="_blank" rel="noreferrer">Abrir</a>
                  </div>
                ))}
              </div>
            </section>
          </article>

          <aside className="sideCard">
            <section>
              <p className="sectionLabel">Avance del cambio</p>
              <strong className="sidePercent">{progress.percent}%</strong>
              <div className="progressBar"><i style={{ width: `${progress.percent}%` }} /></div>
            </section>

            <section className="miniStats">
              <div><b>{progress.approved}</b><span>Aprobados</span></div>
              <div><b>{progress.pending}</b><span>Pendientes</span></div>
              <div><b>{progress.observed}</b><span>Observados</span></div>
              <div><b>{progress.rejected}</b><span>Rechazados</span></div>
            </section>

            <section className="timeline">
              <h2>Timeline</h2>
              <div className="step done"><i /> <span>RDC creado</span></div>
              <div className="step done"><i /> <span>CAB Digital</span></div>
              <div className={change.status === 'APROBADO_PARA_EJECUCION' ? 'step done' : 'step'}><i /> <span>PAP Jira</span></div>
              <div className="step"><i /> <span>Implementación</span></div>
              <div className="step"><i /> <span>Cierre</span></div>
            </section>

            <section className="audit">
              <h2>Evidencia digital</h2>
              {(change.approval_requests || [])
                .filter((approval) => approval.status !== 'PENDIENTE')
                .map((approval) => (
                  <div className="auditItem" key={approval.id}>
                    <b>{approval.approver_role}</b>
                    <span>{approval.approver_name}</span>
                    {approval.approved_at ? <small>{formatDate(approval.approved_at)}</small> : null}
                    {approval.approved_by_email ? <small>{approval.approved_by_email}</small> : null}
                  </div>
                ))}
              {(change.approval_requests || []).every((approval) => approval.status === 'PENDIENTE') ? (
                <p className="muted">Aún no hay evidencias registradas.</p>
              ) : null}
            </section>
          </aside>
        </section>
      ) : null}

      <style jsx global>{`
        *{box-sizing:border-box}html,body{margin:0}body{background:#edf5f9}
        a{color:inherit;text-decoration:none}
        .page{min-height:100vh;padding:26px 6vw 60px;border-top:6px solid #00c16e;color:#073b5d;background:radial-gradient(circle at top right,rgba(0,193,110,.10),transparent 32%),#edf5f9;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        .header,.layout,.empty,.error{max-width:1280px;margin:0 auto}
        .header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:24px}
        .kicker,.sectionLabel{margin:0 0 10px;color:#00a967;font-size:13px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}
        h1{font-size:52px;line-height:.95;letter-spacing:-.06em;margin:0 0 12px}
        h2{margin:0 0 12px;font-size:24px;letter-spacing:-.04em}
        .header p,.muted{color:#5d7890;line-height:1.45;margin:0}
        .headerActions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
        .back,.cabState,.statePill{background:white;border:1px solid #dfeaf0;border-radius:999px;padding:11px 16px;font-weight:950}
        .ok{background:#e8fff3!important;color:#008f57!important}.pending{background:#ecf7ff!important;color:#02568c!important}.watch{background:#fff7e6!important;color:#9a6700!important}.bad{background:#fff1f0!important;color:#b42318!important}
        .layout{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(330px,.8fr);gap:20px}
        .mainCard,.sideCard,.empty,.error{background:white;border:1px solid #dfeaf0;border-radius:24px;box-shadow:0 18px 45px rgba(7,59,93,.07)}
        .mainCard,.sideCard{padding:22px}
        .executive,.block{background:#f8fbfd;border:1px solid #e5eef3;border-radius:18px;padding:18px;margin-bottom:16px}
        .sectionHead{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}
        .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
        .grid div{background:white;border:1px solid #e5eef3;border-radius:16px;padding:13px}
        .grid span{display:block;color:#5d7890;font-size:12px;font-weight:900;margin-bottom:6px}
        .grid b{display:block;font-size:15px}
        .block p{color:#315873;line-height:1.55;margin:0}
        .bigPercent,.sidePercent{font-size:40px;color:#00a967;letter-spacing:-.05em}
        .progressBar{height:13px;background:#e9f2f7;border-radius:999px;overflow:hidden;margin:12px 0}
        .progressBar i{display:block;height:100%;background:#00c16e;border-radius:inherit}
        .approvalTable{display:grid;gap:10px;margin-top:14px}
        .approvalRow{display:grid;grid-template-columns:1.1fr auto 1fr auto;gap:14px;align-items:center;background:white;border:1px solid #e5eef3;border-radius:16px;padding:12px}
        .approvalRow b,.auditItem b{display:block}
        .approvalRow span,.approvalRow small,.auditItem span,.auditItem small{display:block;color:#5d7890;font-size:12px}
        em{font-style:normal;border-radius:999px;padding:7px 10px;font-weight:950;font-size:11px;white-space:nowrap}
        .approvalRow a{background:#ecf7ff;color:#02568c;border-radius:999px;padding:8px 11px;font-weight:950;font-size:12px}
        .miniStats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:18px 0}
        .miniStats div{background:#f8fbfd;border:1px solid #e5eef3;border-radius:16px;padding:12px}
        .miniStats b{display:block;font-size:24px}
        .miniStats span{color:#5d7890;font-size:12px;font-weight:900}
        .timeline,.audit{display:grid;gap:12px;margin-top:18px}
        .step{display:flex;gap:10px;align-items:center;color:#8aa0b2;font-weight:900}
        .step i{width:14px;height:14px;border-radius:50%;border:3px solid #c9d9e3;background:white}
        .step.done{color:#073b5d}.step.done i{border-color:#00c16e;background:#00c16e}
        .auditItem{background:#f8fbfd;border:1px solid #e5eef3;border-radius:16px;padding:12px}
        .empty,.error{padding:24px;margin-bottom:18px;color:#5d7890}.error{color:#b42318;background:#fff1f0;border-color:#ffd6d2}
        @media(max-width:1000px){.layout{grid-template-columns:1fr}.grid{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:700px){.page{padding:20px 18px 44px}.header,.sectionHead{flex-direction:column}.grid,.approvalRow{grid-template-columns:1fr}h1{font-size:38px}}
      `}</style>
    </main>
  );
}

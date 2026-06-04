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

type RdcDetails = {
  id?: string;
  requirement_description?: string | null;
  implemented_solution?: string | null;
  affected_services?: string | null;
  affected_users?: string | null;
  consequence_not_implementing?: string | null;
  validation_plan?: string | null;
  deployment_plan?: string | null;
  rollback_plan?: string | null;
  impact?: string | null;
  priority?: string | null;
  requires_dba?: boolean | null;
  requires_networks?: boolean | null;
  requires_infra?: boolean | null;
  requires_monitoring?: boolean | null;
  dependent_rdc?: string | null;
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
  rdc_details?: RdcDetails[] | RdcDetails | null;
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

function firstDetail(change: Change): RdcDetails {
  const details = change.rdc_details;
  if (Array.isArray(details)) return details[0] || {};
  return details || {};
}

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  try {
    return new Date(value).toLocaleString('es-CL');
  } catch {
    return value;
  }
}

function shortDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  try {
    return new Date(value).toLocaleDateString('es-CL');
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

function valueOrEmpty(value?: string | null, fallback = 'No informado') {
  const text = String(value || '').trim();
  return text || fallback;
}

function yesNo(value?: boolean | null) {
  return value ? 'Aplica' : 'No aplica';
}

function getCabReadiness(change: Change, details: RdcDetails, progress: ReturnType<typeof getProgress>) {
  const missing: string[] = [];

  if (!valueOrEmpty(change.description, '').trim() && !valueOrEmpty(details.requirement_description, '').trim()) missing.push('Descripción');
  if (!valueOrEmpty(details.rollback_plan, '').trim()) missing.push('Rollback');
  if (!valueOrEmpty(details.deployment_plan, '').trim()) missing.push('Plan producción');
  if (!valueOrEmpty(details.impact, '').trim()) missing.push('Impacto');
  if (!valueOrEmpty(details.priority, '').trim()) missing.push('Prioridad');
  if (progress.pending > 0) missing.push('Aprobaciones');

  return {
    ready: missing.length === 0,
    missing,
  };
}

function getRiskTone(impact?: string | null, priority?: string | null) {
  const text = `${impact || ''} ${priority || ''}`.toLowerCase();
  if (text.includes('crítico') || text.includes('critico') || text.includes('urgente') || text.includes('alto')) return 'bad';
  if (text.includes('medio') || text.includes('media') || text.includes('alta')) return 'watch';
  return 'ok';
}

function splitLines(value?: string | null) {
  const text = String(value || '').trim();
  if (!text) return [];
  return text
    .split(/\n|\r|•|\d+\./)
    .map((item) => item.trim())
    .filter(Boolean);
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

  const details = change ? firstDetail(change) : {};
  const progress = change ? getProgress(change) : null;
  const readiness = change && progress ? getCabReadiness(change, details, progress) : { ready: false, missing: [] };
  const riskTone = getRiskTone(details.impact, details.priority);

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

  const systems = [
    change?.system,
    change?.cell,
    details.affected_services,
  ].filter(Boolean).join(',').split(',').map((item) => item.trim()).filter(Boolean);

  const deploymentSteps = splitLines(details.deployment_plan);
  const rollbackSteps = splitLines(details.rollback_plan);

  return (
    <main className="page">
      <header className="header">
        <div>
          <p className="kicker">RDC · Ficha maestra del cambio</p>
          <h1>{change?.title || 'Detalle RDC'}</h1>
          <p>Vista ordenada del RDC Confluence en el sistema RM: contexto, impacto, riesgo, despliegue, rollback, evidencias y aprobaciones CAB.</p>
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
            <section className="section executive">
              <div className="sectionHead">
                <div>
                  <p className="sectionLabel">1. Resumen ejecutivo</p>
                  <h2>{change.title}</h2>
                  <p className="muted">{statusLabel[change.status] || change.status}</p>
                </div>
                <span className={`statePill ${readiness.ready ? 'ok' : 'watch'}`}>
                  {readiness.ready ? 'CAB Ready' : 'Faltan datos CAB'}
                </span>
              </div>

              <div className="grid">
                <div><span>Sistema</span><b>{valueOrEmpty(change.system, 'Sin sistema')}</b></div>
                <div><span>Célula / Área</span><b>{valueOrEmpty(change.cell, 'Sin célula')}</b></div>
                <div><span>Categoría</span><b>{valueOrEmpty(change.category, 'Sin categoría')}</b></div>
                <div><span>Fecha deploy</span><b>{shortDate(change.proposed_deploy_date)}</b></div>
                <div><span>Jira origen</span><b>{valueOrEmpty(change.jira_origin, 'No informado')}</b></div>
                <div><span>RFC</span><b>{valueOrEmpty(change.rfc, 'No aplica')}</b></div>
                <div><span>PAP Jira</span><b>{valueOrEmpty(change.jira_key, 'Pendiente')}</b></div>
                <div><span>Resultado deploy</span><b>{valueOrEmpty(change.deployment_result, 'PENDIENTE')}</b></div>
              </div>
            </section>

            <section className="section">
              <p className="sectionLabel">2. Descripción del cambio</p>
              <div className="twoCols">
                <div className="textBox">
                  <h3>Descripción del requerimiento</h3>
                  <p>{valueOrEmpty(details.requirement_description || change.description, 'No se registró descripción del requerimiento.')}</p>
                </div>
                <div className="textBox">
                  <h3>Solución implementada</h3>
                  <p>{valueOrEmpty(details.implemented_solution, 'No se registró solución implementada.')}</p>
                </div>
                <div className="textBox">
                  <h3>Servicios afectados</h3>
                  <p>{valueOrEmpty(details.affected_services, 'No se registraron servicios afectados.')}</p>
                </div>
                <div className="textBox">
                  <h3>Usuarios afectados</h3>
                  <p>{valueOrEmpty(details.affected_users, 'No se registraron usuarios afectados.')}</p>
                </div>
                <div className="textBox full">
                  <h3>Consecuencia si no se aprueba o se pospone</h3>
                  <p>{valueOrEmpty(details.consequence_not_implementing, 'No se registró consecuencia.')}</p>
                </div>
              </div>
            </section>

            <section className="section riskSection">
              <div className="sectionHead">
                <div>
                  <p className="sectionLabel">3. Impacto y riesgo CAB</p>
                  <h2>Evaluación para decisión CAB</h2>
                </div>
                <span className={`riskBadge ${riskTone}`}>Riesgo {valueOrEmpty(details.impact, 'Controlado')}</span>
              </div>

              <div className="riskGrid">
                <div><span>Impacto</span><b>{valueOrEmpty(details.impact, 'No informado')}</b></div>
                <div><span>Prioridad</span><b>{valueOrEmpty(details.priority, 'No informado')}</b></div>
                <div><span>Requiere DBA</span><b>{yesNo(details.requires_dba)}</b></div>
                <div><span>Requiere redes</span><b>{yesNo(details.requires_networks)}</b></div>
                <div><span>Requiere infraestructura</span><b>{yesNo(details.requires_infra)}</b></div>
                <div><span>Requiere monitoreo</span><b>{yesNo(details.requires_monitoring)}</b></div>
              </div>

              <div className="systems">
                <h3>Sistemas / servicios afectados</h3>
                <div className="chips">
                  {systems.length ? systems.map((item, index) => <span key={`${item}-${index}`}>{item}</span>) : <span>No informado</span>}
                </div>
              </div>
            </section>

            <section className="section">
              <p className="sectionLabel">4. Responsables</p>
              <div className="grid">
                <div><span>Presentador</span><b>{valueOrEmpty(change.presenter || change.created_by, 'No informado')}</b></div>
                <div><span>Líder técnico</span><b>{valueOrEmpty(change.technical_lead, 'No informado')}</b></div>
                <div><span>Analista QA</span><b>{valueOrEmpty(change.qa_analyst, 'No informado')}</b></div>
                <div><span>Validador negocio</span><b>{valueOrEmpty(change.business_validator, 'No informado')}</b></div>
              </div>
            </section>

            <section className="section">
              <p className="sectionLabel">5. Plan QA y validación</p>
              <div className="twoCols">
                <div className="textBox">
                  <h3>Plan de validación</h3>
                  <p>{valueOrEmpty(details.validation_plan, 'No se registró plan de validación.')}</p>
                </div>
                <div className="textBox">
                  <h3>Dependencia con otro RDC</h3>
                  <p>{valueOrEmpty(details.dependent_rdc, 'No aplica')}</p>
                </div>
              </div>
            </section>

            <section className="section deploySection">
              <p className="sectionLabel">6. Plan de despliegue producción</p>
              <div className="planBox">
                {deploymentSteps.length ? (
                  <ol>
                    {deploymentSteps.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}
                  </ol>
                ) : (
                  <p>{valueOrEmpty(details.deployment_plan, 'No se registró plan de despliegue producción.')}</p>
                )}
              </div>
            </section>

            <section className="section rollbackSection">
              <p className="sectionLabel">7. Rollback / plan de mitigación</p>
              <div className="rollbackBox">
                <h2>Plan de vuelta atrás</h2>
                {rollbackSteps.length ? (
                  <ol>
                    {rollbackSteps.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}
                  </ol>
                ) : (
                  <p>{valueOrEmpty(details.rollback_plan, 'No se registró rollback. Completar antes de CAB.')}</p>
                )}
              </div>
            </section>

            <section className="section">
              <div className="sectionHead">
                <div>
                  <p className="sectionLabel">8. Aprobaciones CAB</p>
                  <h2>{progress.approved} de {progress.total} aprobaciones completadas</h2>
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
                    <em className={tone[approval.status] || 'pending'}>{approval.status}</em>
                    <div className="evidence">
                      {approval.approved_at ? <span>{formatDate(approval.approved_at)}</span> : <span>Pendiente</span>}
                      {approval.approved_by_email ? <small>{approval.approved_by_email}</small> : null}
                      {approval.comment ? <small>Obs: {approval.comment}</small> : null}
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

            <section className="checklist">
              <h2>Checklist CAB</h2>
              <div className={valueOrEmpty(details.requirement_description || change.description, '').trim() ? 'check ok' : 'check'}><i /> Descripción</div>
              <div className={valueOrEmpty(details.impact, '').trim() ? 'check ok' : 'check'}><i /> Impacto</div>
              <div className={systems.length ? 'check ok' : 'check'}><i /> Sistemas afectados</div>
              <div className={valueOrEmpty(details.validation_plan, '').trim() ? 'check ok' : 'check'}><i /> Plan QA</div>
              <div className={valueOrEmpty(details.deployment_plan, '').trim() ? 'check ok' : 'check'}><i /> Plan producción</div>
              <div className={valueOrEmpty(details.rollback_plan, '').trim() ? 'check ok' : 'check'}><i /> Rollback</div>
              <div className={progress.pending === 0 ? 'check ok' : 'check'}><i /> Aprobaciones</div>
            </section>

            {readiness.missing.length ? (
              <section className="missingBox">
                <h2>Faltante para CAB Ready</h2>
                {readiness.missing.map((item) => <span key={item}>{item}</span>)}
              </section>
            ) : null}

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
        .header,.layout,.empty,.error{max-width:1320px;margin:0 auto}
        .header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin-bottom:24px}
        .kicker,.sectionLabel{margin:0 0 10px;color:#00a967;font-size:13px;font-weight:950;letter-spacing:.16em;text-transform:uppercase}
        h1{font-size:52px;line-height:.95;letter-spacing:-.06em;margin:0 0 12px}
        h2{margin:0 0 12px;font-size:24px;letter-spacing:-.04em}
        h3{margin:0 0 8px;font-size:16px}
        .header p,.muted{color:#5d7890;line-height:1.45;margin:0}
        .headerActions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
        .back,.cabState,.statePill,.riskBadge{background:white;border:1px solid #dfeaf0;border-radius:999px;padding:11px 16px;font-weight:950}
        .ok{background:#e8fff3!important;color:#008f57!important}.pending{background:#ecf7ff!important;color:#02568c!important}.watch{background:#fff7e6!important;color:#9a6700!important}.bad{background:#fff1f0!important;color:#b42318!important}
        .layout{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(340px,.8fr);gap:20px}
        .mainCard,.sideCard,.empty,.error{background:white;border:1px solid #dfeaf0;border-radius:24px;box-shadow:0 18px 45px rgba(7,59,93,.07)}
        .mainCard,.sideCard{padding:22px}
        .section{background:#f8fbfd;border:1px solid #e5eef3;border-radius:18px;padding:18px;margin-bottom:16px}
        .sectionHead{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}
        .grid,.riskGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
        .grid div,.riskGrid div,.textBox{background:white;border:1px solid #e5eef3;border-radius:16px;padding:13px}
        .grid span,.riskGrid span{display:block;color:#5d7890;font-size:12px;font-weight:900;margin-bottom:6px}
        .grid b,.riskGrid b{display:block;font-size:15px}
        .twoCols{display:grid;grid-template-columns:1fr 1fr;gap:12px}.full{grid-column:1/-1}
        .textBox p,.planBox p,.rollbackBox p{color:#315873;line-height:1.55;margin:0;white-space:pre-wrap}
        .riskSection{background:#fffdf5;border-color:#f2e2bb}.riskBadge{font-size:13px}
        .systems{margin-top:14px}.chips{display:flex;gap:8px;flex-wrap:wrap}.chips span{background:#ecf7ff;color:#02568c;border-radius:999px;padding:8px 12px;font-weight:950;font-size:12px}
        .planBox,.rollbackBox{background:white;border:1px solid #e5eef3;border-radius:16px;padding:16px}.planBox ol,.rollbackBox ol{margin:0;padding-left:20px;color:#315873;line-height:1.6}.rollbackSection{background:#fff7e6;border-color:#f2d28b}.rollbackBox{border-color:#f2d28b}
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
        .miniStats b{display:block;font-size:24px}.miniStats span{color:#5d7890;font-size:12px;font-weight:900}
        .checklist,.timeline,.audit,.missingBox{display:grid;gap:12px;margin-top:18px}
        .check{display:flex;gap:10px;align-items:center;color:#8aa0b2;font-weight:900}
        .check i,.step i{width:14px;height:14px;border-radius:50%;border:3px solid #c9d9e3;background:white}
        .check.ok{color:#073b5d}.check.ok i,.step.done i{border-color:#00c16e;background:#00c16e}
        .missingBox{background:#fff7e6;border:1px solid #f2d28b;border-radius:16px;padding:14px}.missingBox span{background:white;border-radius:999px;padding:8px 12px;font-weight:950;color:#9a6700;display:inline-flex;width:max-content}
        .step{display:flex;gap:10px;align-items:center;color:#8aa0b2;font-weight:900}.step.done{color:#073b5d}
        .auditItem{background:#f8fbfd;border:1px solid #e5eef3;border-radius:16px;padding:12px}
        .empty,.error{padding:24px;margin-bottom:18px;color:#5d7890}.error{color:#b42318;background:#fff1f0;border-color:#ffd6d2}
        @media(max-width:1100px){.layout{grid-template-columns:1fr}.grid,.riskGrid{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:760px){.page{padding:20px 18px 44px}.header,.sectionHead{flex-direction:column}.grid,.riskGrid,.twoCols,.approvalRow{grid-template-columns:1fr}h1{font-size:38px}.full{grid-column:auto}}
      `}</style>
    </main>
  );
}

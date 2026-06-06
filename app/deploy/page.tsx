'use client';

import { useEffect, useMemo, useState } from 'react';

type DeploymentRun = {
  id: string;
  provider: string;
  job_name: string;
  build_number?: string | null;
  build_url?: string | null;
  queue_url?: string | null;
  environment?: string | null;
  version?: string | null;
  branch_or_tag?: string | null;
  status: string;
  result?: string | null;
  triggered_by?: string | null;
  triggered_at?: string | null;
  finished_at?: string | null;
};

type Change = {
  id: string;
  title: string;
  system?: string | null;
  cell?: string | null;
  category?: string | null;
  status: string;
  jira_key?: string | null;
  jira_origin?: string | null;
  proposed_deploy_date?: string | null;
  approval_requests?: any[];
  pap_steps?: any[];
  deployment_runs?: DeploymentRun[];
};

type JenkinsJob = {
  name: string;
  url?: string;
  color?: string;
};

const DEFAULT_JOB = 'deploy-ticketing-efe-prod';

const STATUS_LABEL: Record<string, string> = {
  QUEUED: 'En cola',
  RUNNING: 'En ejecución',
  SUCCESS: 'Exitoso',
  FAILURE: 'Fallido',
  ABORTED: 'Abortado',
  FAILED_TO_TRIGGER: 'Error al iniciar',
};

const RDC_STATUS_LABEL: Record<string, string> = {
  APROBADO_PARA_EJECUCION: 'Aprobado para ejecución',
  PAP_CREADO: 'Plan PAP creado',
  EN_IMPLEMENTACION: 'En implementación',
  IMPLEMENTADO_EXITOSO: 'Implementado exitoso',
};

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  try {
    return new Date(value).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return value;
  }
}

function humanRdcStatus(status?: string) {
  if (!status) return 'Sin estado';
  return RDC_STATUS_LABEL[status] || status.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function approvedCount(change?: Change | null) {
  const approvals = change?.approval_requests || [];
  return approvals.filter((a) => a.status === 'APROBADO').length;
}

function totalApprovals(change?: Change | null) {
  return change?.approval_requests?.length || 0;
}

function isPapStepReady(status?: string) {
  return status === 'Validado' || status === 'Completado' || status === 'No aplica';
}

function completedPap(change?: Change | null) {
  const steps = change?.pap_steps || [];
  return steps.filter((s) => isPapStepReady(s.status)).length;
}

function lastRun(change?: Change | null) {
  const runs = [...(change?.deployment_runs || [])];
  return runs.sort((a, b) => new Date(b.triggered_at || 0).getTime() - new Date(a.triggered_at || 0).getTime())[0];
}

function isRdcApproved(change?: Change | null) {
  if (!change) return false;
  const total = totalApprovals(change);
  return total > 0 && approvedCount(change) === total;
}

function isPapReady(change?: Change | null) {
  if (!change) return false;
  const steps = change.pap_steps || [];
  if (steps.length === 0) return false;
  return steps.every((step) => isPapStepReady(step.status));
}

function jobColorLabel(color?: string) {
  if (!color) return 'Sin estado';
  if (color.includes('blue')) return 'OK';
  if (color.includes('red')) return 'Fallando';
  if (color.includes('yellow')) return 'Inestable';
  if (color.includes('notbuilt')) return 'Sin build';
  return color;
}

export default function DeployCenterPage() {
  const [changes, setChanges] = useState<Change[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [jobs, setJobs] = useState<JenkinsJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsWarning, setJobsWarning] = useState('');
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [jobName, setJobName] = useState(DEFAULT_JOB);
  const [version, setVersion] = useState('');
  const [branchOrTag, setBranchOrTag] = useState('');
  const [environment, setEnvironment] = useState('Producción');

  const selected = useMemo(() => changes.find((c) => c.id === selectedId) || null, [changes, selectedId]);
  const selectedLastRun = lastRun(selected);

  const cabReady = isRdcApproved(selected);
  const papReady = isPapReady(selected);
  const roleReady = true;
  const jobReady = Boolean(jobName.trim());
  const rdcExecutable = Boolean(selected && ['APROBADO_PARA_EJECUCION', 'PAP_CREADO', 'EN_IMPLEMENTACION'].includes(selected.status));

  const canExecute = Boolean(cabReady && papReady && roleReady && jobReady && rdcExecutable);
  const papSteps = selected?.pap_steps || [];
  const papPercent = papSteps.length ? Math.round((completedPap(selected) / papSteps.length) * 100) : 0;

  async function load() {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/deploy/list', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'No se pudo cargar Deploy Center');

      const list: Change[] = data.changes || [];
      setChanges(list);

      if (list.length && !selectedId) {
        const first = list[0];
        setSelectedId(first.id);
        setVersion(first.jira_key || first.jira_origin || '');
        setBranchOrTag(first.jira_key ? `release/${first.jira_key}` : '');
      }
    } catch (err: any) {
      setError(err?.message || 'Error cargando Deploy Center');
    } finally {
      setLoading(false);
    }
  }

  async function loadJobs() {
    try {
      setJobsLoading(true);
      setJobsWarning('');
      const response = await fetch('/api/deploy/jobs', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'No se pudo cargar jobs Jenkins');
      const list = data.jobs || [];
      setJobs(list);
      if (data.warning) setJobsWarning(data.warning);
      if (list.length && !jobName) setJobName(list[0].name);
    } catch (err: any) {
      setJobsWarning(err?.message || 'No se pudo consultar Jenkins. Puedes escribir el job manualmente.');
    } finally {
      setJobsLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadJobs();
  }, []);

  function selectChange(id: string) {
    const change = changes.find((c) => c.id === id);
    setSelectedId(id);
    setMessage('');
    setError('');
    if (change) {
      setVersion(change.jira_key || change.jira_origin || '');
      setBranchOrTag(change.jira_key ? `release/${change.jira_key}` : '');
    }
  }

  function executionBlockReason() {
    if (!rdcExecutable) return 'El cambio aún no está en estado ejecutable.';
    if (!cabReady) return 'Faltan aprobaciones CAB para ejecutar.';
    if (!papReady) return 'Antes de ejecutar Jenkins, completa y valida las actividades del paso a producción.';
    if (!jobReady) return 'Selecciona o escribe un Job Jenkins.';
    return '';
  }

  async function triggerPipeline() {
    if (!selected) return;

    const blockedReason = executionBlockReason();
    if (blockedReason) {
      setError(blockedReason);
      return;
    }

    const executionContext =
      environment === 'Producción'
        ? 'Vas a ejecutar un pipeline productivo.'
        : `Vas a ejecutar un pipeline en ambiente ${environment}.`;

    const confirmed = window.confirm(
      `Confirmación de ejecución Jenkins\n\n${executionContext}\n\nRDC: ${selected.title}\nJob: ${jobName}\nAmbiente: ${environment}\n\nEsta acción quedará registrada como evidencia técnica del cambio.\n\n¿Deseas continuar?`,
    );

    if (!confirmed) return;

    try {
      setTriggering(true);
      setMessage('');
      setError('');

      const response = await fetch('/api/deploy/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rdcId: selected.id, jobName, version, branchOrTag, environment }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'No se pudo ejecutar pipeline');

      setMessage(data.jenkins?.mode === 'mock'
        ? 'Ejecución simulada registrada. Configura Jenkins para ejecución real.'
        : 'Pipeline enviado a Jenkins correctamente.'
      );

      await load();
    } catch (err: any) {
      setError(err?.message || 'Error ejecutando pipeline');
    } finally {
      setTriggering(false);
    }
  }

  return (
    <main className="deploy">
      <header className="head">
        <div>
          <p className="kicker">RELEASE EXECUTION</p>
          <h1>Deploy Center</h1>
          <p className="sub">
            Ejecuta y monitorea pipelines Jenkins asociados a cambios aprobados, con controles claros antes de producción.
          </p>
        </div>
        <div className="headActions">
          <button className="ghostBtn" type="button" onClick={loadJobs}>Actualizar Jobs</button>
          <button className="ghostBtn" type="button" onClick={load}>Actualizar</button>
        </div>
      </header>

      {loading ? <div className="state">Cargando cambios listos para ejecución…</div> : null}
      {error ? <div className="state error">{error}</div> : null}

      {!loading && !error ? (
        <section className="layout">
          <aside className="queue">
            <div className="queueHead">
              <h2>Listos para ejecución</h2>
              <span>{changes.length}</span>
            </div>

            {changes.length === 0 ? (
              <p className="empty">No hay cambios aprobados para ejecución.</p>
            ) : (
              <div className="queueList">
                {changes.map((change) => {
                  const run = lastRun(change);
                  return (
                    <button
                      type="button"
                      key={change.id}
                      className={change.id === selectedId ? 'queueItem active' : 'queueItem'}
                      onClick={() => selectChange(change.id)}
                    >
                      <strong>{change.title}</strong>
                      <small>{change.system || 'Sin sistema'} · {change.cell || 'Sin célula'}</small>
                      <em>{run ? `Última ejecución: ${STATUS_LABEL[run.status] || run.status}` : 'Sin ejecución Jenkins'}</em>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="content">
            {selected ? (
              <>
                <div className="heroCard">
                  <div>
                    <p className="kicker">Cambio seleccionado</p>
                    <h2>{selected.title}</h2>
                    <p>{selected.system || 'Sin sistema'} · {selected.cell || 'Sin célula'} · {selected.category || 'Sin categoría'}</p>
                  </div>

                  <div className="heroActions">
                    <span className={canExecute ? 'readyBadge' : 'blockedBadge'}>{canExecute ? 'Listo para Deploy' : !papReady ? 'Pendiente Plan PAP' : 'No ejecutable todavía'}</span>
                    <a href={`/pap?rdcId=${selected.id}`}>{papReady ? 'Editar Plan PAP →' : 'Ir a Plan PAP →'}</a>
                  </div>
                </div>

                <div className="summaryGrid">
                  <div><span>Aprobaciones CAB</span><b>{approvedCount(selected)}/{totalApprovals(selected)}</b></div>
                  <div><span>Plan PAP</span><b>{papPercent}%</b></div>
                  <div><span>Estado RDC</span><b>{humanRdcStatus(selected.status)}</b></div>
                  <div><span>Última ejecución</span><b>{selectedLastRun ? (STATUS_LABEL[selectedLastRun.status] || selectedLastRun.status) : 'Sin ejecución Jenkins'}</b></div>
                </div>

                <section className="conditionsCard">
                  <div className="conditionsHead">
                    <div>
                      <p className="kicker">Control previo</p>
                      <h3>Condiciones para ejecutar</h3>
                    </div>
                    <span className={canExecute ? 'okPill' : 'warnPill'}>{canExecute ? 'Todo listo' : 'Revisión requerida'}</span>
                  </div>

                  <div className="conditions">
                    <Condition ok={cabReady} title={`CAB aprobado ${approvedCount(selected)}/${totalApprovals(selected)}`} help="Todas las áreas aprobadoras deben estar en APROBADO." />
                    <Condition ok={papReady} title={papReady ? 'Plan PAP completo' : 'Plan PAP pendiente'} help={papReady ? 'Todas las actividades PAP están validadas y listas para ejecución.' : 'Valida la planificación del paso a producción antes de ejecutar Jenkins.'} />
                    <Condition ok={roleReady} title="Rol Release Manager" help="Solo RM puede ejecutar pipelines desde el portal." />
                    <Condition ok={jobReady} title="Job Jenkins configurado" help={jobReady ? jobName : 'Selecciona o escribe un job.'} />
                  </div>

                  {!canExecute ? (
                    <div className="blockReasonBox">
                      <div className="blockReasonText">
                        <b>{!papReady ? 'Plan PAP requerido para ejecución' : 'Ejecución bloqueada'}</b>
                        <span>{!papReady ? 'Antes de ejecutar Jenkins, completa y valida las actividades del paso a producción.' : executionBlockReason()}</span>
                      </div>
                      {!papReady ? <a href={`/pap?rdcId=${selected.id}`}>Ir a Plan PAP →</a> : null}
                    </div>
                  ) : null}
                </section>

                <section className="pipelineCard">
                  <div className="pipelineHead">
                    <div>
                      <p className="kicker">Jenkins Pipeline</p>
                      <h3>Ejecutar despliegue</h3>
                      <p>La ejecución queda asociada al RDC, usuario ejecutor, parámetros y resultado.</p>
                    </div>
                    <div className="stageFlow">
                      <span className={cabReady ? 'done' : ''}>CAB</span>
                      <i />
                      <span className={papReady ? 'done' : ''}>PAP</span>
                      <i />
                      <span className={selectedLastRun ? 'done' : ''}>Jenkins</span>
                      <i />
                      <span>Cierre</span>
                    </div>
                  </div>

                  {jobsWarning ? <div className="jobsWarning">{jobsWarning}</div> : null}

                  <div className="deployForm">
                    <label>
                      Job Jenkins
                      <select value={jobName} onChange={(e) => setJobName(e.target.value)} disabled={jobsLoading && jobs.length === 0}>
                        <option value="">{jobsLoading ? 'Cargando jobs…' : 'Selecciona job Jenkins'}</option>
                        {jobs.map((job) => (
                          <option key={job.name} value={job.name}>
                            {job.name} {job.color ? `· ${jobColorLabel(job.color)}` : ''}
                          </option>
                        ))}
                        {!jobs.some((job) => job.name === jobName) && jobName ? <option value={jobName}>{jobName}</option> : null}
                      </select>
                    </label>
                    <label>
                      Ambiente
                      <select value={environment} onChange={(e) => setEnvironment(e.target.value)}>
                        <option>Producción</option>
                        <option>QA</option>
                        <option>Staging</option>
                      </select>
                    </label>
                    <label>
                      Versión
                      <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v1.0.0 / PAP-123" />
                    </label>
                    <label>
                      Rama / Tag
                      <input value={branchOrTag} onChange={(e) => setBranchOrTag(e.target.value)} placeholder="release/v1.0.0" />
                    </label>
                  </div>

                  <label className="manualJob">
                    Job manual, si no aparece en el listado
                    <input value={jobName} onChange={(e) => setJobName(e.target.value)} placeholder="Nombre exacto del job Jenkins" />
                  </label>

                  <button className="primary" type="button" disabled={!canExecute || triggering} onClick={triggerPipeline}>
                    {triggering ? 'Enviando a Jenkins…' : canExecute ? 'Ejecutar Pipeline Jenkins' : 'Valida condiciones antes de ejecutar'}
                  </button>

                  <p className="helper">Solo disponible para cambios aprobados por CAB, con Plan PAP validado y rol Release Manager.</p>
                </section>

                <section className="runs">
                  <div className="runsHead">
                    <h3>Historial de ejecución</h3>
                    <span>{selected.deployment_runs?.length || 0} registros</span>
                  </div>

                  {(!selected.deployment_runs || selected.deployment_runs.length === 0) ? (
                    <p className="empty">Aún no hay ejecuciones para este cambio.</p>
                  ) : (
                    <div className="runList">
                      {[...(selected.deployment_runs || [])]
                        .sort((a, b) => new Date(b.triggered_at || 0).getTime() - new Date(a.triggered_at || 0).getTime())
                        .map((run) => (
                          <article className="run" key={run.id}>
                            <div>
                              <b>{run.job_name}</b>
                              <small>{formatDate(run.triggered_at)} · {run.triggered_by || 'No informado'}</small>
                            </div>
                            <span className={`runStatus ${run.result === 'FAILURE' || run.status === 'FAILED_TO_TRIGGER' ? 'bad' : run.status === 'SUCCESS' || run.result === 'SUCCESS' ? 'ok' : 'pending'}`}>
                              {STATUS_LABEL[run.status] || run.status}
                            </span>
                            {run.build_url ? <a href={run.build_url} target="_blank" rel="noreferrer">Ver Jenkins ↗</a> : run.queue_url ? <a href={run.queue_url} target="_blank" rel="noreferrer">Ver cola ↗</a> : null}
                          </article>
                        ))}
                    </div>
                  )}
                </section>

                {message ? <div className="msg">{message}</div> : null}
              </>
            ) : (
              <div className="state">Selecciona un cambio para ver su ejecución.</div>
            )}
          </section>
        </section>
      ) : null}

      <style jsx>{`
        .deploy { max-width: 1360px; margin: 0 auto; padding: 32px 5vw 64px; }
        .head { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:24px; }
        .headActions { display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
        .kicker { color:var(--green-d); font-size:13px; font-weight:900; letter-spacing:.16em; margin:0 0 8px; }
        h1 { font-size:clamp(36px,5vw,58px); line-height:.98; letter-spacing:-.06em; margin:0; color:var(--navy-d); }
        .sub { color:var(--ink-soft); line-height:1.5; max-width:760px; margin:12px 0 0; }
        .layout { display:grid; grid-template-columns:360px minmax(0,1fr); gap:18px; }
        .queue, .content > section, .heroCard, .state { background:#fff; border:1px solid var(--line); border-radius:22px; box-shadow:0 18px 45px rgba(7,59,93,.06); }
        .queue { padding:20px; }
        .queueHead, .runsHead, .conditionsHead { display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; gap:14px; }
        .queueHead h2, .runsHead h3, .pipelineCard h3, .conditionsCard h3 { margin:0; color:var(--navy-d); letter-spacing:-.03em; }
        .queueHead span, .runsHead span { background:var(--green-soft); color:var(--green-d); font-weight:900; border-radius:999px; padding:8px 12px; }
        .queueList { display:grid; gap:10px; }
        .queueItem { text-align:left; background:var(--bg); border:1px solid #dfeaf0; border-radius:16px; padding:14px; color:var(--ink); cursor:pointer; }
        .queueItem.active { border-color:#8fe7ba; background:#f0fff7; }
        .queueItem strong, .queueItem small, .queueItem em { display:block; }
        .queueItem strong { color:var(--navy-d); margin-bottom:5px; }
        .queueItem small { color:var(--ink-soft); margin-bottom:8px; }
        .queueItem em { color:var(--green-d); font-weight:900; font-style:normal; font-size:12px; }
        .content { display:grid; gap:16px; }
        .heroCard { padding:20px; display:flex; justify-content:space-between; gap:18px; align-items:flex-start; }
        .heroCard h2 { margin:0 0 8px; font-size:28px; color:var(--navy-d); letter-spacing:-.04em; }
        .heroCard p { margin:0; color:var(--ink-soft); }
        .heroActions { display:flex; flex-direction:column; align-items:flex-end; gap:10px; flex:none; }
        .heroActions a { background:#fff; border:1px solid var(--line); color:var(--navy); border-radius:999px; padding:10px 13px; font-weight:900; white-space:nowrap; box-shadow:0 8px 20px rgba(7,59,93,.04); }
        .readyBadge, .blockedBadge, .okPill, .warnPill { border-radius:999px; padding:10px 13px; font-weight:900; white-space:nowrap; }
        .readyBadge, .okPill { background:#e8fff3; color:#008f57; }
        .blockedBadge, .warnPill { background:#fff7e6; color:#9a6700; }
        .summaryGrid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
        .summaryGrid div { background:#fff; border:1px solid var(--line); border-radius:18px; padding:16px; }
        .summaryGrid span { display:block; color:var(--ink-soft); font-weight:800; font-size:12px; margin-bottom:6px; }
        .summaryGrid b { color:var(--navy-d); font-size:18px; word-break:break-word; }
        .pipelineCard, .runs, .conditionsCard { padding:20px; }
        .conditions { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:16px; }
        .condition { display:flex; gap:15px; align-items:flex-start; background:var(--bg); border:1px solid #dfeaf0; border-radius:18px; padding:16px; min-height:96px; }
        .condition.ok { border-color:#bbf7d0; background:#f0fff7; }
        .condition.warn { border-color:#fee7aa; background:#fffaf0; }
        .conditionIcon { width:34px; height:34px; border-radius:999px; display:flex; align-items:center; justify-content:center; flex:none; font-weight:900; font-size:15px; margin-top:1px; }
        .condition.ok .conditionIcon { width:34px; height:34px; border-radius:999px; display:flex; align-items:center; justify-content:center; flex:none; font-weight:900; font-size:15px; margin-top:1px; }
        .condition.warn .conditionIcon { width:34px; height:34px; border-radius:999px; display:flex; align-items:center; justify-content:center; flex:none; font-weight:900; font-size:15px; margin-top:1px; }
        .condition b, .condition small { color:var(--ink-soft); line-height:1.45; font-weight:700; }
        .condition b { color:var(--navy-d); margin-bottom:8px; font-size:15px; letter-spacing:-.01em; line-height:1.18; }
        .condition small { color:var(--ink-soft); line-height:1.45; font-weight:700; }
        .jobsWarning { background:#fff7e6; color:#9a6700; border:1px solid #fee7aa; border-radius:14px; padding:12px 14px; font-weight:800; margin:14px 0 0; }
        .blockReasonBox { display:flex; justify-content:space-between; align-items:center; gap:18px; background:#fff7e6; color:#9a6700; border:1px solid #fee7aa; border-radius:18px; padding:16px; margin:16px 0 0; }
        .blockReasonBox b, .blockReasonBox span { font-weight:700; line-height:1.45; }
        .blockReasonBox b { color:#7a4b00; margin-bottom:0; font-size:15px; line-height:1.25; }
        .blockReasonBox span { font-weight:700; line-height:1.45; }

        .blockReasonText { display:grid; gap:6px; min-width:0; }
        .blockReasonText b { display:block; color:#7a4b00; font-size:15px; line-height:1.25; }
        .blockReasonText span { display:block; color:#8a5a00; font-weight:700; line-height:1.45; }
        .blockReasonBox a { flex:none; background:#fff; border:1px solid #f8d77a; color:#7a4b00; border-radius:999px; padding:11px 15px; font-weight:900; box-shadow:0 8px 20px rgba(154,103,0,.08); }
        .pipelineHead { display:flex; justify-content:space-between; gap:16px; margin-bottom:16px; }
        .pipelineHead p { color:var(--ink-soft); margin:8px 0 0; }
        .stageFlow { display:flex; align-items:center; gap:8px; flex:none; }
        .stageFlow span { border-radius:999px; background:#eef4f8; color:var(--ink-soft); padding:8px 10px; font-size:12px; font-weight:900; }
        .stageFlow span.done { background:#e8fff3; color:#008f57; }
        .stageFlow i { width:24px; height:2px; background:#d8e4eb; }
        .deployForm { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; margin-bottom:14px; }
        label { display:grid; gap:7px; color:#315873; font-weight:900; font-size:13px; }
        .manualJob { margin-bottom:14px; }
        input, select { width:100%; border:1px solid #d9e7ef; background:#fff; border-radius:12px; padding:12px 13px; font:inherit; color:var(--ink); outline:none; min-height:48px; }
        input:focus, select:focus { border-color:var(--green); box-shadow:0 0 0 3px rgba(0,193,110,.12); }
        button, .primary, .ghostBtn { border:0; background:var(--green); color:#fff; border-radius:999px; padding:13px 18px; font-weight:900; cursor:pointer; }
        button:disabled { opacity:.55; cursor:not-allowed; }
        .primary { width:100%; font-size:16px; }
        .ghostBtn { background:#fff; color:var(--navy); border:1px solid var(--line); }
        .helper { color:var(--ink-soft); margin:12px 0 0; font-size:13px; }
        .runList { display:grid; gap:10px; }
        .run { display:grid; grid-template-columns:minmax(0,1fr) auto auto; align-items:center; gap:12px; background:var(--bg); border:1px solid #dfeaf0; border-radius:14px; padding:12px; }
        .run b, .run small { display:block; }
        .run b { color:var(--navy-d); }
        .run small { color:var(--ink-soft); margin-top:4px; }
        .runStatus { border-radius:999px; padding:7px 10px; font-weight:900; font-size:12px; }
        .runStatus.ok { background:#e8fff3; color:#008f57; }
        .runStatus.bad { background:#fff1f0; color:#b42318; }
        .runStatus.pending { background:#fff7e6; color:#9a6700; }
        .run a { color:var(--green-d); font-weight:900; }
        .state { padding:28px; color:var(--ink-soft); }
        .state.error { background:#fff1f0; color:#b42318; }
        .empty { color:var(--ink-soft); }
        .msg { background:#e8fff3; color:#008f57; border:1px solid #bbf7d0; border-radius:14px; padding:12px 14px; font-weight:900; }
        @media(max-width:1120px){ .layout{grid-template-columns:1fr;} .pipelineHead{flex-direction:column;} }
        @media(max-width:760px){ .head,.heroCard,.conditionsHead,.blockReasonBox { display:flex; justify-content:space-between; align-items:center; gap:18px; background:#fff7e6; color:#9a6700; border:1px solid #fee7aa; border-radius:18px; padding:16px; margin:16px 0 0; } .summaryGrid,.deployForm,.conditions { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:16px; } .run{grid-template-columns:1fr;} .blockReasonBox a { flex:none; background:#fff; border:1px solid #f8d77a; color:#7a4b00; border-radius:999px; padding:11px 15px; font-weight:900; box-shadow:0 8px 20px rgba(154,103,0,.08); } }
      `}</style>
    </main>
  );
}

function Condition({ ok, title, help }: { ok: boolean; title: string; help: string }) {
  return (
    <div className={ok ? 'condition ok' : 'condition warn'}>
      <span className="conditionIcon">{ok ? '✓' : '⚠'}</span>
      <span>
        <b>{title}</b>
        <small>{help}</small>
      </span>
    </div>
  );
}

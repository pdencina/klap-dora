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
  FAILURE: 'Fallido en Jenkins',
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

function normalizeEnvironment(value?: string | null) {
  const raw = String(value || '').trim().toLowerCase();

  if (raw.includes('prod') || raw.includes('producción') || raw.includes('produccion')) return 'PROD';
  if (raw.includes('qa') || raw.includes('test') || raw.includes('cert')) return 'QA';
  if (raw.includes('dev') || raw.includes('desarrollo')) return 'DEV';

  return 'PROD';
}

function latestRunForEnv(change: Change | null, env: string) {
  const normalizedEnv = normalizeEnvironment(env);
  return [...(change?.deployment_runs || [])]
    .filter((run) => normalizeEnvironment(run.environment) === normalizedEnv)
    .sort((a, b) => new Date(b.triggered_at || 0).getTime() - new Date(a.triggered_at || 0).getTime())[0];
}

function stageStatusForEnv(change: Change | null, env: string, selectedEnv: string, canExecute: boolean) {
  const run = latestRunForEnv(change, env);
  const selectedStage = normalizeEnvironment(selectedEnv);
  const stage = normalizeEnvironment(env);

  if (run?.status === 'RUNNING' || run?.status === 'QUEUED') return 'running';
  if (run?.status === 'SUCCESS') return 'success';
  if (run?.status === 'FAILURE' || run?.status === 'FAILED_TO_TRIGGER' || run?.status === 'ABORTED') return 'failed';
  if (stage === selectedStage && canExecute) return 'ready';

  return 'pending';
}

function stageStatusLabel(status: string) {
  if (status === 'success') return 'Completado';
  if (status === 'running') return 'En ejecución';
  if (status === 'failed') return 'Fallido';
  if (status === 'ready') return 'Listo';
  return 'Pendiente';
}

function stageClass(status: string) {
  return `envStage ${status}`;
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


function cleanJenkinsJobName(value: string) {
  return String(value || '')
    .replace(/\s+·\s+.*$/, '')
    .replace(/\s+-\s+OK$/, '')
    .trim();
}

function buildJenkinsPipelineUrl(baseUrl: string | undefined, jobName: string) {
  const cleanBase = String(baseUrl || '').replace(/\/$/, '');
  const cleanJob = cleanJenkinsJobName(jobName);

  if (!cleanBase || !cleanJob) return '';

  if (cleanJob.includes('/job/')) {
    return cleanJob.startsWith('http') ? cleanJob : `${cleanBase}/${cleanJob.replace(/^\//, '')}`;
  }

  if (cleanJob.includes('/')) {
    return `${cleanBase}/job/${cleanJob.split('/').map(encodeURIComponent).join('/job/')}/`;
  }

  return `${cleanBase}/job/${encodeURIComponent(cleanJob)}/`;
}



function getPipelineUrlFromBuildUrl(buildUrl?: string | null) {
  const raw = String(buildUrl || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    // Jenkins build URLs normally end in /job/name/10/
    // Remove the final numeric build segment and keep the job base URL.
    url.pathname = url.pathname.replace(/\/\d+\/?$/, '/');
    return url.toString();
  } catch {
    return raw.replace(/\/\d+\/?$/, '/');
  }
}


export default function DeployCenterPage() {
  
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
const [changes, setChanges] = useState<Change[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [jobs, setJobs] = useState<JenkinsJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsWarning, setJobsWarning] = useState('');
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [syncingRunId, setSyncingRunId] = useState('');
  const [analyzingRunId, setAnalyzingRunId] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);
  const [pipelineUrl, setPipelineUrl] = useState('');
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
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
  const environmentStages = useMemo(() => {
    return ['DEV', 'QA', 'PROD'].map((stage) => {
      const run = latestRunForEnv(selected, stage);
      const status = stageStatusForEnv(selected, stage, environment, canExecute);

      return {
        key: stage,
        title: stage,
        subtitle: stage === 'DEV' ? 'Desarrollo' : stage === 'QA' ? 'Validación' : 'Producción',
        status,
        run,
        jobs: run ? 1 : stage === normalizeEnvironment(environment) ? 1 : 0,
        tasks: stage === normalizeEnvironment(environment) ? 2 : run ? 2 : 0,
      };
    });
  }, [selected, environment, canExecute]);
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


  useEffect(() => {
    async function loadPipelineUrl() {
      try {
        const cleanJob = String(jobName || '').trim();
        if (!cleanJob) {
          setPipelineUrl('');
          return;
        }

        const response = await fetch(`/api/deploy/pipeline-url?jobName=${encodeURIComponent(cleanJob)}`, {
          cache: 'no-store',
        });

        const data = await response.json();
        if (!response.ok || !data.ok) {
          setPipelineUrl('');
          return;
        }

        setPipelineUrl(data.pipelineUrl || '');
      } catch {
        setPipelineUrl('');
      }
    }

    loadPipelineUrl();
  }, [jobName]);

  function requestPipelineExecution() {
    const blockedReason = executionBlockReason();
    if (blockedReason) {
      setError(blockedReason);
      return;
    }

    setError('');
    setMessage('');
    setConfirmOpen(true);
  }

  async function triggerPipeline() {
    if (!selected) return;

    setConfirmOpen(false);

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

  async function syncJenkinsRun(runId: string) {
    try {
      setSyncingRunId(runId);
      setError('');
      setMessage('');

      const response = await fetch('/api/deploy/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'No se pudo actualizar Jenkins');

      setMessage('Estado Jenkins actualizado correctamente.');
      await load();
    } catch (err: any) {
      setError(err?.message || 'Error actualizando Jenkins');
    } finally {
      setSyncingRunId('');
    }
  }

  async function analyzeJenkinsRun(runId: string) {
    try {
      setAnalyzingRunId(runId);
      setError('');
      setMessage('Analizando log Jenkins...');
      setAnalysis(null);
      setAnalysisOpen(false);

      const response = await fetch('/api/deploy/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `No se pudo analizar Jenkins. HTTP ${response.status}`);
      }

      setAnalysis(data.analysis);
      setAnalysisOpen(true);
      setMessage('Análisis Jenkins generado correctamente.');
    } catch (err: any) {
      setAnalysisOpen(false);
      setError(err?.message || 'Error analizando Jenkins');
    } finally {
      setAnalyzingRunId('');
    }
  }

  async function copyAnalysisRecommendation() {
    if (!analysis?.copyText) return;

    try {
      await navigator.clipboard.writeText(analysis.copyText);
      setMessage('Recomendación copiada al portapapeles.');
    } catch {
      setError('No fue posible copiar la recomendación.');
    }
  }

  return (
    <div className={sidebarCollapsed ? 'deployShell sidebarCollapsed' : 'deployShell'}>

      <aside className={sidebarCollapsed ? 'deploySidebar collapsed' : 'deploySidebar'}>
        <div className="sidebarTop">
          <button
            className="hamburgerBtn"
            type="button"
            aria-label="Abrir o cerrar menú"
            onClick={() => setSidebarCollapsed((value) => !value)}
          >
            <span />
            <span />
            <span />
          </button>

          <a className="sidebarBrand" href="/">
            <strong>klap</strong>
            <span>RELEASE</span>
          </a>
        </div>

        <nav className="sidebarNav" aria-label="Navegación principal">
          <a href="/" className="sidebarLink"><span>⌂</span><b>Inicio</b></a>
          <a href="/rdc" className="sidebarLink"><span>＋</span><b>Nuevo RDC</b></a>
          <a href="/mis-cambios" className="sidebarLink"><span>◇</span><b>Mis Cambios</b></a>
          <a href="/release" className="sidebarLink"><span>○</span><b>Release</b></a>
          <a href="/aprobaciones" className="sidebarLink"><span>✓</span><b>Aprobaciones</b></a>
          <a href="/cab" className="sidebarLink"><span>▣</span><b>Agenda CAB</b></a>
          <a href="/pap" className="sidebarLink"><span>□</span><b>Plan PAP</b></a>
          <a href="/deploy" className="sidebarLink active"><span>↗</span><b>Deploy Center</b></a>
          <a href="/cierre" className="sidebarLink"><span>⚑</span><b>Cierre</b></a>
          <a href="/dashboard" className="sidebarLink"><span>⌁</span><b>Dashboard DORA</b></a>
        </nav>

        <div className="sidebarUser">
          <div className="avatar">PE</div>
          <div>
            <b>Pablo Encina</b>
            <span>Release Manager</span>
          </div>
        </div>
      </aside>

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
                    <small>Control previo</small>
                    <h3>Condiciones para ejecutar</h3>
                  </div>
                  <span className={canExecute ? 'okBadge' : 'reviewBadge'}>{canExecute ? 'Todo listo' : 'Revisión requerida'}</span>
                </div>

                <div className="controlGrid">
                  <article className="controlItem">
                    <div className="controlIcon">✓</div>
                    <div>
                      <b>CAB aprobado</b>
                      <span>{approvedCount(selected)}/{totalApprovals(selected)} áreas aprobadoras listas</span>
                    </div>
                  </article>

                  <article className="controlItem">
                    <div className="controlIcon">▣</div>
                    <div>
                      <b>{papReady ? 'Plan PAP completo' : 'Plan PAP pendiente'}</b>
                      <span>{papReady ? 'Actividades validadas para ejecución' : 'Completa y valida el Plan PAP'}</span>
                    </div>
                  </article>

                  <article className="controlItem">
                    <div className="controlIcon">⚙</div>
                    <div>
                      <b>Job Jenkins configurado</b>
                      <span>{jobName || 'Sin job asociado'}</span>
                    </div>
                  </article>

                  <article className="controlItem">
                    <div className="controlIcon">◎</div>
                    <div>
                      <b>Rol Release Manager</b>
                      <span>{roleReady ? 'Usuario autorizado para ejecutar' : 'Usuario no autorizado para ejecutar'}</span>
                    </div>
                  </article>
                </div>                {!canExecute ? (
                  <div className="blockReasonBox">
                    <div className="blockReasonText">
                      <b>Revisión requerida</b>
                      <span>{executionBlockReason()}</span>
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

                    <div className="pipelineHeadActions">
                      {pipelineUrl ? (
                        <a className="pipelineLink" href={pipelineUrl} target="_blank" rel="noreferrer">
                          Abrir pipeline Jenkins ↗
                        </a>
                      ) : null}
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
                  </div>

                  <div className="environmentPipeline" aria-label="Flujo de ambientes Jenkins">
                    <div className="environmentPipelineHead">
                      <div>
                        <p className="kicker">Flujo por ambiente</p>
                        <h4>DEV → QA → PROD</h4>
                      </div>
                      <span>{normalizeEnvironment(environment)} seleccionado</span>
                    </div>

                    <div className="environmentStageFlow">
                      {environmentStages.map((stage, index) => (
                        <div className="envStageWrap" key={stage.key}>
                          <article className={stageClass(stage.status)}>
                            <div className="envStageTopLine" />
                            <div className="envStageIcon" aria-hidden="true">
                              {stage.status === 'success' ? '✓' : stage.status === 'failed' ? '!' : stage.status === 'running' ? '…' : '↯'}
                            </div>
                            <div className="envStageBody">
                              <b>{stage.title}</b>
                              <small>{stage.jobs} job, {stage.tasks} tasks</small>
                              <span>{stageStatusLabel(stage.status)}</span>
                            </div>
                            {stage.run?.build_url ? (
                              <a className="envStageOpen" href={stage.run.build_url} target="_blank" rel="noreferrer" aria-label={`Abrir build ${stage.title}`}>
                                ↗
                              </a>
                            ) : null}
                          </article>

                          {index < environmentStages.length - 1 ? <div className="envStageConnector" /> : null}
                        </div>
                      ))}
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
                        <option>DEV</option>
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

                  <button className="primary" type="button" disabled={!canExecute || triggering} onClick={requestPipelineExecution}>
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
                            <div className="runInfo">
                              <b>{run.job_name}</b>
                              <small>{formatDate(run.triggered_at)} · {run.triggered_by || 'No informado'}</small>
                            </div>

                            <div className="runState">
                              <span className={`runStatus ${run.result === 'FAILURE' || run.status === 'FAILED_TO_TRIGGER' ? 'bad' : run.status === 'SUCCESS' || run.result === 'SUCCESS' ? 'ok' : 'pending'}`}>
                                {STATUS_LABEL[run.status] || run.status}
                              </span>
                            </div>

                            <div className="runActionsPanel">
                              <div className="runActionGroup runActionLinks">
                              {run.build_url ? <a href={run.build_url} target="_blank" rel="noreferrer">Revisar log Jenkins ↗</a> : run.queue_url ? <a href={run.queue_url} target="_blank" rel="noreferrer">Ver cola ↗</a> : null}
                              {getPipelineUrlFromBuildUrl(run.build_url) ? (
                                <a className="pipelineMiniLink" href={getPipelineUrlFromBuildUrl(run.build_url)} target="_blank" rel="noreferrer">Abrir pipeline ↗</a>
                              ) : null}
                              {run.build_url && (run.status === 'FAILURE' || run.result === 'FAILURE' || run.result === 'UNSTABLE') ? (
                                <button
                                  type="button"
                                  className="syncBtn analyzeBtn"
                                  onClick={() => analyzeJenkinsRun(run.id)}
                                  disabled={analyzingRunId === run.id}
                                >
                                  {analyzingRunId === run.id ? 'Analizando log…' : 'Analizar fallo'}
                                </button>
                              ) : null}
                            </div>

                              <div className="runActionGroup runActionOps">
                              <button
                                type="button"
                                className="syncBtn primaryAction"
                                onClick={() => syncJenkinsRun(run.id)}
                                disabled={syncingRunId === run.id}
                              >
                                {syncingRunId === run.id ? 'Actualizando…' : 'Actualizar estado'}
                              </button>
                            </div>
                            </div>
                          </article>
                        ))}
                    </div>
                  )}
                </section>

                {message ? <div className="msg">{message}</div> : null}

                {confirmOpen ? (
                  <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
                    <div className="confirmModal">
                      <div className="modalIcon">⚙</div>
                      <p className="kicker">Confirmación Jenkins</p>
                      <h3 id="confirm-title">Confirmar ejecución del pipeline</h3>
                      <p className="modalLead">
                        {environment === 'Producción'
                          ? 'Vas a ejecutar un pipeline productivo.'
                          : `Vas a ejecutar un pipeline en ambiente ${environment}.`}
                      </p>

                      <div className="modalSummary">
                        <div><span>RDC</span><b>{selected.title}</b></div>
                        <div><span>Job Jenkins</span><b>{jobName}</b></div>
                        <div><span>Ambiente</span><b>{environment}</b></div>
                        <div><span>Versión</span><b>{version || 'No informada'}</b></div>
                      </div>

                      <p className="modalWarning">
                        Esta acción quedará registrada como evidencia técnica del cambio.
                      </p>

                      <div className="modalActions">
                        <button type="button" className="ghostBtn" onClick={() => setConfirmOpen(false)}>Cancelar</button>
                        <button type="button" onClick={triggerPipeline} disabled={triggering}>
                          {triggering ? 'Ejecutando…' : 'Ejecutar pipeline'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {analysisOpen && analysis ? (
                  <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="analysis-title">
                    <div className="analysisModal">
                      <div className="analysisModalHead">
                        <div>
                          <div className="modalIcon">✦</div>
                          <p className="kicker">Recomendación IA</p>
                          <h3 id="analysis-title">{analysis.title || 'Análisis Jenkins'}</h3>
                          <p>{analysis.probableCause}</p>
                        </div>
                        <button type="button" className="closeBtn" onClick={() => setAnalysisOpen(false)}>Cerrar</button>
                      </div>

                      <div className="analysisGrid">
                        <div>
                          <h4>Hallazgos</h4>
                          <ul>
                            {(analysis.findings || []).map((item: string, i: number) => <li key={i}>{item}</li>)}
                          </ul>
                        </div>
                        <div>
                          <h4>Pasos recomendados para resolver</h4>
                          <ol>
                            {(analysis.recommendedSteps || []).map((item: string, i: number) => <li key={i}>{item}</li>)}
                          </ol>
                        </div>
                      </div>

                      {analysis.evidenceLines?.length ? (
                        <div className="evidenceBox">
                          <h4>Líneas críticas del log</h4>
                          {(analysis.evidenceLines || []).map((line: string, i: number) => <code key={i}>{line}</code>)}
                        </div>
                      ) : null}

                      <p className="analysisDisclaimer">{analysis.disclaimer}</p>

                      <div className="modalActions">
                        <button type="button" className="ghostBtn" onClick={copyAnalysisRecommendation}>Copiar recomendación</button>
                        {analysis.buildUrl ? <a className="ghostBtn" href={analysis.buildUrl} target="_blank" rel="noreferrer">Abrir Jenkins ↗</a> : null}
                        <button type="button" onClick={() => setAnalysisOpen(false)}>Entendido</button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="state">Selecciona un cambio para ver su ejecución.</div>
            )}
          </section>
        </section>
      ) : null}

      <style jsx global>{`
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
        .readyBadge, .okPill { background:#fff; color:#008f57; }
        .blockedBadge, .warnPill { background:#fff; color:#9a6700; }
        .summaryGrid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
        .summaryGrid div { background:#fff; border:1px solid var(--line); border-radius:18px; padding:16px; }
        .summaryGrid span { display:block; color:var(--ink-soft); font-weight:800; font-size:12px; margin-bottom:6px; }
        .summaryGrid b { color:var(--navy-d); font-size:18px; word-break:break-word; }
        .pipelineCard, .runs, .conditionsCard { padding:20px; }
        .conditions { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:16px; }
        .condition { display:flex; gap:15px; align-items:flex-start; background:var(--bg); border:1px solid #dfeaf0; border-radius:18px; padding:16px; min-height:96px; }
        .condition.ok { border-color:#dfeaf0; background:#f0fff7; }
        .condition.warn { border-color:#dfeaf0; background:#fff; }
        .conditionIcon { width:34px; height:34px; border-radius:999px; display:flex; align-items:center; justify-content:center; flex:none; font-weight:900; font-size:15px; margin-top:1px; }
        .condition.ok .conditionIcon { width:34px; height:34px; border-radius:999px; display:flex; align-items:center; justify-content:center; flex:none; font-weight:900; font-size:15px; margin-top:1px; }
        .condition.warn .conditionIcon { width:34px; height:34px; border-radius:999px; display:flex; align-items:center; justify-content:center; flex:none; font-weight:900; font-size:15px; margin-top:1px; }
        .condition b, .condition small { color:var(--ink-soft); line-height:1.45; font-weight:700; }
        .condition b { color:var(--navy-d); margin-bottom:8px; font-size:15px; letter-spacing:-.01em; line-height:1.18; }
        .condition small { color:var(--ink-soft); line-height:1.45; font-weight:700; }
        .jobsWarning { background:#fff; color:#9a6700; border:1px solid #dfeaf0; border-radius:14px; padding:12px 14px; font-weight:800; margin:14px 0 0; }
        .blockReasonBox { display:flex; justify-content:space-between; align-items:center; gap:18px; background:#fff; color:#9a6700; border:1px solid #dfeaf0; border-radius:18px; padding:16px; margin:16px 0 0; }
        .blockReasonBox b, .blockReasonBox span { font-weight:700; line-height:1.45; }
        .blockReasonBox b { color:#7a4b00; margin-bottom:0; font-size:15px; line-height:1.25; }
        .blockReasonBox span { font-weight:700; line-height:1.45; }

        .blockReasonText { display:grid; gap:6px; min-width:0; }
        .blockReasonText b { display:block; color:#7a4b00; font-size:15px; line-height:1.25; }
        .blockReasonText span { display:block; color:#8a5a00; font-weight:700; line-height:1.45; }
        .blockReasonBox a { flex:none; background:#fff; border:1px solid #f8d77a; color:#7a4b00; border-radius:999px; padding:11px 15px; font-weight:900; box-shadow:0 8px 20px rgba(154,103,0,.08); }
        .pipelineHead { display:flex; justify-content:space-between; gap:16px; margin-bottom:16px; }
        .pipelineHead p { color:var(--ink-soft); margin:8px 0 0; }
        .pipelineHeadActions { display:flex; flex-direction:column; align-items:flex-end; gap:12px; }
        .pipelineLink { background:#fff; border:1px solid var(--line); color:var(--navy); border-radius:999px; padding:10px 14px; font-weight:900; white-space:nowrap; box-shadow:0 8px 20px rgba(7,59,93,.04); }
        .stageFlow { display:flex; align-items:center; gap:8px; flex:none; }
        .stageFlow span { border-radius:999px; background:#eef4f8; color:var(--ink-soft); padding:8px 10px; font-size:12px; font-weight:900; }
        .stageFlow span.done { background:#fff; color:#008f57; }
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
.runTitleRow b { color:var(--navy-d); font-size:15px; line-height:1.2; word-break:break-word; }
.run b,
.runInfo b { color:var(--navy-d); font-size:16px; line-height:1.25; word-break:break-word; }
        .runInfo small { color:var(--ink-soft); font-size:13px; line-height:1.35; word-break:break-word; }
.runActions a, .runActions button { white-space:nowrap; }
        .runStatus { display:inline-flex; align-items:center; justify-content:center; border-radius:999px; padding:7px 11px; font-size:12px; font-weight:900; white-space:nowrap; flex-shrink:0; }
.runStatus.ok { background:#fff; color:#008f57; }
.runInfo b { color:var(--navy-d); font-size:15px; line-height:1.25; word-break:break-word; }
        .runInfo small { color:var(--ink-soft); font-size:13px; line-height:1.35; word-break:break-word; }
.runActions a, .runActions button { white-space:nowrap; }
        .runStatus { display:inline-flex; align-items:center; justify-content:center; border-radius:999px; padding:7px 11px; font-size:12px; font-weight:900; white-space:nowrap; flex-shrink:0; }
.runActions a:first-child { color:var(--green-d); font-weight:900; }
.runInfo b { color:var(--navy-d); font-size:15px; line-height:1.25; word-break:break-word; }
        .runInfo small { color:var(--ink-soft); font-size:13px; line-height:1.35; word-break:break-word; }
.runLinks a, .runLinks button,
.runStatus { display:inline-flex; align-items:center; justify-content:center; border-radius:999px; padding:7px 11px; font-size:12px; font-weight:900; white-space:nowrap; flex-shrink:0; }

        .runStatus.bad { background:#fff1f0; color:#b42318; }
        .runStatus.pending { background:#fff; color:#9a6700; }
.runActions a, .runActions button { white-space:nowrap; }
.analysisCard { background:#fff; border:1px solid var(--line); border-radius:22px; padding:20px; box-shadow:0 18px 45px rgba(7,59,93,.06); }
        .analysisHead { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:16px; }
        .analysisHead h3 { margin:0; color:var(--navy-d); font-size:24px; letter-spacing:-.04em; }
        .analysisHead p { color:var(--ink-soft); margin:8px 0 0; line-height:1.45; }
        .analysisHead a { background:#fff; border:1px solid var(--line); color:var(--navy); border-radius:999px; padding:10px 13px; font-weight:900; white-space:nowrap; }
        .analysisGrid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        .analysisGrid div, .evidenceBox { background:var(--bg); border:1px solid #dfeaf0; border-radius:16px; padding:14px; }
        .analysisGrid h4, .evidenceBox h4 { margin:0 0 10px; color:var(--navy-d); }
        .analysisGrid li { color:var(--ink); margin:6px 0; line-height:1.4; }
        .evidenceBox { margin-top:14px; display:grid; gap:8px; }
        .evidenceBox code { display:block; background:#fff; border:1px solid #dfeaf0; border-radius:10px; padding:9px 10px; color:#315873; white-space:pre-wrap; font-size:12px; }
        .analysisDisclaimer { margin:12px 0 0; color:var(--ink-soft); font-size:12px; line-height:1.4; }
        .analysisModal { width:min(860px, 100%); max-height:88vh; overflow:auto; background:#fff; border:1px solid var(--line); border-radius:28px; box-shadow:0 30px 90px rgba(5,24,38,.28); padding:28px; }
        .analysisModalHead { display:flex; justify-content:space-between; align-items:flex-start; gap:18px; margin-bottom:18px; }
        .analysisModalHead h3 { margin:0; color:var(--navy-d); font-size:30px; letter-spacing:-.04em; }
        .analysisModalHead p { color:var(--ink-soft); margin:8px 0 0; line-height:1.45; }
        .closeBtn { background:#fff; border:1px solid var(--line); color:var(--navy); border-radius:999px; padding:10px 13px; font-weight:900; }
        .state { padding:28px; color:var(--ink-soft); }
        .state.error { background:#fff1f0; color:#b42318; }
        .empty { color:var(--ink-soft); }
        .msg { background:#fff; color:#008f57; border:1px solid #dfeaf0; border-radius:14px; padding:12px 14px; font-weight:900; }
        .modalOverlay { position:fixed; inset:0; z-index:80; background:rgba(5,24,38,.58); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:24px; }
        .confirmModal { width:min(620px, 100%); background:#fff; border:1px solid var(--line); border-radius:28px; box-shadow:0 30px 90px rgba(5,24,38,.28); padding:28px; }
        .modalIcon { width:48px; height:48px; border-radius:16px; background:#fff; color:#008f57; display:flex; align-items:center; justify-content:center; font-size:24px; margin-bottom:14px; }
        .confirmModal h3 { margin:0; color:var(--navy-d); font-size:28px; letter-spacing:-.04em; }
        .modalLead { color:var(--ink); font-weight:800; margin:10px 0 18px; line-height:1.45; }
        .modalSummary { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:16px 0; }
        .modalSummary div { background:var(--bg); border:1px solid #dfeaf0; border-radius:14px; padding:12px; }
        .modalSummary span { display:block; color:var(--ink-soft); font-size:12px; font-weight:900; margin-bottom:5px; }
        .modalSummary b { display:block; color:var(--navy-d); line-height:1.3; word-break:break-word; }
        .modalWarning { background:#fff; border:1px solid #dfeaf0; color:#7a4b00; border-radius:16px; padding:13px 14px; font-weight:800; line-height:1.45; }
        .modalActions { display:flex; justify-content:flex-end; gap:10px; margin-top:20px; }
        .modalActions button { min-width:150px; }
        @media(max-width:1120px){ .layout{grid-template-columns:1fr;} .pipelineHead{flex-direction:column;} }
        @media(max-width:760px){ .head,.heroCard,.conditionsHead,.blockReasonBox,.pipelineHead{flex-direction:column; align-items:flex-start;} .heroActions{align-items:flex-start; width:100%;} .heroActions a{width:100%; text-align:center;} .pipelineHeadActions{align-items:flex-start; width:100%;} .pipelineLink{width:100%; text-align:center;} .summaryGrid,.deployForm,.conditions,.modalSummary,.analysisGrid{grid-template-columns:1fr;} .run{grid-template-columns:1fr; align-items:flex-start;} .runTop{display:block;} .runInfo{margin-bottom:8px;} .runActions{justify-content:flex-start; width:100%;} .runActions a,.runActions button{flex:1; text-align:center;} .modalActions{flex-direction:column;} .modalActions button{width:100%;} .analysisModalHead{flex-direction:column;} .closeBtn{width:100%;} } .runActions a,.runActions button{flex:1; text-align:center;} .modalActions{flex-direction:column;} .modalActions button{width:100%;} .analysisModalHead{flex-direction:column;} .closeBtn{width:100%;} } .runActions a,.runActions button{flex:1; text-align:center;}  .head,.heroCard,.conditionsHead,.blockReasonBox,.pipelineHead { display:flex; justify-content:space-between; align-items:center; gap:18px; background:#fff; color:#9a6700; border:1px solid #dfeaf0; border-radius:18px; padding:16px; margin:16px 0 0; } .summaryGrid,.deployForm,.conditions { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:16px; } .run{flex-direction:column; align-items:flex-start;} .blockReasonBox a { flex:none; background:#fff; border:1px solid #f8d77a; color:#7a4b00; border-radius:999px; padding:11px 15px; font-weight:900; box-shadow:0 8px 20px rgba(154,103,0,.08); } }
      
        @media(max-width:980px){
.runState, .runLinks,
.runLinks a, .runLinks button,
}
.syncBtn {
          background:#fff;
          border:1px solid var(--line);
          color:var(--navy);
        }

        .primaryAction {
          min-width:132px;
        }

        .runStatus {
          display:inline-flex;
          align-items:center;
          justify-content:center;
          border-radius:999px;
          padding:7px 11px;
          font-size:12px;
          font-weight:900;
          white-space:nowrap;
          flex-shrink:0;
        }

        @media(max-width:980px){
          .run {
            grid-template-columns:1fr;
            align-items:flex-start;
          }

          .runState,
          .runActionsPanel {
            width:100%;
          }

          .runActionsPanel {
            grid-template-columns:1fr 1fr;
          }
        }

        @media(max-width:560px){
          .runActionsPanel {
            grid-template-columns:1fr;
          }
        }

      
        /* Deploy Center final palette: white cards, green only for badges */
        .heroCard,
        .selectedCard,
        .conditionsCard,
        .deployCard,
        .historyCard,
        .summaryCard,
        .pipelineCard,
        .controlCard {
          background:#fff !important;
          border-color:#dfeaf0 !important;
        }

        .readyBadge,
        .okBadge,
        .successBadge,
        .statusReady,
        .statusOk,
        .runStatus.ok,
        .runStatus.SUCCESS {
          background:#e8fff3 !important;
          color:#008f57 !important;
          border-color:#bbf7d0 !important;
        }

        .blockReasonBox,
        .pendingBox,
        .warningBox,
        .reviewBox {
          background:#fff7e6 !important;
          border-color:#fee7aa !important;
          color:#7a4b00 !important;
        }

        .analyzeBtn {
          background:#fffaf0 !important;
          border:1px solid #f8df9a !important;
          color:#7a4b00 !important;
        }

      
        /* Historial de ejecución - grid final limpio */
        .runs {
          display:flex;
          flex-direction:column;
          gap:10px;
        }

        .run {
          background:#fff !important;
          border:1px solid #dfeaf0 !important;
          border-radius:16px !important;
          padding:14px 16px !important;
          display:grid !important;
          grid-template-columns:minmax(230px,1fr) 150px minmax(360px,420px) !important;
          align-items:center !important;
          gap:16px !important;
          box-shadow:0 10px 24px rgba(7,59,93,.03) !important;
        }

        .runInfo {
          min-width:0 !important;
          display:flex !important;
          flex-direction:column !important;
          gap:4px !important;
        }

        .runInfo b {
          display:block !important;
          color:var(--navy-d) !important;
          font-size:15px !important;
          line-height:1.25 !important;
          word-break:break-word !important;
        }

        .runInfo small {
          display:block !important;
          color:var(--ink-soft) !important;
          font-size:13px !important;
          line-height:1.35 !important;
          word-break:break-word !important;
        }

        .runState {
          display:flex !important;
          align-items:center !important;
          justify-content:flex-start !important;
        }

        .runStatus {
          display:inline-flex !important;
          align-items:center !important;
          justify-content:center !important;
          border-radius:999px !important;
          padding:7px 11px !important;
          font-size:12px !important;
          font-weight:900 !important;
          white-space:nowrap !important;
          flex-shrink:0 !important;
        }

        .runActionsPanel {
          display:grid !important;
          grid-template-columns:1fr 1fr !important;
          gap:8px !important;
          align-items:center !important;
          justify-content:stretch !important;
          width:100% !important;
        }

        .runActionGroup {
          display:contents !important;
        }

        .runActionsPanel a,
        .runActionsPanel button {
          min-height:36px !important;
          border-radius:999px !important;
          padding:9px 12px !important;
          font-size:12px !important;
          font-weight:900 !important;
          white-space:nowrap !important;
          display:inline-flex !important;
          align-items:center !important;
          justify-content:center !important;
          text-align:center !important;
          width:100% !important;
          line-height:1 !important;
        }

        .runActionLinks a:first-child {
          color:var(--green-d) !important;
          background:#fff !important;
          border:1px solid transparent !important;
        }

        .pipelineMiniLink {
          color:var(--navy) !important;
          background:#fff !important;
          border:1px solid var(--line) !important;
        }

        .analyzeBtn {
          background:#fffaf0 !important;
          border:1px solid #f8df9a !important;
          color:#7a4b00 !important;
        }

        .syncBtn {
          background:#fff !important;
          border:1px solid var(--line) !important;
          color:var(--navy) !important;
        }

        .primaryAction {
          min-width:0 !important;
        }

        @media(max-width:980px){
          .run {
            grid-template-columns:1fr !important;
            align-items:flex-start !important;
          }

          .runState,
          .runActionsPanel {
            width:100% !important;
          }

          .runActionsPanel {
            grid-template-columns:1fr 1fr !important;
          }
        }

        @media(max-width:560px){
          .runActionsPanel {
            grid-template-columns:1fr !important;
          }
        }

      
        /* Control previo cards */
        .conditionsCard {
          background:#fff !important;
          border:1px solid #dfeaf0 !important;
          border-radius:20px;
          padding:18px;
          box-shadow:0 18px 45px rgba(7,59,93,.05);
        }

        .conditionsHead {
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:14px;
          margin-bottom:14px;
        }

        .conditionsHead small {
          color:var(--green-d);
          text-transform:uppercase;
          letter-spacing:.22em;
          font-weight:900;
          font-size:12px;
        }

        .conditionsHead h3 {
          margin:4px 0 0;
          color:var(--navy-d);
          font-size:20px;
          line-height:1.2;
        }

        .controlGrid {
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:10px;
        }

        .controlItem {
          display:flex;
          align-items:center;
          gap:12px;
          background:#fff;
          border:1px solid #dfeaf0;
          border-radius:14px;
          padding:14px 16px;
        }

        .controlIcon {
          width:34px;
          height:34px;
          border-radius:999px;
          background:#e8fff3;
          color:#008f57;
          display:flex;
          align-items:center;
          justify-content:center;
          font-weight:900;
          flex-shrink:0;
        }

        .controlItem b {
          display:block;
          color:var(--navy-d);
          font-size:15px;
          line-height:1.25;
        }

        .controlItem span {
          display:block;
          color:var(--ink-soft);
          font-size:13px;
          line-height:1.35;
          margin-top:3px;
          word-break:break-word;
        }

        @media(max-width:760px){
          .conditionsHead {
            flex-direction:column;
            align-items:flex-start;
          }

          .controlGrid {
            grid-template-columns:1fr;
          }
        }

      
        /* Jenkins Pipeline polish */
        .pipelineCard {
          background:#fff !important;
          border:1px solid #dfeaf0 !important;
          border-radius:20px !important;
          padding:18px !important;
          box-shadow:0 18px 45px rgba(7,59,93,.05) !important;
        }

        .pipelineHead {
          display:grid !important;
          grid-template-columns:minmax(0,1fr) auto !important;
          align-items:start !important;
          gap:18px !important;
          padding:0 0 14px !important;
          margin-bottom:14px !important;
          border-bottom:1px solid #edf3f7 !important;
        }

        .pipelineHead .kicker {
          color:var(--green-d) !important;
          text-transform:uppercase !important;
          letter-spacing:.22em !important;
          font-weight:900 !important;
          font-size:12px !important;
          margin:0 0 4px !important;
        }

        .pipelineHead h3 {
          margin:0 !important;
          color:var(--navy-d) !important;
          font-size:22px !important;
          line-height:1.15 !important;
        }

        .pipelineHead p {
          margin:8px 0 0 !important;
          color:var(--ink-soft) !important;
          line-height:1.45 !important;
          max-width:560px !important;
        }

        .pipelineHeadActions {
          display:flex !important;
          flex-direction:column !important;
          align-items:flex-end !important;
          gap:12px !important;
          min-width:260px !important;
        }

        .pipelineLink {
          display:inline-flex !important;
          align-items:center !important;
          justify-content:center !important;
          min-height:40px !important;
          border-radius:999px !important;
          padding:10px 16px !important;
          background:#fff !important;
          border:1px solid var(--line) !important;
          color:var(--navy) !important;
          font-weight:900 !important;
          white-space:nowrap !important;
          box-shadow:0 8px 18px rgba(7,59,93,.04) !important;
        }

        .stageFlow {
          display:flex !important;
          align-items:center !important;
          justify-content:flex-end !important;
          gap:8px !important;
          flex-wrap:wrap !important;
        }

        .stageFlow span {
          display:inline-flex !important;
          align-items:center !important;
          justify-content:center !important;
          min-height:28px !important;
          padding:6px 11px !important;
          border-radius:999px !important;
          background:#f4f8fb !important;
          color:var(--ink-soft) !important;
          font-size:12px !important;
          font-weight:900 !important;
          border:1px solid #edf3f7 !important;
        }

        .stageFlow span.done {
          background:#e8fff3 !important;
          color:#008f57 !important;
          border-color:#bbf7d0 !important;
        }

        .pipelineForm,
        .deployForm {
          display:grid !important;
          grid-template-columns:1fr 1fr !important;
          gap:12px !important;
        }

        .pipelineForm label,
        .deployForm label {
          display:flex !important;
          flex-direction:column !important;
          gap:6px !important;
          color:var(--navy) !important;
          font-size:13px !important;
          font-weight:900 !important;
        }

        .pipelineForm input,
        .pipelineForm select,
        .deployForm input,
        .deployForm select {
          min-height:46px !important;
          border-radius:12px !important;
          border:1px solid #dfeaf0 !important;
          background:#fff !important;
          padding:0 14px !important;
          color:var(--navy-d) !important;
          font-weight:800 !important;
          box-shadow:none !important;
        }

        .pipelineForm input:focus,
        .pipelineForm select:focus,
        .deployForm input:focus,
        .deployForm select:focus {
          border-color:#9edec1 !important;
          box-shadow:0 0 0 3px rgba(0,184,107,.10) !important;
          outline:none !important;
        }

        .pipelineForm label.full,
        .deployForm label.full,
        .manualJobField {
          grid-column:1 / -1 !important;
        }

        .pipelineCard button.primary,
        .pipelineCard .primary {
          width:100% !important;
          min-height:50px !important;
          margin-top:14px !important;
          border-radius:999px !important;
          background:#00b86b !important;
          border:1px solid #00b86b !important;
          color:#fff !important;
          font-weight:900 !important;
          box-shadow:0 14px 28px rgba(0,184,107,.16) !important;
        }

        .pipelineCard .helper {
          margin:10px 0 0 !important;
          color:var(--ink-soft) !important;
          font-size:13px !important;
          line-height:1.4 !important;
        }

        @media(max-width:860px){
          .pipelineHead {
            grid-template-columns:1fr !important;
          }

          .pipelineHeadActions {
            align-items:flex-start !important;
            min-width:0 !important;
            width:100% !important;
          }

          .pipelineLink {
            width:100% !important;
          }

          .stageFlow {
            justify-content:flex-start !important;
          }

          .pipelineForm,
          .deployForm {
            grid-template-columns:1fr !important;
          }
        }

      
        /* Left hamburger sidebar layout */
        .deployShell {
          --sidebar-w: 280px;
          min-height:100vh;
          background:#f4f8fb;
        }

        .deploySidebar {
          position:fixed;
          inset:0 auto 0 0;
          width:var(--sidebar-w);
          background:#fff;
          border-right:1px solid #dfeaf0;
          box-shadow:12px 0 34px rgba(7,59,93,.04);
          z-index:50;
          display:flex;
          flex-direction:column;
          padding:18px 14px;
          transition:width .2s ease;
        }

        .sidebarTop {
          display:flex;
          align-items:center;
          gap:14px;
          padding:0 4px 18px;
          border-bottom:1px solid #edf3f7;
          margin-bottom:14px;
        }

        .hamburgerBtn {
          width:38px;
          height:38px;
          border:1px solid #dfeaf0;
          background:#fff;
          border-radius:12px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          flex-direction:column;
          gap:4px;
          flex-shrink:0;
        }

        .hamburgerBtn span {
          width:16px;
          height:2px;
          background:#073b5d;
          border-radius:999px;
          display:block;
        }

        .sidebarBrand {
          display:flex;
          align-items:baseline;
          gap:8px;
          white-space:nowrap;
        }

        .sidebarBrand strong {
          color:#009f63;
          font-size:26px;
          letter-spacing:-.04em;
          line-height:1;
        }

        .sidebarBrand span {
          color:#425d76;
          font-size:12px;
          font-weight:900;
          letter-spacing:.18em;
        }

        .sidebarNav {
          display:flex;
          flex-direction:column;
          gap:6px;
          padding:4px 0;
          flex:1;
        }

        .sidebarLink {
          min-height:46px;
          display:flex;
          align-items:center;
          gap:12px;
          padding:0 14px;
          border-radius:14px;
          color:#425d76;
          font-weight:800;
          border:1px solid transparent;
          transition:background .15s ease, color .15s ease, border-color .15s ease;
        }

        .sidebarLink span {
          width:22px;
          height:22px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          color:#31516d;
          font-size:15px;
          flex-shrink:0;
        }

        .sidebarLink b {
          font-size:14px;
          white-space:nowrap;
        }

        .sidebarLink:hover {
          background:#f4f8fb;
          color:#073b5d;
        }

        .sidebarLink.active {
          background:#e8fff3;
          border-color:#bbf7d0;
          color:#008f57;
        }

        .sidebarLink.active span {
          color:#008f57;
        }

        .sidebarUser {
          display:flex;
          align-items:center;
          gap:12px;
          border:1px solid #dfeaf0;
          border-radius:16px;
          padding:12px;
          background:#fff;
          box-shadow:0 10px 24px rgba(7,59,93,.03);
        }

        .avatar {
          width:38px;
          height:38px;
          border-radius:999px;
          background:#00b86b;
          color:#fff;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:13px;
          font-weight:900;
          flex-shrink:0;
        }

        .sidebarUser b {
          display:block;
          color:#073b5d;
          font-size:13px;
          line-height:1.2;
        }

        .sidebarUser span {
          display:block;
          color:#60748a;
          font-size:12px;
          margin-top:2px;
        }

        .deployShell .deploy {
          margin-left:var(--sidebar-w);
          width:calc(100% - var(--sidebar-w));
          max-width:none;
          padding-left:36px;
          padding-right:36px;
          transition:margin-left .2s ease, width .2s ease;
        }

        .deployShell.sidebarCollapsed {
          --sidebar-w: 86px;
        }

        .deployShell.sidebarCollapsed .sidebarBrand span,
        .deployShell.sidebarCollapsed .sidebarLink b,
        .deployShell.sidebarCollapsed .sidebarUser div {
          display:none;
        }

        .deployShell.sidebarCollapsed .deploySidebar {
          align-items:center;
        }

        .deployShell.sidebarCollapsed .sidebarTop {
          flex-direction:column;
        }

        .deployShell.sidebarCollapsed .sidebarLink {
          justify-content:center;
          padding:0;
          width:52px;
        }

        .deployShell.sidebarCollapsed .sidebarUser {
          justify-content:center;
          padding:10px;
        }

        @media(max-width:980px){
          .deployShell {
            --sidebar-w: 86px;
          }

          .deploySidebar {
            align-items:center;
          }

          .sidebarBrand span,
          .sidebarLink b,
          .sidebarUser div {
            display:none;
          }

          .sidebarTop {
            flex-direction:column;
          }

          .sidebarLink {
            justify-content:center;
            padding:0;
            width:52px;
          }

          .sidebarUser {
            justify-content:center;
            padding:10px;
          }

          .deployShell .deploy {
            padding-left:22px;
            padding-right:22px;
          }
        }

        @media(max-width:720px){
          .deploySidebar {
            transform:translateX(-100%);
          }

          .deployShell .deploy {
            margin-left:0;
            width:100%;
          }
        }

      
        /* Deploy page shell fix: hide old top menu and force sidebar styling */
        body:has(.deployShell) > header,
        body:has(.deployShell) .topbar,
        body:has(.deployShell) .navbar,
        body:has(.deployShell) .mainNav,
        body:has(.deployShell) nav[aria-label="Principal"],
        body:has(.deployShell) nav[aria-label="principal"],
        body:has(.deployShell) header:has(a[href="/deploy"]) {
          display:none !important;
        }

        body:has(.deployShell) {
          background:#f4f8fb !important;
        }

        .deployShell {
          display:block !important;
          min-height:100vh !important;
          background:#f4f8fb !important;
        }

        .deploySidebar {
          position:fixed !important;
          left:0 !important;
          top:0 !important;
          bottom:0 !important;
          width:280px !important;
          background:#fff !important;
          border-right:1px solid #dfeaf0 !important;
          box-shadow:12px 0 34px rgba(7,59,93,.04) !important;
          z-index:999 !important;
          display:flex !important;
          flex-direction:column !important;
          padding:18px 14px !important;
        }

        .deployShell.sidebarCollapsed .deploySidebar {
          width:86px !important;
        }

        .deployShell .deploy {
          margin-left:280px !important;
          width:calc(100% - 280px) !important;
          max-width:none !important;
        }

        .deployShell.sidebarCollapsed .deploy {
          margin-left:86px !important;
          width:calc(100% - 86px) !important;
        }


        /* Jenkins environment stages: DEV -> QA -> PROD */
        .environmentPipeline {
          margin:18px 0 18px;
          padding:18px;
          border:1px solid #dfeaf0;
          border-radius:18px;
          background:linear-gradient(180deg, #ffffff 0%, #f8fbfd 100%);
        }

        .environmentPipelineHead {
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:16px;
          margin-bottom:18px;
        }

        .environmentPipelineHead h4 {
          margin:3px 0 0;
          color:var(--navy);
          font-size:18px;
          letter-spacing:-.03em;
        }

        .environmentPipelineHead > span {
          display:inline-flex;
          align-items:center;
          justify-content:center;
          min-height:32px;
          padding:7px 12px;
          border-radius:999px;
          background:#e8fff3;
          color:#008f57;
          font-size:12px;
          font-weight:900;
          white-space:nowrap;
        }

        .environmentStageFlow {
          display:grid;
          grid-template-columns:1fr auto 1fr auto 1fr;
          align-items:center;
          gap:0;
        }

        .envStageWrap {
          display:contents;
        }

        .envStage {
          position:relative;
          min-height:96px;
          border:1px solid #dfeaf0;
          border-radius:16px;
          background:#fff;
          box-shadow:0 14px 30px rgba(7,59,93,.05);
          display:grid;
          grid-template-columns:42px 1fr auto;
          align-items:center;
          gap:12px;
          padding:18px 14px 14px;
          overflow:hidden;
        }

        .envStageTopLine {
          position:absolute;
          inset:0 0 auto 0;
          height:4px;
          background:#c8d8e4;
        }

        .envStageIcon {
          width:32px;
          height:32px;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          background:#f2f7fa;
          color:#60748a;
          font-weight:900;
          border:1px solid #dfeaf0;
        }

        .envStageBody {
          display:flex;
          flex-direction:column;
          gap:4px;
          min-width:0;
        }

        .envStageBody b {
          color:var(--navy);
          font-size:16px;
          letter-spacing:-.02em;
        }

        .envStageBody small {
          color:#60748a;
          font-size:12px;
          font-weight:800;
        }

        .envStageBody span {
          color:#60748a;
          font-size:11px;
          font-weight:900;
          text-transform:uppercase;
          letter-spacing:.08em;
        }

        .envStageOpen {
          width:30px;
          height:30px;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          border:1px solid #dfeaf0;
          color:var(--navy);
          background:#fff;
          font-weight:900;
        }

        .envStageConnector {
          height:2px;
          width:42px;
          background:#c8d8e4;
          justify-self:center;
        }

        .envStage.ready .envStageTopLine,
        .envStage.success .envStageTopLine {
          background:#00b86b;
        }

        .envStage.ready {
          border-color:#bbf7d0;
          background:#fbfffd;
        }

        .envStage.ready .envStageIcon,
        .envStage.success .envStageIcon {
          background:#e8fff3;
          color:#008f57;
          border-color:#bbf7d0;
        }

        .envStage.ready .envStageBody span,
        .envStage.success .envStageBody span {
          color:#008f57;
        }

        .envStage.running .envStageTopLine {
          background:#2563eb;
        }

        .envStage.running .envStageIcon {
          background:#eff6ff;
          color:#1d4ed8;
          border-color:#bfdbfe;
        }

        .envStage.running .envStageBody span {
          color:#1d4ed8;
        }

        .envStage.failed .envStageTopLine {
          background:#dc2626;
        }

        .envStage.failed .envStageIcon {
          background:#fff1f2;
          color:#b91c1c;
          border-color:#fecdd3;
        }

        .envStage.failed .envStageBody span {
          color:#b91c1c;
        }

        @media(max-width:920px){
          .environmentStageFlow {
            grid-template-columns:1fr;
            gap:10px;
          }

          .envStageWrap {
            display:block;
          }

          .envStageConnector {
            width:2px;
            height:22px;
            margin:0 auto;
          }

          .environmentPipelineHead {
            flex-direction:column;
          }
        }


        /* Deploy Center spacing + stage layout polish */
        .deploy {
          max-width:none !important;
        }

        .deployShell .deploy {
          margin-left:280px !important;
          width:auto !important;
          min-width:0 !important;
          padding:26px clamp(18px, 2.8vw, 34px) 64px !important;
        }

        .deployShell.sidebarCollapsed .deploy {
          margin-left:86px !important;
          width:auto !important;
        }

        .layout {
          grid-template-columns:minmax(300px, 340px) minmax(0, 1fr) !important;
          gap:24px !important;
          align-items:start !important;
        }

        .content {
          gap:20px !important;
        }

        .queue,
        .content > section,
        .heroCard,
        .state,
        .pipelineCard,
        .conditionsCard,
        .runs {
          border-radius:24px !important;
        }

        .pipelineCard {
          padding:24px !important;
          overflow:hidden !important;
        }

        .pipelineHead {
          gap:22px !important;
          padding-bottom:18px !important;
          margin-bottom:18px !important;
        }

        .pipelineHead p {
          max-width:720px !important;
        }

        .pipelineHeadActions {
          min-width:280px !important;
        }

        .pipelineLink {
          min-height:42px !important;
          padding:10px 18px !important;
        }

        .environmentPipeline {
          margin:0 0 20px !important;
          padding:22px !important;
          border-radius:22px !important;
        }

        .environmentPipelineHead {
          margin-bottom:20px !important;
        }

        .environmentPipelineHead h4 {
          font-size:22px !important;
          line-height:1.1 !important;
        }

        .environmentStageFlow {
          grid-template-columns:minmax(0, 1fr) 56px minmax(0, 1fr) 56px minmax(0, 1fr) !important;
          align-items:stretch !important;
        }

        .envStage {
          min-height:116px !important;
          grid-template-columns:44px minmax(0, 1fr) 32px !important;
          gap:14px !important;
          padding:20px 16px 16px !important;
          border-radius:18px !important;
        }

        .envStageIcon {
          width:36px !important;
          height:36px !important;
          font-size:15px !important;
        }

        .envStageBody b {
          font-size:22px !important;
          line-height:1 !important;
        }

        .envStageBody small {
          font-size:12px !important;
          line-height:1.35 !important;
        }

        .envStageBody span {
          font-size:11px !important;
          line-height:1.2 !important;
        }

        .envStageOpen {
          width:32px !important;
          height:32px !important;
        }

        .envStageConnector {
          width:56px !important;
        }

        .pipelineForm,
        .deployForm {
          grid-template-columns:repeat(2, minmax(240px, 1fr)) !important;
          gap:14px !important;
        }

        .pipelineForm input,
        .pipelineForm select,
        .deployForm input,
        .deployForm select {
          min-height:48px !important;
        }

        .pipelineCard button.primary,
        .pipelineCard .primary {
          min-height:52px !important;
          margin-top:16px !important;
        }

        @media(max-width:1280px){
          .environmentStageFlow {
            grid-template-columns:1fr !important;
            gap:12px !important;
          }

          .envStageWrap {
            display:block !important;
          }

          .envStageConnector {
            width:2px !important;
            height:22px !important;
            margin:0 auto !important;
          }
        }

        @media(max-width:1100px){
          .layout {
            grid-template-columns:1fr !important;
          }

          .deployShell .deploy {
            padding-left:20px !important;
            padding-right:20px !important;
          }
        }

        @media(max-width:860px){
          .pipelineHeadActions {
            min-width:0 !important;
          }

          .environmentPipeline {
            padding:18px !important;
          }

          .environmentPipelineHead {
            flex-direction:column !important;
            align-items:flex-start !important;
          }
        }

        @media(max-width:720px){
          .deployShell .deploy,
          .deployShell.sidebarCollapsed .deploy {
            margin-left:0 !important;
            width:100% !important;
            padding-left:16px !important;
            padding-right:16px !important;
          }
        }


      `}</style>
      </main>
    </div>
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

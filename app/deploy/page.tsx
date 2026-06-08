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

function stageToneLabel(status: string) {
  if (status === 'success') return 'Completado';
  if (status === 'running') return 'En validación';
  if (status === 'failed') return 'Fallido';
  if (status === 'ready') return 'Listo para ejecutar';
  return 'Pendiente';
}

function stageOwner(stage: string) {
  if (stage === 'DEV') return 'DevOps Team';
  if (stage === 'QA') return 'QA / Validación';
  return 'Deployment';
}

function stageAvatar(stage: string) {
  if (stage === 'DEV') return 'DV';
  if (stage === 'QA') return 'QA';
  return 'DP';
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
  const [selectedStage, setSelectedStage] = useState<'DEV' | 'QA' | 'PROD'>('PROD');
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
  const selectedPipelineStage = environmentStages.find((stage) => stage.key === selectedStage) || environmentStages[2] || environmentStages[0];
  const selectedStageRun = selectedPipelineStage?.run;
  const pipelineName = jobName || selected?.title || 'ticketing-efe-pipeline';
  const artifactName = selected?.jira_key || selected?.jira_origin || selected?.title || 'RDC';
  const traceItems = [
    { key: 'RDC', label: 'RDC', value: artifactName, ok: Boolean(selected), icon: '▣' },
    { key: 'CAB', label: 'CAB', value: `${approvedCount(selected)}/${totalApprovals(selected)}`, ok: cabReady, icon: '✓' },
    { key: 'PAP', label: 'PAP', value: papReady ? 'Completo' : 'Pendiente', ok: papReady, icon: '□' },
    { key: 'Jenkins', label: 'Jenkins', value: selectedStageRun?.build_number ? `#${selectedStageRun.build_number}` : 'Pendiente', ok: selectedStageRun?.status === 'SUCCESS', icon: '⚙' },
    { key: 'Cierre', label: 'Cierre', value: selected?.status === 'CERRADO' ? 'Cerrado' : 'Pendiente', ok: selected?.status === 'CERRADO', icon: '⚑' },
  ];
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
      <header className="mockHeader">
        <div>
          <p className="kicker">RELEASE EXECUTION</p>
          <h1>Deploy Center</h1>
          <p className="sub">
            Ejecuta y monitorea pipelines asociados a cambios aprobados, con trazabilidad completa entre RDC, PAP, Jenkins y ambientes.
          </p>
        </div>

        <div className="mockSearchArea">
          <div className="mockSearch">⌕ Buscar...</div>
          <button className="ghostBtn" type="button" onClick={loadJobs}>Actualizar Jobs</button>
          <button className="ghostBtn" type="button" onClick={load}>Actualizar</button>
        </div>
      </header>

      <nav className="deployTabs" aria-label="Vistas del Deploy Center">
        <button type="button"><span>▦</span> Resumen</button>
        <button className="active" type="button"><span>⌘</span> Pipeline</button>
        <button type="button"><span>▶</span> Ejecuciones</button>
        <button type="button"><span>▰</span> Repositorio</button>
      </nav>

      {loading ? <div className="state">Cargando cambios listos para ejecución…</div> : null}
      {error ? <div className="state error">{error}</div> : null}

      {!loading && !error ? (
        <section className="mockLayout">
          <aside className="mockQueue">
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

          <section className="mockContent">
            {selected ? (
              <>
                <section className="pipelineCanvas">
                  <div className="artifactColumn">
                    <h3>Origen / Artefacto</h3>
                    <article className="artifactCard">
                      <span className="artifactIcon">▣</span>
                      <b>{pipelineName}</b>
                      <small>{branchOrTag || `release/${artifactName}`}</small>
                    </article>
                    <p className="artifactSchedule">◷ Schedule<br />not set</p>
                  </div>

                  <div className="stagesColumn">
                    <div className="pipelineTitleRow">
                      <div>
                        <p className="kicker">Pipeline visual</p>
                        <h2>{selected.title}</h2>
                        <small>{selected.system || 'Sin sistema'} · {selected.cell || 'Sin célula'} · {selected.category || 'Sin categoría'}</small>
                      </div>
                      <div className="pipelineActions">
                        <span className={canExecute ? 'readyBadge' : 'blockedBadge'}>{canExecute ? 'Listo para Deploy' : !papReady ? 'Pendiente Plan PAP' : 'No ejecutable todavía'}</span>
                        <a href={`/pap?rdcId=${selected.id}`}>{papReady ? 'Editar Plan PAP →' : 'Ir a Plan PAP →'}</a>
                      </div>
                    </div>

                    <div className="visualPipeline">
                      {environmentStages.map((stage, index) => (
                        <div className="stageWrap" key={stage.key}>
                          <button
                            type="button"
                            className={`mockStage ${stage.status} ${selectedStage === stage.key ? 'selected' : ''}`}
                            onClick={() => setSelectedStage(stage.key as 'DEV' | 'QA' | 'PROD')}
                          >
                            <div className="stageTop">
                              <span className="stageNumber">{index + 1}</span>
                              <b>{stage.title}</b>
                              <span className="stageIcon">{stage.status === 'success' ? '✓' : stage.status === 'failed' ? '!' : stage.status === 'running' ? '◷' : '▶'}</span>
                            </div>

                            <span className={`stagePill ${stage.status}`}>{stageToneLabel(stage.status)}</span>
                            <small>{stage.jobs || 1} job · {stage.tasks || (stage.key === 'PROD' ? 2 : 1)} tasks</small>

                            <div className="stageFoot">
                              <span>▣ {stage.run?.triggered_at ? new Date(stage.run.triggered_at).toLocaleDateString('es-CL') : 'Pendiente'}</span>
                              <span>◉ {stageOwner(stage.key)}</span>
                            </div>
                          </button>

                          {index < environmentStages.length - 1 ? <div className="stageConnector" /> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="mockBelowGrid">
                  <article className="traceCard">
                    <h3>Trazabilidad del cambio</h3>
                    <div className="traceFlow">
                      {traceItems.map((item, index) => (
                        <div className="traceItemWrap" key={item.key}>
                          <div className={item.ok ? 'traceItem ok' : 'traceItem pending'}>
                            <span>{item.icon}</span>
                            <b>{item.label}</b>
                            <small>{item.value}</small>
                            <em>{item.ok ? '✓' : '○'}</em>
                          </div>
                          {index < traceItems.length - 1 ? <div className="traceConnector" /> : null}
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="repoCard">
                    <h3>Repositorio asociado</h3>
                    <div className="repoTree">
                      <b>⌄ ▰ {pipelineName}</b>
                      <span>› 📁 pipelines</span>
                      <span>› 📁 scripts</span>
                      <span>› 📁 manifests</span>
                      <span>□ README.md</span>
                    </div>
                  </article>
                </section>

                <section className="pipelineConfigCard">
                  <div className="configHead">
                    <div>
                      <p className="kicker">Jenkins Pipeline</p>
                      <h3>Ejecutar despliegue</h3>
                      <p>La ejecución queda asociada al RDC, usuario ejecutor, parámetros y resultado.</p>
                    </div>
                    {pipelineUrl ? <a className="pipelineLink" href={pipelineUrl} target="_blank" rel="noreferrer">Abrir pipeline Jenkins ↗</a> : null}
                  </div>

                  {jobsWarning ? <div className="jobsWarning">{jobsWarning}</div> : null}

                  <div className="deployForm">
                    <label>
                      <span>Job Jenkins</span>
                      <select value={jobName} onChange={(e) => setJobName(e.target.value)} disabled={jobsLoading}>
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
                      <span>Ambiente</span>
                      <select value={environment} onChange={(e) => setEnvironment(e.target.value)}>
                        <option>Producción</option>
                        <option>QA</option>
                        <option>DEV</option>
                        <option>Staging</option>
                      </select>
                    </label>

                    <label>
                      <span>Versión</span>
                      <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v1.0.0 / PAP-123" />
                    </label>

                    <label>
                      <span>Rama / Tag</span>
                      <input value={branchOrTag} onChange={(e) => setBranchOrTag(e.target.value)} placeholder="release/v1.0.0" />
                    </label>

                    <label>
                      <span>Job manual, si no aparece en el listado</span>
                      <input value={jobName} onChange={(e) => setJobName(e.target.value)} placeholder="Nombre exacto del job Jenkins" />
                    </label>
                  </div>

                  <button className="primary" type="button" disabled={!canExecute || triggering} onClick={requestPipelineExecution}>
                    {triggering ? 'Enviando a Jenkins…' : canExecute ? 'Ejecutar despliegue' : 'Valida condiciones antes de ejecutar'}
                  </button>
                  <p className="deployHint">Solo disponible para cambios aprobados por CAB, con Plan PAP validado y rol autorizado.</p>
                </section>

                <aside className="stageInspector">
                  <div className="inspectorInner">
                    <h3>Detalle del stage: <span>{selectedPipelineStage?.title || 'PROD'}</span></h3>
                    <dl>
                      <div><dt>Job Jenkins</dt><dd>{pipelineName}</dd></div>
                      <div><dt>Ambiente</dt><dd>{normalizeEnvironment(environment) === 'PROD' ? 'Producción' : normalizeEnvironment(environment)}</dd></div>
                      <div><dt>Versión</dt><dd>{version || 'v1.0.0'}</dd></div>
                      <div><dt>Rama/Tag</dt><dd>{branchOrTag || 'release/PAP-DEMO-001'}</dd></div>
                      <div><dt>Última ejecución</dt><dd>{selectedStageRun?.triggered_at ? new Date(selectedStageRun.triggered_at).toLocaleString('es-CL') : '—'}</dd></div>
                      <div><dt>Responsable</dt><dd><span className="avatarSmall">{stageAvatar(selectedPipelineStage?.key || 'PROD')}</span> {stageOwner(selectedPipelineStage?.key || 'PROD')}</dd></div>
                    </dl>

                    {pipelineUrl ? <a className="blueAction" href={pipelineUrl} target="_blank" rel="noreferrer">Abrir pipeline Jenkins</a> : null}
                    <button className="greenAction" type="button" onClick={requestPipelineExecution} disabled={!canExecute || triggering}>▶ Ejecutar despliegue</button>
                  </div>
                </aside>

                <section className="executionTableCard">
                  <div className="tableHead">
                    <h3>Historial de ejecuciones</h3>
                    <button type="button" onClick={load}>Ver todas →</button>
                  </div>

                  <table>
                    <thead>
                      <tr>
                        <th>Ejecución</th>
                        <th>Pipeline</th>
                        <th>Ambiente</th>
                        <th>Estado</th>
                        <th>Inicio</th>
                        <th>Responsable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selected.deployment_runs || []).slice(0, 5).map((run) => (
                        <tr key={run.id}>
                          <td>#{run.build_number || run.id.slice(0, 6)}</td>
                          <td>{run.job_name}</td>
                          <td>{run.environment}</td>
                          <td><span className={`runBadge ${run.result === 'FAILURE' || run.status === 'FAILED_TO_TRIGGER' ? 'fail' : run.status === 'SUCCESS' ? 'ok' : 'info'}`}>{STATUS_LABEL[run.status] || run.status}</span></td>
                          <td>{run.triggered_at ? new Date(run.triggered_at).toLocaleString('es-CL') : '—'}</td>
                          <td>{run.triggered_by || 'Sistema'}</td>
                        </tr>
                      ))}
                      {(!selected.deployment_runs || selected.deployment_runs.length === 0) ? (
                        <tr><td colSpan={6}>Aún no hay ejecuciones registradas para este cambio.</td></tr>
                      ) : null}
                    </tbody>
                  </table>
                </section>


                {message ? <div className="msg">{message}</div> : null}

              </>
            ) : (
              <div className="state">Selecciona un cambio listo para ejecución.</div>
            )}
          </section>
        </section>
      ) : null}

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


        /* Deploy Center responsive tuning */
        @media(max-width:1680px){
          .layout {
            grid-template-columns:minmax(300px, 330px) minmax(0, 1fr) !important;
            gap:20px !important;
          }

          .heroCard h2 {
            font-size:clamp(34px, 3vw, 52px) !important;
          }
        }

        @media(max-width:1440px){
          .deploy {
            padding:24px clamp(16px, 2.2vw, 24px) 56px !important;
          }

          .layout {
            grid-template-columns:1fr !important;
          }

          .queue {
            order:1 !important;
          }

          .content {
            order:2 !important;
          }

          .queueList {
            grid-template-columns:repeat(2, minmax(0, 1fr)) !important;
          }

          .heroCard {
            flex-direction:column !important;
          }

          .heroActions {
            width:100% !important;
            flex-direction:row !important;
            flex-wrap:wrap !important;
            justify-content:flex-start !important;
            align-items:center !important;
          }

          .summaryGrid {
            grid-template-columns:repeat(2, minmax(0, 1fr)) !important;
          }

          .pipelineHead {
            flex-direction:column !important;
            align-items:flex-start !important;
          }

          .pipelineHeadActions {
            width:100% !important;
            align-items:flex-start !important;
          }

          .stageFlow {
            flex-wrap:wrap !important;
          }
        }

        @media(max-width:1180px){
          .queueList {
            grid-template-columns:1fr !important;
          }

          .deployForm {
            grid-template-columns:1fr !important;
          }

          .conditions {
            grid-template-columns:1fr !important;
          }

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

        @media(max-width:900px){
          .deploy {
            padding:18px 14px 44px !important;
          }

          .head,
          .heroCard,
          .pipelineHead,
          .conditionsHead,
          .blockReasonBox {
            flex-direction:column !important;
            align-items:flex-start !important;
          }

          .headActions,
          .heroActions {
            width:100% !important;
            justify-content:flex-start !important;
          }

          .heroActions a,
          .headActions button,
          .headActions a,
          .pipelineLink {
            width:100% !important;
            text-align:center !important;
          }

          .summaryGrid {
            grid-template-columns:1fr !important;
          }

          .queue,
          .heroCard,
          .pipelineCard,
          .conditionsCard,
          .runs,
          .state {
            border-radius:20px !important;
          }

          .run {
            grid-template-columns:1fr !important;
          }
        }

        @media(max-width:640px){
          .deploy {
            padding:16px 12px 40px !important;
          }

          h1 {
            font-size:clamp(30px, 12vw, 46px) !important;
          }

          .queueHead h2,
          .heroCard h2 {
            font-size:clamp(26px, 8vw, 36px) !important;
          }
        }


        /* Deploy Center overflow + spacing fix */
        .deployShell,
        .deployShell .deploy,
        .layout,
        .content,
        .queue,
        .head,
        .heroCard,
        .summaryGrid,
        .pipelineCard,
        .conditionsCard,
        .runs,
        .run,
        .environmentPipeline,
        .environmentStageFlow {
          min-width:0 !important;
          box-sizing:border-box !important;
        }

        .deployShell {
          overflow-x:hidden !important;
        }

        .deployShell .deploy {
          width:auto !important;
          max-width:none !important;
          margin-left:280px !important;
          padding:24px clamp(18px, 2.2vw, 30px) 56px !important;
          overflow-x:hidden !important;
        }

        .deployShell.sidebarCollapsed .deploy {
          width:auto !important;
          margin-left:86px !important;
        }

        .layout {
          grid-template-columns:minmax(290px, 320px) minmax(0, 1fr) !important;
          gap:18px !important;
        }

        .queue {
          overflow:hidden !important;
        }

        .queueList {
          display:grid !important;
          grid-template-columns:1fr !important;
          gap:12px !important;
        }

        .queueItem {
          width:100% !important;
          min-width:0 !important;
        }

        .heroCard,
        .pipelineCard,
        .conditionsCard,
        .runs,
        .queue,
        .content > section {
          width:100% !important;
        }

        @media (max-width: 1280px) {
          .deployShell .deploy {
            padding:22px 20px 52px !important;
          }

          .layout {
            grid-template-columns:1fr !important;
          }
        }

        @media (max-width: 720px) {
          .deployShell .deploy,
          .deployShell.sidebarCollapsed .deploy {
            margin-left:0 !important;
            width:100% !important;
            padding:18px 14px 42px !important;
          }
        }


        /* Final fix: remove duplicated left offset inside Deploy Center */
        .deployShell .deploy,
        .deployShell.sidebarCollapsed .deploy {
          margin-left:0 !important;
          width:100% !important;
          max-width:none !important;
          padding-left:clamp(18px, 2vw, 28px) !important;
          padding-right:clamp(18px, 2vw, 28px) !important;
          box-sizing:border-box !important;
          overflow-x:hidden !important;
        }

        .deploy {
          margin:0 !important;
          max-width:none !important;
        }

        .deployShell {
          width:100% !important;
          overflow-x:hidden !important;
        }

        .layout {
          grid-template-columns:minmax(280px, 330px) minmax(0, 1fr) !important;
          gap:20px !important;
          width:100% !important;
          min-width:0 !important;
        }

        .queue,
        .content,
        .content > section,
        .heroCard,
        .pipelineCard,
        .conditionsCard,
        .runs {
          min-width:0 !important;
          max-width:100% !important;
          box-sizing:border-box !important;
        }

        .queueList {
          grid-template-columns:1fr !important;
        }

        @media(max-width:1280px){
          .layout {
            grid-template-columns:1fr !important;
          }

          .queueList {
            grid-template-columns:repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media(max-width:820px){
          .queueList {
            grid-template-columns:1fr !important;
          }

          .deployShell .deploy,
          .deployShell.sidebarCollapsed .deploy {
            padding-left:14px !important;
            padding-right:14px !important;
          }
        }


        /* Deploy Center visual polish: selected change, queue, metrics and env pipeline */
        .layout {
          grid-template-columns:minmax(300px, 340px) minmax(0, 1fr) !important;
          gap:22px !important;
          align-items:start !important;
        }

        .queue {
          padding:22px !important;
          position:sticky !important;
          top:22px !important;
        }

        .queueHead {
          margin-bottom:16px !important;
        }

        .queueHead h2 {
          font-size:clamp(22px, 1.6vw, 28px) !important;
          letter-spacing:-.04em !important;
        }

        .queueItem {
          padding:17px 18px !important;
          border-radius:18px !important;
          min-height:118px !important;
          display:flex !important;
          flex-direction:column !important;
          justify-content:center !important;
          gap:7px !important;
        }

        .queueItem strong {
          font-size:15px !important;
          line-height:1.25 !important;
          letter-spacing:-.02em !important;
        }

        .queueItem small {
          font-size:12px !important;
          line-height:1.2 !important;
        }

        .queueItem em {
          font-size:12px !important;
          line-height:1.2 !important;
        }

        .heroCard h2 {
          font-size:clamp(32px, 3.1vw, 52px) !important;
          line-height:1.04 !important;
          letter-spacing:-.055em !important;
          max-width:860px !important;
        }

        .heroCard {
          align-items:center !important;
          padding:28px 30px !important;
        }

        .heroActions {
          gap:10px !important;
          align-items:flex-end !important;
        }

        .readyBadge {
          padding:11px 18px !important;
          font-size:14px !important;
        }

        .summaryGrid {
          gap:14px !important;
        }

        .summaryGrid div {
          min-height:86px !important;
          padding:17px 20px !important;
          border-radius:18px !important;
          display:flex !important;
          flex-direction:column !important;
          justify-content:center !important;
        }

        .summaryGrid small {
          margin-bottom:5px !important;
          font-size:12px !important;
        }

        .summaryGrid strong {
          font-size:22px !important;
          line-height:1.1 !important;
          letter-spacing:-.025em !important;
        }

        .conditionsCard {
          padding:22px !important;
        }

        .environmentPipeline {
          border-radius:24px !important;
          padding:22px !important;
          background:
            radial-gradient(circle at top left, rgba(0,184,107,.10), transparent 38%),
            linear-gradient(180deg, #ffffff 0%, #f8fbfd 100%) !important;
          border:1px solid #d8e8f0 !important;
        }

        .environmentPipelineHead {
          align-items:center !important;
          margin-bottom:22px !important;
        }

        .environmentPipelineHead h4 {
          font-size:clamp(20px, 1.8vw, 26px) !important;
          letter-spacing:-.045em !important;
        }

        .environmentPipelineHead > span {
          min-height:34px !important;
          padding:8px 14px !important;
          box-shadow:0 8px 18px rgba(0,184,107,.08) !important;
        }

        .environmentStageFlow {
          grid-template-columns:minmax(0, 1fr) 48px minmax(0, 1fr) 48px minmax(0, 1fr) !important;
        }

        .envStage {
          min-height:108px !important;
          padding:18px 16px 15px !important;
          border-radius:20px !important;
          box-shadow:0 14px 34px rgba(7,59,93,.06) !important;
        }

        .envStageTopLine {
          height:5px !important;
        }

        .envStageBody b {
          font-size:20px !important;
          letter-spacing:-.035em !important;
        }

        .envStageBody small {
          font-size:12px !important;
          font-weight:850 !important;
        }

        .envStageBody span {
          margin-top:1px !important;
        }

        .envStageConnector {
          position:relative !important;
          width:48px !important;
          height:2px !important;
          background:linear-gradient(90deg, #c8d8e4, #9fb8cc) !important;
        }

        .envStageConnector::after {
          content:'';
          position:absolute;
          right:-2px;
          top:50%;
          width:7px;
          height:7px;
          border-right:2px solid #9fb8cc;
          border-top:2px solid #9fb8cc;
          transform:translateY(-50%) rotate(45deg);
        }

        .envStage.ready,
        .envStage.success {
          box-shadow:0 16px 38px rgba(0,184,107,.10) !important;
        }

        .envStage.failed {
          box-shadow:0 16px 38px rgba(220,38,38,.09) !important;
        }

        .pipelineCard {
          padding:26px !important;
        }

        @media(max-width:1320px){
          .layout {
            grid-template-columns:1fr !important;
          }

          .queue {
            position:relative !important;
            top:auto !important;
          }

          .queueList {
            grid-template-columns:repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media(max-width:980px){
          .heroCard {
            padding:24px !important;
          }

          .heroCard h2 {
            font-size:clamp(30px, 7vw, 44px) !important;
          }

          .summaryGrid {
            grid-template-columns:1fr 1fr !important;
          }

          .environmentStageFlow {
            grid-template-columns:1fr !important;
            gap:10px !important;
          }

          .envStageWrap {
            display:block !important;
          }

          .envStageConnector {
            width:2px !important;
            height:22px !important;
            margin:0 auto !important;
          }

          .envStageConnector::after {
            right:auto;
            left:50%;
            top:auto;
            bottom:-2px;
            transform:translateX(-50%) rotate(135deg);
          }
        }

        @media(max-width:720px){
          .queueList,
          .summaryGrid {
            grid-template-columns:1fr !important;
          }

          .heroCard,
          .pipelineCard,
          .conditionsCard,
          .runs,
          .queue {
            padding:20px !important;
          }

          .summaryGrid div {
            min-height:76px !important;
          }
        }


        /* Deploy Center final alignment fix (desktop 100% zoom + responsive) */
        .deploy {
          max-width:none !important;
          width:100% !important;
          padding:24px 28px 60px !important;
          box-sizing:border-box !important;
        }

        .head {
          gap:24px !important;
          margin-bottom:20px !important;
        }

        .headActions {
          flex-shrink:0 !important;
        }

        .layout {
          display:grid !important;
          grid-template-columns:minmax(310px, 360px) minmax(0, 1fr) !important;
          gap:22px !important;
          align-items:start !important;
        }

        .queue {
          position:sticky !important;
          top:24px !important;
          align-self:start !important;
          padding:22px !important;
        }

        .queueHead h2 {
          font-size:clamp(24px, 1.8vw, 34px) !important;
          line-height:1.06 !important;
        }

        .queueList {
          display:grid !important;
          grid-template-columns:1fr !important;
          gap:12px !important;
        }

        .queueItem {
          min-height:118px !important;
          padding:18px 18px 16px !important;
          display:flex !important;
          flex-direction:column !important;
          justify-content:center !important;
          gap:6px !important;
        }

        .queueItem strong {
          font-size:14px !important;
          line-height:1.22 !important;
        }

        .content {
          min-width:0 !important;
          display:grid !important;
          gap:18px !important;
        }

        .content > * {
          min-width:0 !important;
        }

        .heroCard {
          display:grid !important;
          grid-template-columns:minmax(0, 1fr) auto !important;
          align-items:start !important;
          gap:20px !important;
          padding:24px 26px !important;
        }

        .heroCard h2 {
          font-size:clamp(30px, 3.2vw, 52px) !important;
          line-height:1.05 !important;
          letter-spacing:-.05em !important;
          max-width:14ch !important;
          word-break:break-word !important;
          margin-bottom:10px !important;
        }

        .heroCard p {
          max-width:900px !important;
        }

        .heroActions {
          align-items:flex-end !important;
          gap:10px !important;
        }

        .heroActions a,
        .readyBadge,
        .blockedBadge {
          min-height:44px !important;
          display:inline-flex !important;
          align-items:center !important;
          justify-content:center !important;
        }

        .summaryGrid {
          display:grid !important;
          grid-template-columns:repeat(4, minmax(0, 1fr)) !important;
          gap:14px !important;
        }

        .summaryGrid div {
          min-height:92px !important;
          padding:18px 20px !important;
          display:flex !important;
          flex-direction:column !important;
          justify-content:center !important;
        }

        .summaryGrid b {
          font-size:22px !important;
          line-height:1.12 !important;
          letter-spacing:-.03em !important;
        }

        .conditionsCard,
        .pipelineCard,
        .runs {
          padding:22px !important;
        }

        .environmentPipeline {
          margin:18px 0 16px !important;
          padding:22px !important;
          border-radius:22px !important;
          overflow:hidden !important;
          background:radial-gradient(circle at left top, rgba(0,184,107,.08), transparent 35%), linear-gradient(180deg, #ffffff 0%, #f8fbfd 100%) !important;
        }

        .environmentPipelineHead {
          align-items:center !important;
          gap:16px !important;
          margin-bottom:22px !important;
        }

        .environmentPipelineHead h4 {
          font-size:clamp(22px, 2vw, 32px) !important;
          line-height:1.08 !important;
          letter-spacing:-.04em !important;
        }

        .environmentStageFlow {
          display:grid !important;
          grid-template-columns:minmax(0, 1fr) 42px minmax(0, 1fr) 42px minmax(0, 1fr) !important;
          align-items:stretch !important;
          gap:0 !important;
        }

        .envStageWrap {
          display:contents !important;
        }

        .envStage {
          min-width:0 !important;
          min-height:126px !important;
          border-radius:20px !important;
          display:grid !important;
          grid-template-columns:44px minmax(0, 1fr) 36px !important;
          align-items:center !important;
          gap:14px !important;
          padding:18px 18px 16px !important;
          box-shadow:0 14px 32px rgba(7,59,93,.05) !important;
        }

        .envStageBody {
          min-width:0 !important;
        }

        .envStageBody b {
          font-size:18px !important;
          line-height:1.08 !important;
          letter-spacing:-.03em !important;
        }

        .envStageBody small {
          font-size:12px !important;
          line-height:1.25 !important;
        }

        .envStageBody span {
          font-size:12px !important;
          line-height:1.2 !important;
        }

        .envStageConnector {
          width:42px !important;
          height:2px !important;
          align-self:center !important;
          justify-self:center !important;
          position:relative !important;
          background:linear-gradient(90deg, #c8d8e4, #9fb8cc) !important;
        }

        .envStageConnector::after {
          content:'' !important;
          position:absolute !important;
          right:-1px !important;
          top:50% !important;
          width:8px !important;
          height:8px !important;
          border-right:2px solid #9fb8cc !important;
          border-top:2px solid #9fb8cc !important;
          transform:translateY(-50%) rotate(45deg) !important;
        }

        .deployForm {
          display:grid !important;
          grid-template-columns:repeat(2, minmax(0, 1fr)) !important;
          gap:16px 18px !important;
        }

        .deployForm label {
          min-width:0 !important;
        }

        .deployForm label:nth-child(5) {
          grid-column:1 / -1 !important;
        }

        .pipelineCard .primaryAction,
        .pipelineCard .primaryBtn,
        .pipelineCard .executeBtn,
        .pipelineCard button[type="submit"],
        .pipelineCard button[type="button"].primary {
          width:100% !important;
        }

        @media (max-width: 1500px) {
          .deploy {
            padding:22px 20px 56px !important;
          }

          .layout {
            grid-template-columns:minmax(290px, 340px) minmax(0, 1fr) !important;
            gap:18px !important;
          }

          .heroCard h2 {
            font-size:clamp(28px, 3vw, 46px) !important;
            max-width:12ch !important;
          }
        }

        @media (max-width: 1180px) {
          .layout {
            grid-template-columns:1fr !important;
          }

          .queue {
            position:relative !important;
            top:auto !important;
          }

          .queueList {
            grid-template-columns:repeat(2, minmax(0, 1fr)) !important;
          }

          .heroCard {
            grid-template-columns:1fr !important;
          }

          .heroActions {
            align-items:flex-start !important;
            flex-direction:row !important;
            flex-wrap:wrap !important;
          }
        }

        @media (max-width: 920px) {
          .summaryGrid,
          .deployForm,
          .conditions {
            grid-template-columns:1fr 1fr !important;
          }

          .environmentStageFlow {
            grid-template-columns:1fr !important;
            gap:12px !important;
          }

          .envStageWrap {
            display:block !important;
          }

          .envStageConnector {
            width:2px !important;
            height:24px !important;
            margin:0 auto !important;
          }

          .envStageConnector::after {
            right:auto !important;
            left:50% !important;
            top:auto !important;
            bottom:-2px !important;
            transform:translateX(-50%) rotate(135deg) !important;
          }
        }

        @media (max-width: 720px) {
          .deploy {
            padding:18px 14px 42px !important;
          }

          .head {
            flex-direction:column !important;
            align-items:flex-start !important;
          }

          .headActions {
            width:100% !important;
          }

          .headActions .ghostBtn {
            flex:1 1 auto !important;
          }

          .queueList,
          .summaryGrid,
          .deployForm,
          .conditions {
            grid-template-columns:1fr !important;
          }

          .heroCard,
          .conditionsCard,
          .pipelineCard,
          .runs,
          .queue {
            padding:18px !important;
          }

          .heroCard h2 {
            max-width:none !important;
            font-size:clamp(28px, 8vw, 40px) !important;
          }

          .summaryGrid div,
          .envStage {
            min-height:auto !important;
          }
        }


        /* Fix quirúrgico: Cambio seleccionado + métricas */
        .heroCard {
          display:grid !important;
          grid-template-columns:minmax(0, 1fr) auto !important;
          align-items:start !important;
          gap:24px !important;
          padding:26px 28px !important;
        }

        .heroCard > div:first-child {
          min-width:0 !important;
          max-width:100% !important;
        }

        .heroCard h2 {
          max-width:100% !important;
          width:100% !important;
          font-size:clamp(30px, 2.7vw, 46px) !important;
          line-height:1.08 !important;
          letter-spacing:-.045em !important;
          word-break:normal !important;
          overflow-wrap:break-word !important;
          hyphens:none !important;
          margin:0 0 12px !important;
        }

        .heroCard p {
          font-size:17px !important;
          line-height:1.35 !important;
          max-width:100% !important;
        }

        .heroActions {
          display:flex !important;
          flex-direction:row !important;
          flex-wrap:wrap !important;
          align-items:flex-start !important;
          justify-content:flex-end !important;
          gap:10px !important;
          min-width:330px !important;
          max-width:390px !important;
        }

        .heroActions .readyBadge,
        .heroActions .blockedBadge,
        .heroActions a {
          min-height:44px !important;
          padding:11px 18px !important;
          border-radius:999px !important;
          white-space:nowrap !important;
          flex:0 0 auto !important;
        }

        .summaryGrid {
          display:grid !important;
          grid-template-columns:repeat(4, minmax(0, 1fr)) !important;
          gap:14px !important;
          width:100% !important;
        }

        .summaryGrid div {
          min-width:0 !important;
          min-height:88px !important;
          padding:18px 20px !important;
          border-radius:18px !important;
        }

        .summaryGrid span {
          font-size:12px !important;
          line-height:1.15 !important;
          margin-bottom:8px !important;
        }

        .summaryGrid b,
        .summaryGrid strong {
          display:block !important;
          font-size:clamp(20px, 1.55vw, 26px) !important;
          line-height:1.1 !important;
          letter-spacing:-.03em !important;
          word-break:normal !important;
          overflow-wrap:break-word !important;
          hyphens:none !important;
        }

        @media(max-width:1380px){
          .heroCard {
            grid-template-columns:1fr !important;
          }

          .heroActions {
            min-width:0 !important;
            max-width:100% !important;
            justify-content:flex-start !important;
          }

          .heroCard h2 {
            font-size:clamp(30px, 3.6vw, 44px) !important;
          }
        }

        @media(max-width:980px){
          .summaryGrid {
            grid-template-columns:repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media(max-width:640px){
          .heroCard {
            padding:20px !important;
          }

          .heroCard h2 {
            font-size:clamp(28px, 8vw, 38px) !important;
          }

          .heroActions {
            flex-direction:column !important;
            align-items:stretch !important;
          }

          .heroActions .readyBadge,
          .heroActions .blockedBadge,
          .heroActions a {
            width:100% !important;
            justify-content:center !important;
          }

          .summaryGrid {
            grid-template-columns:1fr !important;
          }
        }


        /* Azure DevOps inspired Deploy Center mockup */
        .deploy { max-width:none !important; width:100% !important; padding:24px 28px 60px !important; box-sizing:border-box !important; }
        .mockHeader { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; margin-bottom:18px; padding-bottom:18px; border-bottom:1px solid #dfeaf0; }
        .mockHeader h1 { margin:0; color:var(--navy-d); font-size:clamp(34px, 3.5vw, 54px); line-height:.98; letter-spacing:-.06em; }
        .mockSearchArea { display:flex; align-items:center; justify-content:flex-end; gap:10px; flex-wrap:wrap; min-width:380px; }
        .mockSearch { min-width:230px; height:42px; border:1px solid #dfeaf0; border-radius:10px; background:#fff; color:#60748a; display:flex; align-items:center; padding:0 14px; font-weight:700; }
        .deployTabs { display:flex; align-items:center; gap:18px; border-bottom:1px solid #dfeaf0; margin-bottom:18px; overflow:auto; }
        .deployTabs button { border:0; background:transparent; color:#36556f; font-weight:850; padding:14px 4px; border-bottom:3px solid transparent; cursor:pointer; display:flex; align-items:center; gap:8px; white-space:nowrap; }
        .deployTabs button.active { color:#0b67d8; border-bottom-color:#0b67d8; }
        .mockLayout { display:grid; grid-template-columns:minmax(290px, 330px) minmax(0, 1fr); gap:20px; align-items:start; }
        .mockQueue, .pipelineCanvas, .traceCard, .repoCard, .pipelineConfigCard, .stageInspector, .executionTableCard { background:#fff; border:1px solid #dfeaf0; border-radius:22px; box-shadow:0 18px 45px rgba(7,59,93,.06); }
        .mockQueue { padding:22px; position:sticky; top:22px; }
        .mockContent { display:grid; grid-template-columns:minmax(0, 1fr) 320px; gap:18px; align-items:start; min-width:0; }
        .pipelineCanvas { grid-column:1 / 2; display:grid; grid-template-columns:250px minmax(0, 1fr); gap:22px; min-height:290px; padding:22px; position:relative; }
        .artifactColumn { border-right:1px dashed #c8d8e4; padding-right:20px; }
        .artifactColumn h3, .traceCard h3, .repoCard h3, .executionTableCard h3, .stageInspector h3 { margin:0 0 16px; color:var(--navy-d); letter-spacing:-.03em; }
        .artifactCard { min-height:104px; border:1px solid #dfeaf0; border-radius:12px; background:#fff; box-shadow:0 12px 24px rgba(7,59,93,.08); padding:16px; display:flex; flex-direction:column; gap:8px; }
        .artifactIcon { width:28px; height:28px; border-radius:8px; background:#eef5f8; display:inline-flex; align-items:center; justify-content:center; }
        .artifactCard b { color:var(--navy-d); }
        .artifactCard small, .artifactSchedule { color:#60748a; }
        .artifactSchedule { margin:18px 0 0; font-weight:700; }
        .pipelineTitleRow { display:flex; justify-content:space-between; gap:18px; margin-bottom:24px; }
        .pipelineTitleRow h2 { margin:0 0 8px; color:var(--navy-d); font-size:clamp(22px, 2vw, 34px); line-height:1.06; letter-spacing:-.045em; }
        .pipelineTitleRow small { color:#60748a; font-size:15px; }
        .pipelineActions { display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; align-content:flex-start; min-width:280px; }
        .visualPipeline { display:grid; grid-template-columns:minmax(0,1fr) 38px minmax(0,1fr) 38px minmax(0,1fr); align-items:stretch; }
        .stageWrap { display:contents; }
        .mockStage { border:1px solid #dfeaf0; border-top:5px solid #c8d8e4; border-radius:14px; background:#fff; min-height:178px; padding:18px; text-align:left; box-shadow:0 15px 30px rgba(7,59,93,.06); cursor:pointer; display:flex; flex-direction:column; gap:12px; }
        .mockStage.selected { border-color:#0b67d8; border-top-color:#0b67d8; box-shadow:0 16px 38px rgba(11,103,216,.16); }
        .mockStage.success { border-top-color:#16a34a; }
        .mockStage.failed { border-top-color:#dc2626; }
        .stageTop { display:flex; align-items:center; gap:10px; }
        .stageTop b { color:var(--navy-d); font-size:20px; }
        .stageNumber, .stageIcon { width:32px; height:32px; border-radius:999px; display:inline-flex; align-items:center; justify-content:center; font-weight:900; }
        .stageNumber { color:#fff; background:#0b67d8; }
        .mockStage.success .stageNumber { background:#16a34a; }
        .mockStage.failed .stageNumber { background:#dc2626; }
        .stageIcon { margin-left:auto; background:#eef5f8; color:#0b67d8; border:1px solid #dfeaf0; }
        .stagePill { width:max-content; max-width:100%; border-radius:10px; padding:7px 12px; font-size:12px; font-weight:900; }
        .stagePill.success { background:#dcfce7; color:#15803d; }
        .stagePill.running, .stagePill.ready { background:#dbeafe; color:#1d4ed8; }
        .stagePill.failed { background:#fee2e2; color:#b91c1c; }
        .stagePill.pending { background:#eef5f8; color:#60748a; }
        .mockStage small { color:#36556f; font-weight:750; }
        .stageFoot { margin-top:auto; padding-top:12px; border-top:1px solid #edf3f7; display:flex; justify-content:space-between; gap:10px; color:#60748a; font-size:12px; font-weight:750; }
        .stageConnector { width:38px; height:2px; align-self:center; background:#7c8b99; position:relative; }
        .stageConnector::after { content:''; position:absolute; right:-1px; top:50%; width:7px; height:7px; border-top:2px solid #7c8b99; border-right:2px solid #7c8b99; transform:translateY(-50%) rotate(45deg); }
        .mockBelowGrid { grid-column:1 / 2; display:grid; grid-template-columns:minmax(0, 1fr) minmax(300px, .72fr); gap:18px; }
        .traceCard, .repoCard, .pipelineConfigCard, .executionTableCard, .stageInspector { padding:22px; }
        .traceFlow { display:grid; grid-template-columns:1fr 26px 1fr 26px 1fr 26px 1fr 26px 1fr; align-items:center; }
        .traceItemWrap { display:contents; }
        .traceItem { min-height:112px; border:1px solid #dfeaf0; border-radius:14px; background:#f8fbfd; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:7px; text-align:center; }
        .traceItem.ok { background:#f0fff7; border-color:#bbf7d0; }
        .traceItem span { width:40px; height:40px; border-radius:12px; background:#e7f9ef; display:inline-flex; align-items:center; justify-content:center; }
        .traceItem b { color:var(--navy-d); }
        .traceItem small { color:#60748a; font-size:12px; }
        .traceItem em { font-style:normal; color:#00a86b; font-weight:900; }
        .traceConnector { height:2px; border-top:2px dotted #9fb8cc; }
        .repoTree { display:flex; flex-direction:column; gap:10px; color:#36556f; font-weight:750; }
        .repoTree b { color:var(--navy-d); }
        .pipelineConfigCard { grid-column:1 / 2; }
        .configHead { display:flex; justify-content:space-between; gap:18px; margin-bottom:16px; }
        .configHead h3 { margin:0 0 6px; color:var(--navy-d); letter-spacing:-.03em; }
        .configHead p { margin:0; color:#60748a; }
        .deployForm { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:14px; }
        .deployForm label:nth-child(5) { grid-column:1 / -1; }
        .deployHint { color:#60748a; margin:10px 0 0; font-size:13px; }
        .stageInspector { grid-column:2 / 3; grid-row:1 / span 3; position:sticky; top:22px; }
        .stageInspector h3 span { color:#0b67d8; }
        .stageInspector dl { margin:0; display:grid; gap:14px; }
        .stageInspector dl div { display:grid; grid-template-columns:120px minmax(0, 1fr); gap:12px; align-items:center; }
        .stageInspector dt { color:#60748a; font-weight:850; }
        .stageInspector dd { margin:0; color:var(--navy-d); font-weight:800; word-break:break-word; }
        .avatarSmall { width:30px; height:30px; border-radius:999px; background:#16a34a; color:#fff; display:inline-flex; align-items:center; justify-content:center; font-size:12px; margin-right:8px; }
        .blueAction, .greenAction { margin-top:16px; min-height:50px; width:100%; border-radius:10px; display:flex; align-items:center; justify-content:center; font-weight:900; border:0; text-decoration:none; }
        .blueAction { background:#0b67d8; color:#fff; }
        .greenAction { background:#16a34a; color:#fff; }
        .greenAction:disabled { opacity:.45; cursor:not-allowed; }
        .executionTableCard { grid-column:1 / -1; overflow:auto; }
        .tableHead { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px; }
        .tableHead button { border:0; background:transparent; color:#0b67d8; font-weight:900; cursor:pointer; }
        .executionTableCard table { width:100%; border-collapse:collapse; min-width:760px; }
        .executionTableCard th, .executionTableCard td { padding:13px 14px; text-align:left; border-bottom:1px solid #edf3f7; color:#36556f; }
        .executionTableCard th { font-size:12px; color:#60748a; text-transform:uppercase; letter-spacing:.08em; }
        .runBadge { display:inline-flex; align-items:center; padding:7px 12px; border-radius:999px; font-weight:900; font-size:12px; }
        .runBadge.ok { background:#dcfce7; color:#15803d; }
        .runBadge.fail { background:#fee2e2; color:#b91c1c; }
        .runBadge.info { background:#dbeafe; color:#1d4ed8; }
        @media(max-width:1420px){ .mockContent { grid-template-columns:1fr; } .stageInspector { grid-column:1; grid-row:auto; position:relative; top:auto; } }
        @media(max-width:1180px){ .mockLayout { grid-template-columns:1fr; } .mockQueue { position:relative; top:auto; } .queueList { grid-template-columns:repeat(2, minmax(0, 1fr)); } .pipelineCanvas, .mockBelowGrid { grid-template-columns:1fr; } .artifactColumn { border-right:0; border-bottom:1px dashed #c8d8e4; padding:0 0 18px; } }
        @media(max-width:920px){ .mockHeader, .pipelineTitleRow, .configHead { flex-direction:column; } .mockSearchArea, .pipelineActions { min-width:0; justify-content:flex-start; } .visualPipeline, .traceFlow { grid-template-columns:1fr; gap:12px; } .stageWrap, .traceItemWrap { display:block; } .stageConnector, .traceConnector { width:2px; height:24px; margin:0 auto; } .deployForm { grid-template-columns:1fr; } }
        @media(max-width:680px){ .deploy { padding:18px 14px 44px !important; } .queueList { grid-template-columns:1fr; } .mockHeader h1 { font-size:40px; } .stageInspector dl div { grid-template-columns:1fr; gap:4px; } }


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

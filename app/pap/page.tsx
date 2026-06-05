'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type Approval = {
  id: string;
  approver_role: string;
  approver_name: string;
  status: string;
};

type RdcDetail = {
  deployment_plan?: string | null;
  rollback_plan?: string | null;
  validation_plan?: string | null;
  form_data?: any;
};

type PapStep = {
  id?: string;
  step_order: number;
  activity: string;
  responsible: string;
  planned_time: string;
  status: string;
  evidence_url: string;
  notes: string;
};

type Change = {
  id: string;
  title: string;
  description?: string | null;
  system?: string | null;
  cell?: string | null;
  category?: string | null;
  status: string;
  jira_key?: string | null;
  jira_origin?: string | null;
  proposed_deploy_date?: string | null;
  presenter?: string | null;
  technical_lead?: string | null;
  qa_analyst?: string | null;
  business_validator?: string | null;
  rdc_details?: RdcDetail[] | RdcDetail | null;
  approval_requests?: Approval[];
  pap_steps?: PapStep[];
};

const STEP_STATUS = ['Pendiente', 'En curso', 'Completado', 'Bloqueado', 'No aplica'];
const JIRA_BROWSE = 'https://multicaja-cloud.atlassian.net/browse/';

function detailOf(change: Change): RdcDetail {
  const d = change.rdc_details;
  if (Array.isArray(d)) return d[0] || {};
  return d || {};
}

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  try {
    return new Date(value).toLocaleDateString('es-CL');
  } catch {
    return value;
  }
}

function splitPlan(text?: string | null) {
  const value = String(text || '').trim();
  if (!value) return [];
  return value
    .split(/\n|\r|•|\d+\./)
    .map((item) => item.trim())
    .filter(Boolean);
}

function defaultSteps(change: Change): PapStep[] {
  const detail = detailOf(change);
  const formData = detail.form_data || {};
  const deploymentPlan = detail.deployment_plan || formData?.deployment?.productionPlan || '';
  const validationPlan = detail.validation_plan || formData?.deployment?.qaPlan || '';
  const rollback = detail.rollback_plan || formData?.deployment?.rollback || '';

  const base: PapStep[] = [
    {
      step_order: 1,
      activity: 'Revisar precondiciones del cambio y confirmar ventana de implementación',
      responsible: 'Release Management',
      planned_time: '21:30',
      status: 'Pendiente',
      evidence_url: '',
      notes: '',
    },
  ];

  splitPlan(deploymentPlan).forEach((activity, index) => {
    base.push({
      step_order: base.length + 1,
      activity,
      responsible: change.technical_lead || 'Líder técnico',
      planned_time: `${String(22 + Math.floor((index * 10) / 60)).padStart(2, '0')}:${String((index * 10) % 60).padStart(2, '0')}`,
      status: 'Pendiente',
      evidence_url: '',
      notes: '',
    });
  });

  if (validationPlan) {
    base.push({
      step_order: base.length + 1,
      activity: 'Ejecutar validación funcional/técnica post deploy',
      responsible: change.qa_analyst || 'QA',
      planned_time: '23:30',
      status: 'Pendiente',
      evidence_url: '',
      notes: validationPlan,
    });
  }

  if (rollback) {
    base.push({
      step_order: base.length + 1,
      activity: 'Validar plan de rollback disponible antes del GO / NO GO',
      responsible: 'Release Management',
      planned_time: '21:45',
      status: 'Pendiente',
      evidence_url: '',
      notes: rollback,
    });
  }

  base.push({
    step_order: base.length + 1,
    activity: 'Registrar resultado del paso y preparar cierre',
    responsible: 'Release Management',
    planned_time: '23:30',
    status: 'Pendiente',
    evidence_url: '',
    notes: '',
  });

  return base;
}

function approvedCount(change: Change) {
  const approvals = change.approval_requests || [];
  const approved = approvals.filter((a) => a.status === 'APROBADO').length;
  return `${approved}/${approvals.length || 0}`;
}

function statusClass(status: string) {
  if (status === 'Completado') return 'ok';
  if (status === 'Bloqueado') return 'bad';
  if (status === 'En curso') return 'active';
  return 'pending';
}

export default function PapPage() {
  const searchParams = useSearchParams();
  const targetRdcId = searchParams.get('rdcId') || '';

  const [changes, setChanges] = useState<Change[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [steps, setSteps] = useState<PapStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const selected = useMemo(() => changes.find((c) => c.id === selectedId) || null, [changes, selectedId]);
  const completed = steps.filter((s) => s.status === 'Completado').length;
  const blocked = steps.filter((s) => s.status === 'Bloqueado').length;
  const pending = steps.filter((s) => s.status !== 'Completado').length;
  const percent = steps.length ? Math.round((completed / steps.length) * 100) : 0;
  const readyForDeploy = steps.length > 0 && completed === steps.length;

  async function load() {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/pap/list', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'No se pudo cargar PAP');

      const list: Change[] = data.changes || [];
      setChanges(list);

      if (list.length && !selectedId) {
        const target = targetRdcId ? list.find((item) => item.id === targetRdcId) : null;
        const initial = target || list[0];
        setSelectedId(initial.id);
        setSteps(initial.pap_steps?.length ? normalizeSteps(initial.pap_steps) : defaultSteps(initial));
      }
    } catch (err: any) {
      setError(err?.message || 'Error cargando módulo PAP');
    } finally {
      setLoading(false);
    }
  }

  function normalizeSteps(raw: PapStep[]) {
    return [...raw]
      .sort((a, b) => Number(a.step_order) - Number(b.step_order))
      .map((s, index) => ({
        id: s.id,
        step_order: Number(s.step_order || index + 1),
        activity: s.activity || '',
        responsible: s.responsible || '',
        planned_time: s.planned_time || '',
        status: s.status || 'Pendiente',
        evidence_url: s.evidence_url || '',
        notes: s.notes || '',
      }));
  }

  useEffect(() => {
    load();
  }, [targetRdcId]);

  function selectChange(id: string) {
    const change = changes.find((c) => c.id === id);
    setSelectedId(id);
    setMsg('');
    setError('');
    if (change) setSteps(change.pap_steps?.length ? normalizeSteps(change.pap_steps) : defaultSteps(change));
  }

  function updateStep(index: number, key: keyof PapStep, value: string | number) {
    setSteps((current) => current.map((step, i) => i === index ? { ...step, [key]: value } : step));
  }

  function addStep() {
    setSteps((current) => [
      ...current,
      {
        step_order: current.length + 1,
        activity: '',
        responsible: '',
        planned_time: '',
        status: 'Pendiente',
        evidence_url: '',
        notes: '',
      },
    ]);
  }

  function removeStep(index: number) {
    setSteps((current) => current.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_order: i + 1 })));
  }

  function markAllComplete() {
    setSteps((current) => current.map((step) => ({ ...step, status: 'Completado' })));
  }

  async function saveSteps() {
    if (!selected) return;

    setSaving(true);
    setMsg('');
    setError('');

    try {
      const response = await fetch('/api/pap/steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rdcId: selected.id, steps }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'No se pudo guardar el PAP');

      setMsg(`Plan PAP guardado con ${data.saved} actividades.`);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Error guardando PAP');
    } finally {
      setSaving(false);
    }
  }

  function copyPlan() {
    if (!selected) return;
    const text = [
      `PLAN PAP - ${selected.title}`,
      `Sistema: ${selected.system || 'No informado'}`,
      `Célula: ${selected.cell || 'No informado'}`,
      `Fecha deploy: ${formatDate(selected.proposed_deploy_date)}`,
      `Aprobaciones: ${approvedCount(selected)}`,
      '',
      ...steps.map((s) => `${s.step_order}. [${s.status}] ${s.activity} | Responsable: ${s.responsible || 'No informado'} | Hora estimada: ${s.planned_time || 'No informado'}`),
    ].join('\n');

    navigator.clipboard?.writeText(text);
    setMsg('Plan copiado al portapapeles.');
  }

  return (
    <main className="pap">
      <header className="papHead">
        <div>
          <p className="kicker">PASO A PRODUCCIÓN · PAP</p>
          <h1>Plan PAP</h1>
          <p className="sub">
            Ordena el paso a producción en actividades simples. Completa cada paso, guarda el plan y vuelve a Deploy Center para ejecutar Jenkins.
          </p>
        </div>
        <button type="button" className="refresh" onClick={load}>Actualizar</button>
      </header>

      {loading ? <div className="state">Cargando cambios aprobados…</div> : null}
      {error ? <div className="state err">{error}</div> : null}

      {!loading && !error ? (
        <section className="papLayout">
          <aside className="queue">
            <div className="queueHead">
              <h2>RDC aprobados</h2>
              <span>{changes.length}</span>
            </div>

            {changes.length === 0 ? (
              <p className="empty">No hay RDC aprobados para planificar PAP.</p>
            ) : (
              <div className="queueList">
                {changes.map((change) => {
                  const currentSteps = change.pap_steps || [];
                  const currentCompleted = currentSteps.filter((s) => s.status === 'Completado').length;
                  const currentPercent = currentSteps.length ? Math.round((currentCompleted / currentSteps.length) * 100) : 0;

                  return (
                    <button
                      type="button"
                      key={change.id}
                      className={change.id === selectedId ? 'queueItem active' : 'queueItem'}
                      onClick={() => selectChange(change.id)}
                    >
                      <strong>{change.title}</strong>
                      <small>{change.system || 'Sin sistema'} · {change.cell || 'Sin célula'}</small>
                      <em>{currentPercent === 100 ? 'Listo para Deploy' : 'Pendiente Plan PAP'}</em>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="planner">
            {selected ? (
              <>
                <div className="summary">
                  <div>
                    <p className="kicker">Plan operativo</p>
                    <h2>{selected.title}</h2>
                    <p>{selected.system || 'Sin sistema'} · {selected.cell || 'Sin célula'} · {selected.category || 'Sin categoría'}</p>
                  </div>
                  <div className="summaryActions">
                    {selected.jira_key ? <a href={`${JIRA_BROWSE}${selected.jira_key}`} target="_blank" rel="noreferrer">Abrir Jira ↗</a> : null}
                    <a href={`/rdc/${selected.id}`} target="_blank" rel="noreferrer">Abrir RDC ↗</a>
                    <button type="button" onClick={copyPlan}>Copiar plan</button>
                  </div>
                </div>

                <section className={readyForDeploy ? 'readiness ready' : 'readiness pending'}>
                  <div>
                    <p className="kicker">Estado del Plan PAP</p>
                    <h3>{readyForDeploy ? 'Plan PAP listo para Deploy' : 'Plan PAP pendiente de completar'}</h3>
                    <p>
                      {readyForDeploy
                        ? 'Todas las actividades están completadas. Puedes volver a Deploy Center para ejecutar Jenkins.'
                        : 'Completa las actividades del paso a producción antes de ejecutar Jenkins.'}
                    </p>
                  </div>
                  <a href={`/deploy?rdcId=${selected.id}`}>Volver a Deploy Center →</a>
                </section>

                <div className="metrics">
                  <div><span>Fecha deploy</span><b>{formatDate(selected.proposed_deploy_date)}</b></div>
                  <div><span>Aprobaciones</span><b>{approvedCount(selected)}</b></div>
                  <div><span>Completadas</span><b>{completed}/{steps.length}</b></div>
                  <div><span>Avance PAP</span><b>{percent}%</b></div>
                </div>

                <div className="bar"><i style={{ width: `${percent}%` }} /></div>

                <div className="quickActions">
                  <button type="button" className="secondary" onClick={addStep}>+ Agregar actividad</button>
                  <button type="button" className="secondary" onClick={markAllComplete}>Completar todo</button>
                  <button type="button" onClick={saveSteps} disabled={saving}>{saving ? 'Guardando…' : 'Guardar Plan PAP'}</button>
                </div>
                <p className="saveHint">Cambia el estado de cada actividad y luego presiona <b>Guardar Plan PAP</b>.</p>

                <section className="guide">
                  <h3>Cómo completar este plan</h3>
                  <div>
                    <span>1</span>
                    <p>Revisa cada actividad del paso a producción.</p>
                  </div>
                  <div>
                    <span>2</span>
                    <p>Cambia el estado cuando la actividad esté validada.</p>
                  </div>
                  <div>
                    <span>3</span>
                    <p>Guarda los cambios y vuelve a Deploy Center.</p>
                  </div>
                </section>

                <section className="cards">
                  <div className="cardsHead">
                    <div>
                      <h3>Actividades del paso</h3>
                      <p>{pending === 0 ? 'Todas completadas.' : `${pending} actividad(es) pendientes.`} {blocked > 0 ? `${blocked} bloqueada(s).` : ''}</p>
                    </div>
                    <span>{steps.length} actividades</span>
                  </div>

                  {steps.map((step, index) => (
                    <article className="stepCard" key={index}>
                      <div className="stepTop">
                        <div className="stepNumber">{index + 1}</div>
                        <div className="stepTitle">
                          <span className={`status ${statusClass(step.status)}`}>{step.status}</span>
                          <textarea value={step.activity} onChange={(e) => updateStep(index, 'activity', e.target.value)} placeholder="Actividad del paso" rows={2} />
                        </div>
                      </div>

                      <div className="stepFields">
                        <label>
                          Responsable
                          <input value={step.responsible} onChange={(e) => updateStep(index, 'responsible', e.target.value)} placeholder="Responsable" />
                        </label>
                        <label>
                          Hora estimada (HH:MM)
                          <input type="time" value={step.planned_time} onChange={(e) => updateStep(index, 'planned_time', e.target.value)} />
                        </label>
                        <label>
                          Estado
                          <select value={step.status} onChange={(e) => updateStep(index, 'status', e.target.value)}>
                            {STEP_STATUS.map((s) => <option key={s}>{s}</option>)}
                          </select>
                        </label>
                        <label>
                          Evidencia
                          <input value={step.evidence_url} onChange={(e) => updateStep(index, 'evidence_url', e.target.value)} placeholder="URL evidencia" />
                        </label>
                      </div>

                      <label className="notes">
                        Notas u observaciones
                        <input value={step.notes} onChange={(e) => updateStep(index, 'notes', e.target.value)} placeholder="Notas del paso" />
                      </label>

                      <div className="stepActions">
                        <button type="button" className="remove" onClick={() => removeStep(index)}>Quitar actividad</button>
                      </div>
                    </article>
                  ))}
                </section>

                <div className="footerActions">
                  <button type="button" className="secondary" onClick={addStep}>+ Agregar actividad</button>
                  <button type="button" onClick={saveSteps} disabled={saving}>{saving ? 'Guardando…' : 'Guardar Plan PAP'}</button>
                  <a href={`/deploy?rdcId=${selected.id}`} className="deployLink">Volver a Deploy Center →</a>
                </div>

                {msg ? <div className="msg">{msg}</div> : null}
              </>
            ) : (
              <div className="state">Selecciona un RDC aprobado para generar su plan PAP.</div>
            )}
          </section>
        </section>
      ) : null}

      <style jsx>{`
        .pap { max-width: 1380px; margin: 0 auto; padding: 32px 5vw 64px; }
        .papHead { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; margin-bottom: 24px; }
        .kicker { color: var(--green-d); font-size: 13px; font-weight: 900; letter-spacing: .16em; margin: 0 0 8px; text-transform: uppercase; }
        h1 { font-size: clamp(36px, 5vw, 58px); line-height: .95; letter-spacing: -.06em; color: var(--navy-d); margin: 0; }
        .sub, .summary p, .readiness p, .guide p, .cardsHead p { color: var(--ink-soft); line-height: 1.5; margin: 8px 0 0; }
        .refresh, .quickActions button, .footerActions button, .footerActions a, .summaryActions a, .summaryActions button, .readiness a { border: 0; background: var(--green); color: #fff; border-radius: 999px; padding: 12px 17px; font-weight: 900; cursor: pointer; text-align: center; }
        .state { background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 30px; color: var(--ink-soft); }
        .state.err { color: #b42318; background: #fff1f0; }
        .papLayout { display: grid; grid-template-columns: 330px minmax(0, 1fr); gap: 18px; }
        .queue, .planner { background: #fff; border: 1px solid var(--line); border-radius: 22px; padding: 20px; box-shadow: 0 18px 45px rgba(7,59,93,.06); }
        .queueHead, .cardsHead { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 14px; }
        .queueHead h2, .summary h2, .readiness h3, .guide h3, .cardsHead h3 { margin: 0; color: var(--navy-d); letter-spacing: -.03em; }
        .queueHead span, .cardsHead span { background: var(--green-soft); color: var(--green-d); font-weight: 900; border-radius: 999px; padding: 8px 12px; white-space: nowrap; }
        .queueList { display: grid; gap: 10px; }
        .queueItem { text-align: left; background: var(--bg); border: 1px solid #dfeaf0; border-radius: 16px; padding: 14px; cursor: pointer; color: var(--ink); }
        .queueItem.active { border-color: #8fe7ba; background: #f0fff7; }
        .queueItem strong, .queueItem small, .queueItem em { display: block; }
        .queueItem strong { color: var(--navy-d); margin-bottom: 5px; }
        .queueItem small { color: var(--ink-soft); margin-bottom: 8px; }
        .queueItem em { font-style: normal; color: var(--green-d); font-weight: 900; font-size: 12px; }
        .empty { color: var(--ink-soft); }
        .summary { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; background: var(--bg); border: 1px solid #dfeaf0; border-radius: 18px; padding: 18px; }
        .summaryActions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .summaryActions a, .summaryActions button, .quickActions .secondary, .footerActions .secondary { background: #fff; color: var(--navy); border: 1px solid var(--line); }
        .readiness { display: flex; justify-content: space-between; align-items: center; gap: 18px; border-radius: 18px; padding: 18px; margin: 16px 0; border: 1px solid; }
        .readiness.pending { background: #fff7e6; border-color: #fee7aa; }
        .readiness.ready { background: #ecfdf4; border-color: #bbf7d0; }
        .readiness.ready a { background: var(--green); }
        .readiness.pending a { background: #fff; color: #7a4b00; border: 1px solid #f8d77a; }
        .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
        .metrics div { background: var(--bg); border: 1px solid #dfeaf0; border-radius: 14px; padding: 14px; }
        .metrics span { display: block; color: var(--ink-soft); font-size: 12px; font-weight: 800; margin-bottom: 6px; }
        .metrics b { color: var(--navy-d); font-size: 19px; }
        .bar { height: 12px; background: #e6f0f6; border-radius: 999px; overflow: hidden; margin-bottom: 18px; }
        .bar i { display: block; height: 100%; background: var(--green); border-radius: inherit; }
        .quickActions { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
        .quickActions button:disabled, .footerActions button:disabled { opacity: .6; cursor: not-allowed; }
        .saveHint { margin: -6px 0 16px; color: var(--ink-soft); font-size: 13px; text-align: right; }
        .saveHint b { color: var(--navy-d); }
        .guide { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
        .guide h3 { grid-column: 1 / -1; }
        .guide div { display: flex; gap: 12px; background: #f8fbfd; border: 1px solid #dfeaf0; border-radius: 16px; padding: 14px; }
        .guide span { width: 30px; height: 30px; border-radius: 999px; background: var(--green-soft); color: var(--green-d); display: flex; align-items: center; justify-content: center; font-weight: 900; flex: none; }
        .guide p { margin: 0; }
        .cards { display: grid; gap: 12px; }
        .stepCard { background: #f8fbfd; border: 1px solid #dfeaf0; border-radius: 18px; padding: 16px; }
        .stepTop { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 12px; align-items: start; }
        .stepNumber { width: 38px; height: 38px; border-radius: 12px; background: #fff; border: 1px solid #d9e7ef; color: var(--navy-d); display: flex; align-items: center; justify-content: center; font-weight: 900; }
        .stepTitle { display: grid; gap: 10px; }
        .status { width: max-content; border-radius: 999px; padding: 7px 10px; font-size: 12px; font-weight: 900; }
        .status.ok { background: #e8fff3; color: #008f57; }
        .status.active { background: #ecf7ff; color: #02568c; }
        .status.pending { background: #fff7e6; color: #9a6700; }
        .status.bad { background: #fff1f0; color: #b42318; }
        .stepFields { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 12px; }
        label { display: grid; gap: 7px; color: #315873; font-size: 12px; font-weight: 900; }
        input, select, textarea { width: 100%; border: 1px solid #d9e7ef; border-radius: 12px; padding: 11px; font: inherit; color: var(--ink); outline: none; background: #fff; }
        textarea { resize: vertical; min-height: 58px; }
        input:focus, select:focus, textarea:focus { border-color: var(--green); box-shadow: 0 0 0 3px rgba(0,193,110,.12); }
        .notes { margin-top: 12px; }
        .stepActions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 12px; }
        .remove { border: 0; border-radius: 999px; padding: 10px 13px; font-weight: 900; cursor: pointer; background: #fff1f0; color: #b42318; }
        .footerActions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
        .footerActions .deployLink { background: var(--navy); color: #fff; }
        .msg { margin-top: 14px; background: #e8fff3; color: #008f57; border: 1px solid #bbf7d0; border-radius: 14px; padding: 12px 14px; font-weight: 900; }
        @media (max-width: 1180px) {
          .papLayout { grid-template-columns: 1fr; }
          .stepFields { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 760px) {
          .papHead, .summary, .readiness { flex-direction: column; align-items: flex-start; }
          .metrics, .stepFields, .guide { grid-template-columns: 1fr; }
          .footerActions, .quickActions, .stepActions { flex-direction: column; }
          .footerActions button, .footerActions a, .quickActions button, .stepActions button, .readiness a { width: 100%; }
        }
      `}</style>
    </main>
  );
}

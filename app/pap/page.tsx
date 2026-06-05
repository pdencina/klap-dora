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
      planned_time: 'T-30 min',
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
      planned_time: `T+${index * 10} min`,
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
      planned_time: 'Post deploy',
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
      planned_time: 'Antes del inicio',
      status: 'Pendiente',
      evidence_url: '',
      notes: rollback,
    });
  }

  base.push({
    step_order: base.length + 1,
    activity: 'Registrar resultado del paso y preparar cierre',
    responsible: 'Release Management',
    planned_time: 'Post deploy',
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
  const percent = steps.length ? Math.round((completed / steps.length) * 100) : 0;

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
      ...steps.map((s) => `${s.step_order}. [${s.status}] ${s.activity} | Responsable: ${s.responsible || 'No informado'} | Hora: ${s.planned_time || 'No informado'}`),
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
          <p className="sub">Convierte el RDC aprobado en una planificación operativa: pasos, responsables, horarios, estados, evidencias y cierre.</p>
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
                {changes.map((change) => (
                  <button
                    type="button"
                    key={change.id}
                    className={change.id === selectedId ? 'queueItem active' : 'queueItem'}
                    onClick={() => selectChange(change.id)}
                  >
                    <strong>{change.title}</strong>
                    <small>{change.system || 'Sin sistema'} · {change.cell || 'Sin célula'}</small>
                    <em>{change.status === 'PAP_CREADO' ? 'PAP creado' : 'Pendiente plan PAP'}</em>
                  </button>
                ))}
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

                <div className="metrics">
                  <div><span>Fecha deploy</span><b>{formatDate(selected.proposed_deploy_date)}</b></div>
                  <div><span>Aprobaciones</span><b>{approvedCount(selected)}</b></div>
                  <div><span>Actividades</span><b>{steps.length}</b></div>
                  <div><span>Avance PAP</span><b>{percent}%</b></div>
                </div>

                <div className="bar"><i style={{ width: `${percent}%` }} /></div>

                <div className="stepsTable">
                  <div className="tableHead">
                    <span>#</span>
                    <span>Actividad</span>
                    <span>Responsable</span>
                    <span>Hora</span>
                    <span>Estado</span>
                    <span>Evidencia</span>
                    <span></span>
                  </div>

                  {steps.map((step, index) => (
                    <div className="stepRow" key={index}>
                      <input value={step.step_order} onChange={(e) => updateStep(index, 'step_order', Number(e.target.value))} />
                      <textarea value={step.activity} onChange={(e) => updateStep(index, 'activity', e.target.value)} placeholder="Actividad del paso" rows={2} />
                      <input value={step.responsible} onChange={(e) => updateStep(index, 'responsible', e.target.value)} placeholder="Responsable" />
                      <input value={step.planned_time} onChange={(e) => updateStep(index, 'planned_time', e.target.value)} placeholder="22:00 / T+10" />
                      <select value={step.status} onChange={(e) => updateStep(index, 'status', e.target.value)}>
                        {STEP_STATUS.map((s) => <option key={s}>{s}</option>)}
                      </select>
                      <input value={step.evidence_url} onChange={(e) => updateStep(index, 'evidence_url', e.target.value)} placeholder="URL evidencia" />
                      <button type="button" className="remove" onClick={() => removeStep(index)}>Quitar</button>
                      <input className="notes" value={step.notes} onChange={(e) => updateStep(index, 'notes', e.target.value)} placeholder="Notas u observaciones del paso" />
                    </div>
                  ))}
                </div>

                <div className="footerActions">
                  <button type="button" className="secondary" onClick={addStep}>+ Agregar paso</button>
                  <button type="button" onClick={saveSteps} disabled={saving}>{saving ? 'Guardando…' : 'Guardar Plan PAP'}</button>
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
        .sub, .summary p { color: var(--ink-soft); line-height: 1.5; max-width: 760px; margin: 12px 0 0; }
        .refresh, .summaryActions a, .summaryActions button, .footerActions button { border: 0; background: var(--green); color: #fff; border-radius: 999px; padding: 12px 17px; font-weight: 900; cursor: pointer; }
        .state { background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 30px; color: var(--ink-soft); }
        .state.err { color: #b42318; background: #fff1f0; }
        .papLayout { display: grid; grid-template-columns: 360px minmax(0, 1fr); gap: 18px; }
        .queue, .planner { background: #fff; border: 1px solid var(--line); border-radius: 22px; padding: 20px; box-shadow: 0 18px 45px rgba(7,59,93,.06); }
        .queueHead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .queueHead h2, .summary h2 { margin: 0; color: var(--navy-d); letter-spacing: -.03em; }
        .queueHead span { background: var(--green-soft); color: var(--green-d); font-weight: 900; border-radius: 999px; padding: 8px 12px; }
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
        .summaryActions a, .summaryActions button, .footerActions .secondary { background: #fff; color: var(--navy); border: 1px solid var(--line); }
        .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
        .metrics div { background: var(--bg); border: 1px solid #dfeaf0; border-radius: 14px; padding: 14px; }
        .metrics span { display: block; color: var(--ink-soft); font-size: 12px; font-weight: 800; margin-bottom: 6px; }
        .metrics b { color: var(--navy-d); font-size: 19px; }
        .bar { height: 12px; background: #e6f0f6; border-radius: 999px; overflow: hidden; margin-bottom: 18px; }
        .bar i { display: block; height: 100%; background: var(--green); border-radius: inherit; }
        .stepsTable { display: grid; gap: 8px; }
        .tableHead, .stepRow { display: grid; grid-template-columns: 54px minmax(260px, 1.7fr) minmax(140px, .8fr) 105px 130px minmax(140px, .8fr) 80px; gap: 8px; align-items: start; }
        .tableHead { color: var(--ink-soft); font-size: 12px; font-weight: 900; padding: 0 8px; }
        .stepRow { background: var(--bg); border: 1px solid #dfeaf0; border-radius: 14px; padding: 10px; }
        input, select, textarea { width: 100%; border: 1px solid #d9e7ef; border-radius: 10px; padding: 10px; font: inherit; color: var(--ink); outline: none; background: #fff; }
        textarea { resize: vertical; min-height: 44px; }
        input:focus, select:focus, textarea:focus { border-color: var(--green); box-shadow: 0 0 0 3px rgba(0,193,110,.12); }
        .remove { border: 0; border-radius: 999px; padding: 10px; background: #fff1f0; color: #b42318; font-weight: 900; cursor: pointer; }
        .notes { grid-column: 2 / -1; }
        .footerActions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
        .footerActions button:disabled { opacity: .6; cursor: not-allowed; }
        .msg { margin-top: 14px; background: #e8fff3; color: #008f57; border: 1px solid #bbf7d0; border-radius: 14px; padding: 12px 14px; font-weight: 900; }
        @media (max-width: 1180px) {
          .papLayout { grid-template-columns: 1fr; }
          .tableHead { display: none; }
          .stepRow { grid-template-columns: 1fr 1fr; }
          .notes { grid-column: 1 / -1; }
        }
        @media (max-width: 760px) {
          .papHead, .summary { flex-direction: column; }
          .metrics, .stepRow { grid-template-columns: 1fr; }
          .footerActions { flex-direction: column; }
        }
      `}</style>
    </main>
  );
}

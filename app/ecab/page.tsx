'use client';

import { useEffect, useMemo, useState } from 'react';

type EcabStatus =
  | 'draft'
  | 'rm_review'
  | 'rm_observed'
  | 'rm_rejected'
  | 'pre_review'
  | 'pre_observed'
  | 'pre_ok'
  | 'management_authorization'
  | 'management_observed'
  | 'management_rejected'
  | 'ready_for_pap'
  | 'pap_created'
  | 'ready_for_deploy'
  | 'implementation'
  | 'post_validation'
  | 'closed'
  | 'cancelled';

type EcabRequest = {
  id: string;
  title: string;
  system?: string | null;
  cell?: string | null;
  status: EcabStatus;
  urgency_reason: string;
  technical_lead?: string | null;
  validator?: string | null;
  proposed_deploy_at?: string | null;
  post_validation_at?: string | null;
  affected_systems?: string | null;
  approvals?: string;
  problem?: string | null;
  solution?: string | null;
  risk?: string | null;
  impact?: string | null;
  production_validation_plan?: string | null;
  jira_or_erfc_url?: string | null;
  approval_rule?: string | null;
  created_by?: string | null;
};

type FormState = {
  title: string;
  system: string;
  cell: string;
  technical_lead: string;
  created_by: string;
  jira_or_erfc_url: string;
  urgency_reason: string;
  urgency_type: string;
  criticality: string;
  approval_rule: string;
  problem: string;
  solution: string;
  risk: string;
  impact: string;
  proposed_deploy_at: string;
  post_validation_at: string;
  validator: string;
  production_validation_plan: string;
  affected_systems: string;
};

const emptyForm: FormState = {
  title: '',
  system: '',
  cell: '',
  technical_lead: '',
  created_by: '',
  jira_or_erfc_url: '',
  urgency_reason: '',
  urgency_type: 'Emergencia operacional',
  criticality: 'Media',
  approval_rule: '2_of_3',
  problem: '',
  solution: '',
  risk: '',
  impact: '',
  proposed_deploy_at: '',
  post_validation_at: '',
  validator: '',
  production_validation_plan: '',
  affected_systems: '',
};

const statusLabel: Record<EcabStatus, string> = {
  draft: 'Borrador',
  rm_review: 'En revisión RM',
  rm_observed: 'Observado por RM',
  rm_rejected: 'Rechazado por RM',
  pre_review: 'Revisión previa eCAB',
  pre_observed: 'Observado en revisión previa',
  pre_ok: 'Revisión previa OK',
  management_authorization: 'Autorización gerencial',
  management_observed: 'Observado por gerencia',
  management_rejected: 'Rechazado por gerencia',
  ready_for_pap: 'Listo para PAP',
  pap_created: 'Plan PAP creado',
  ready_for_deploy: 'Listo para Deploy',
  implementation: 'En implementación',
  post_validation: 'Validación post deploy',
  closed: 'Cerrado',
  cancelled: 'Cancelado',
};

const sampleEcabs: EcabRequest[] = [
  {
    id: 'demo-1',
    title: 'Mantención servicio consulta de terminales',
    system: 'Autoconfiguración POS Itaú',
    cell: 'Adquirencia',
    status: 'management_authorization',
    urgency_reason: 'Compromiso con negocio por incrementales de afiliación y autoconfiguración.',
    technical_lead: 'Bryan González',
    validator: 'Nicolás Pantoja / Felipe Jara',
    proposed_deploy_at: '08-06-2026',
    post_validation_at: '09-06-2026',
    affected_systems: 'Autoconfiguración POS Itaú / Order Manager / Activación POS / Consulta BO',
    approvals: '0/3',
    problem: 'Se requieren validaciones adicionales en consulta de terminales.',
    solution: 'Añadir validaciones correspondientes en componente Java junto a salidas requeridas.',
    risk: 'No existe riesgo mayor, piloto interno.',
    impact: 'Usuarios internos y flujo operativo de autoconfiguración.',
    production_validation_plan: 'Activaciones de equipos preconfigurados posterior al paso a producción.',
    jira_or_erfc_url: 'CNLS-1849',
    approval_rule: '2_of_3',
  },
  {
    id: 'demo-2',
    title: '[HOTFIX] Corrección reversas POS duplicadas',
    system: 'POS · Adquirencia',
    cell: 'POS',
    status: 'ready_for_pap',
    urgency_reason: 'Corrección requerida antes del siguiente CAB por impacto operativo.',
    technical_lead: 'Pablo Encina',
    validator: 'Ximena Cruz',
    proposed_deploy_at: 'Hoy 22:00',
    post_validation_at: 'Hoy 23:00',
    affected_systems: 'POS / Clearing / Adquirencia',
    approvals: '3/3',
    problem: 'Reversas duplicadas en operación POS.',
    solution: 'Aplicar hotfix de validación de duplicidad.',
    risk: 'Riesgo controlado con rollback disponible.',
    impact: 'Operación transaccional POS.',
    production_validation_plan: 'Validar trx reversadas y cuadratura posterior.',
    jira_or_erfc_url: 'PAP-DEMO-001',
    approval_rule: '2_of_3',
  },
];

const flow = [
  { label: 'Solicitud', help: 'Líder técnico completa preguntas eCAB.' },
  { label: 'Revisión RM', help: 'Release Manager aprueba, observa o rechaza.' },
  { label: 'Revisión previa', help: 'Áreas revisan digitalmente dentro del sistema.' },
  { label: 'Autorización', help: 'Gerencia autoriza según regla definida.' },
  { label: 'Plan PAP', help: 'Se habilita PAP con evidencia eCAB.' },
  { label: 'Deploy', help: 'Deploy Center ejecuta solo si está aprobado.' },
  { label: 'Cierre', help: 'Validación post deploy y cierre digital.' },
];

const formSteps = [
  { title: 'Identificación', help: 'Datos base del cambio y su origen técnico.' },
  { title: 'Urgencia', help: 'Justificación para no esperar al CAB regular.' },
  { title: 'Análisis', help: 'Problema, solución, riesgo e impacto.' },
  { title: 'Validación', help: 'Horario, validador, plan y sistemas afectados.' },
  { title: 'Revisión', help: 'Resumen antes de enviar a revisión RM.' },
];

const requiredByStep: Record<number, (keyof FormState)[]> = {
  0: ['title', 'system', 'cell', 'technical_lead', 'jira_or_erfc_url'],
  1: ['urgency_reason', 'urgency_type', 'criticality', 'approval_rule'],
  2: ['problem', 'solution', 'risk', 'impact'],
  3: ['proposed_deploy_at', 'post_validation_at', 'validator', 'production_validation_plan', 'affected_systems'],
  4: [],
};

const fieldLabels: Record<keyof FormState, string> = {
  title: 'Nombre del cambio',
  system: 'Sistema / Producto',
  cell: 'Célula',
  technical_lead: 'Líder técnico',
  created_by: 'Solicitante',
  jira_or_erfc_url: 'Jira / ERFC / Ticket productivo',
  urgency_reason: 'Motivo por el cual no puede esperar al siguiente CAB',
  urgency_type: 'Tipo de urgencia',
  criticality: 'Criticidad',
  approval_rule: 'Regla de autorización',
  problem: 'Cuál es el problema',
  solution: 'Cuál es la solución',
  risk: 'Qué riesgo tiene aplicar este cambio',
  impact: 'A quién afecta este cambio',
  proposed_deploy_at: 'Fecha/Hora propuesta para despliegue',
  post_validation_at: 'Fecha/Hora de validación post despliegue',
  validator: 'Validador',
  production_validation_plan: 'Plan de validación en producción',
  affected_systems: 'Sistemas afectados',
};

function approvalRuleLabel(value?: string | null) {
  if (value === '1_of_3') return '1 de 3 autorizadores';
  if (value === '3_of_3') return '3 de 3 autorizadores';
  return '2 de 3 autorizadores';
}

function statusClass(status: EcabStatus) {
  if (status.includes('rejected')) return 'danger';
  if (status.includes('observed')) return 'warning';
  if (status === 'ready_for_pap' || status === 'pap_created' || status === 'ready_for_deploy' || status === 'closed') return 'success';
  return 'info';
}

function questionAnswers(selected: EcabRequest) {
  return [
    ['Motivo no puede esperar al siguiente CAB', selected.urgency_reason],
    ['Nombre de cambio', selected.title],
    ['¿Cuál es el problema?', selected.problem || 'Pendiente'],
    ['¿Cuál es la solución?', selected.solution || 'Pendiente'],
    ['¿Qué riesgo tiene aplicar este cambio?', selected.risk || 'Pendiente'],
    ['¿A quién afecta este cambio?', selected.impact || 'Pendiente'],
    ['Fecha/Hora propuesta para despliegue', selected.proposed_deploy_at || 'Pendiente'],
    ['Fecha/Hora de validación post despliegue', selected.post_validation_at || 'Pendiente'],
    ['Validador', selected.validator || 'Pendiente'],
    ['Plan de validación en producción', selected.production_validation_plan || 'Pendiente'],
    ['Sistemas afectados', selected.affected_systems || 'Pendiente'],
    ['Link ticket productivo JIRA / ERFC', selected.jira_or_erfc_url || 'Pendiente'],
  ];
}

function completedCount(form: FormState) {
  const allRequired = Object.values(requiredByStep).flat();
  return allRequired.filter((field) => String(form[field] || '').trim()).length;
}

function missingForStep(step: number, form: FormState) {
  return requiredByStep[step].filter((field) => !String(form[field] || '').trim());
}

export default function EcabPage() {
  const [ecabs, setEcabs] = useState<EcabRequest[]>(sampleEcabs);
  const [selectedId, setSelectedId] = useState(sampleEcabs[0]?.id || '');
  const [formOpen, setFormOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadEcabs() {
      try {
        const response = await fetch('/api/ecab', { cache: 'no-store' });
        const data = await response.json().catch(() => null);

        if (!active) return;

        if (response.ok && data?.ok && Array.isArray(data.ecabs) && data.ecabs.length) {
          setEcabs(data.ecabs);
          setSelectedId(data.ecabs[0].id);
        }
      } catch {
        // Si la tabla/API aún no está lista, dejamos los datos demo para no romper la pantalla.
      } finally {
        if (active) setLoading(false);
      }
    }

    loadEcabs();

    return () => {
      active = false;
    };
  }, []);

  const selected = useMemo(() => ecabs.find((item) => item.id === selectedId) || ecabs[0], [ecabs, selectedId]);

  const kpis = useMemo(() => {
    return {
      rm: ecabs.filter((item) => item.status === 'rm_review' || item.status === 'rm_observed').length,
      auth: ecabs.filter((item) => item.status === 'management_authorization' || item.status === 'management_observed').length,
      approved: ecabs.filter((item) => item.status === 'ready_for_pap' || item.status === 'pap_created' || item.status === 'ready_for_deploy').length,
      pap: ecabs.filter((item) => item.status === 'ready_for_pap').length,
    };
  }, [ecabs]);

  const progress = completedCount(form);
  const totalRequired = Object.values(requiredByStep).flat().length;

  function update(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFormError('');
  }

  function openNewRequest() {
    setForm(emptyForm);
    setStep(0);
    setNotice('');
    setFormError('');
    setFormOpen(true);
    window.setTimeout(() => {
      document.getElementById('ecab-form-flow')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function nextStep() {
    const missing = missingForStep(step, form);
    if (missing.length) {
      setFormError(`Completa: ${missing.map((field) => fieldLabels[field]).join(', ')}.`);
      return;
    }

    setFormError('');
    setStep((current) => Math.min(current + 1, formSteps.length - 1));
  }

  function previousStep() {
    setFormError('');
    setStep((current) => Math.max(current - 1, 0));
  }

  async function submitEcab() {
    const missingAll = Object.values(requiredByStep).flat().filter((field) => !String(form[field] || '').trim());
    if (missingAll.length) {
      setFormError(`Faltan campos obligatorios: ${missingAll.map((field) => fieldLabels[field]).join(', ')}.`);
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      const response = await fetch('/api/ecab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          system: form.system,
          cell: form.cell,
          technical_lead: form.technical_lead,
          created_by: form.created_by,
          jira_or_erfc_url: form.jira_or_erfc_url,
          urgency_reason: form.urgency_reason,
          problem: form.problem,
          solution: form.solution,
          risk: form.risk,
          impact: form.impact,
          proposed_deploy_at: form.proposed_deploy_at,
          post_validation_at: form.post_validation_at,
          validator: form.validator,
          production_validation_plan: form.production_validation_plan,
          affected_systems: form.affected_systems,
          approval_rule: form.approval_rule,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || 'No fue posible crear la solicitud eCAB.');
      }

      const created = data.ecab as EcabRequest;
      setEcabs((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setSelectedId(created.id);
      setFormOpen(false);
      setStep(0);
      setForm(emptyForm);
      setNotice('Solicitud eCAB creada y enviada a revisión Release Manager.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      setFormError(error?.message || 'No fue posible crear la solicitud eCAB.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="ecabPage">
      <header className="hero">
        <div>
          <p className="kicker">eCAB DIGITAL</p>
          <h1>Gestión eCAB 100% digital</h1>
          <p>
            Centraliza solicitudes urgentes, revisión Release Manager, observaciones, autorización gerencial,
            trazabilidad, evidencias, PAP, Deploy y cierre sin depender de correos ni Teams como evidencia oficial.
          </p>
        </div>
        <div className="heroActions">
          <button className="primaryAction" type="button" onClick={openNewRequest}>Nueva solicitud eCAB</button>
          <button type="button">Configurar reglas</button>
        </div>
      </header>

      {notice ? <div className="successNotice">{notice}</div> : null}

      <section className="kpis">
        <article><span>Pendientes RM</span><b>{kpis.rm}</b></article>
        <article><span>En autorización</span><b>{kpis.auth}</b></article>
        <article><span>Aprobados gerencia</span><b>{kpis.approved}</b></article>
        <article><span>Listos para PAP</span><b>{kpis.pap}</b></article>
      </section>

      <section className="flowCard">
        <div className="sectionHead">
          <div>
            <p className="kicker">Flujo oficial</p>
            <h2>Solicitud → Revisión → Autorización → PAP → Deploy → Cierre</h2>
          </div>
          <span className="digitalBadge">Fuente oficial: Sistema</span>
        </div>

        <div className="flow">
          {flow.map((item, index) => (
            <div className="flowItemWrap" key={item.label}>
              <article className={index <= 3 ? 'flowItem done' : 'flowItem pending'}>
                <span>{index + 1}</span>
                <b>{item.label}</b>
                <small>{item.help}</small>
              </article>
              {index < flow.length - 1 ? <div className="flowConnector" /> : null}
            </div>
          ))}
        </div>
      </section>

      {formOpen ? (
        <section className="formFlow" id="ecab-form-flow">
          <div className="formTop">
            <div>
              <p className="kicker">Nueva solicitud eCAB</p>
              <h2>Flujo guiado de llenado</h2>
              <p>Completa la solicitud urgente. Al enviar, queda como expediente digital en revisión Release Manager.</p>
            </div>
            <button type="button" onClick={() => setFormOpen(false)}>Cerrar</button>
          </div>

          <div className="stepper">
            {formSteps.map((item, index) => (
              <button key={item.title} className={index === step ? 'active' : index < step ? 'done' : ''} type="button" onClick={() => setStep(index)}>
                <span>{index + 1}</span>
                <b>{item.title}</b>
                <small>{item.help}</small>
              </button>
            ))}
          </div>

          <div className="progressBox">
            <span>Campos obligatorios completos</span>
            <b>{progress}/{totalRequired}</b>
            <div><i style={{ width: `${Math.round((progress / totalRequired) * 100)}%` }} /></div>
          </div>

          <div className="formPanel">
            {step === 0 ? (
              <div className="formGrid">
                <Field label="Nombre del cambio *"><input value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="Ej: Mantención servicio consulta de terminales" /></Field>
                <Field label="Sistema / Producto *"><input value={form.system} onChange={(event) => update('system', event.target.value)} placeholder="Ej: POS / Portal / H2H" /></Field>
                <Field label="Célula *"><input value={form.cell} onChange={(event) => update('cell', event.target.value)} placeholder="Ej: Adquirencia" /></Field>
                <Field label="Líder técnico *"><input value={form.technical_lead} onChange={(event) => update('technical_lead', event.target.value)} placeholder="Nombre líder técnico" /></Field>
                <Field label="Solicitante"><input value={form.created_by} onChange={(event) => update('created_by', event.target.value)} placeholder="correo@klap.cl" /></Field>
                <Field label="Jira / ERFC / Ticket productivo *"><input value={form.jira_or_erfc_url} onChange={(event) => update('jira_or_erfc_url', event.target.value)} placeholder="https://... o CNLS-1234" /></Field>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="formGrid">
                <Field label="Motivo no puede esperar al siguiente CAB *" full><textarea value={form.urgency_reason} onChange={(event) => update('urgency_reason', event.target.value)} rows={4} placeholder="Explica el compromiso, urgencia, incidente, riesgo operativo o razón de negocio." /></Field>
                <Field label="Tipo de urgencia *">
                  <select value={form.urgency_type} onChange={(event) => update('urgency_type', event.target.value)}>
                    <option>Emergencia operacional</option>
                    <option>Incidente productivo</option>
                    <option>Compromiso negocio</option>
                    <option>Riesgo regulatorio</option>
                    <option>Corrección crítica</option>
                  </select>
                </Field>
                <Field label="Criticidad *">
                  <select value={form.criticality} onChange={(event) => update('criticality', event.target.value)}>
                    <option>Baja</option>
                    <option>Media</option>
                    <option>Alta</option>
                    <option>Crítica</option>
                  </select>
                </Field>
                <Field label="Regla de autorización *">
                  <select value={form.approval_rule} onChange={(event) => update('approval_rule', event.target.value)}>
                    <option value="1_of_3">1 de 3 autorizadores</option>
                    <option value="2_of_3">2 de 3 autorizadores</option>
                    <option value="3_of_3">3 de 3 autorizadores</option>
                  </select>
                </Field>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="formGrid">
                <Field label="1. ¿Cuál es el problema? *" full><textarea value={form.problem} onChange={(event) => update('problem', event.target.value)} rows={4} /></Field>
                <Field label="2. ¿Cuál es la solución? *" full><textarea value={form.solution} onChange={(event) => update('solution', event.target.value)} rows={4} /></Field>
                <Field label="3. ¿Qué riesgo tiene aplicar este cambio? *" full><textarea value={form.risk} onChange={(event) => update('risk', event.target.value)} rows={4} /></Field>
                <Field label="4. ¿A quién afecta este cambio? *" full><textarea value={form.impact} onChange={(event) => update('impact', event.target.value)} rows={4} /></Field>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="formGrid">
                <Field label="5. Fecha/Hora propuesta para despliegue *"><input value={form.proposed_deploy_at} onChange={(event) => update('proposed_deploy_at', event.target.value)} placeholder="Ej: 09-06-2026 22:00" /></Field>
                <Field label="6. Fecha/Hora validación post despliegue *"><input value={form.post_validation_at} onChange={(event) => update('post_validation_at', event.target.value)} placeholder="Ej: 09-06-2026 23:00" /></Field>
                <Field label="7. Validador *"><input value={form.validator} onChange={(event) => update('validator', event.target.value)} placeholder="Nombre del validador" /></Field>
                <Field label="8. Plan de validación en producción *" full><textarea value={form.production_validation_plan} onChange={(event) => update('production_validation_plan', event.target.value)} rows={4} /></Field>
                <Field label="9. Sistemas afectados *" full><textarea value={form.affected_systems} onChange={(event) => update('affected_systems', event.target.value)} rows={4} placeholder="Sistema 1 / Sistema 2 / Flujo afectado" /></Field>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="reviewPanel">
                <div className="reviewHero">
                  <p className="kicker">Revisión final</p>
                  <h3>{form.title || 'Solicitud eCAB sin nombre'}</h3>
                  <span>Destino: Revisión Release Manager</span>
                </div>

                <div className="reviewGrid">
                  <Review label="Sistema" value={form.system} />
                  <Review label="Célula" value={form.cell} />
                  <Review label="Líder técnico" value={form.technical_lead} />
                  <Review label="Validador" value={form.validator} />
                  <Review label="Regla autorización" value={approvalRuleLabel(form.approval_rule)} />
                  <Review label="Jira / ERFC" value={form.jira_or_erfc_url} />
                </div>

                <div className="reviewLong">
                  <Review label="Motivo urgencia" value={form.urgency_reason} />
                  <Review label="Problema" value={form.problem} />
                  <Review label="Solución" value={form.solution} />
                  <Review label="Riesgo" value={form.risk} />
                  <Review label="Impacto" value={form.impact} />
                  <Review label="Plan validación" value={form.production_validation_plan} />
                  <Review label="Sistemas afectados" value={form.affected_systems} />
                </div>
              </div>
            ) : null}
          </div>

          {formError ? <div className="errorBox">{formError}</div> : null}

          <div className="formActions">
            <button type="button" onClick={previousStep} disabled={step === 0 || saving}>← Atrás</button>
            {step < formSteps.length - 1 ? (
              <button className="primaryAction" type="button" onClick={nextStep}>Siguiente →</button>
            ) : (
              <button className="primaryAction" type="button" onClick={submitEcab} disabled={saving}>
                {saving ? 'Guardando...' : 'Enviar a revisión RM'}
              </button>
            )}
          </div>
        </section>
      ) : null}

      <section className="layout">
        <aside className="queue">
          <div className="queueHead">
            <h2>Solicitudes eCAB</h2>
            <span>{loading ? '...' : ecabs.length}</span>
          </div>

          {ecabs.map((ecab) => (
            <button key={ecab.id} className={ecab.id === selected?.id ? 'ecabItem active' : 'ecabItem'} type="button" onClick={() => setSelectedId(ecab.id)}>
              <strong>{ecab.title}</strong>
              <small>{ecab.system || 'Sin sistema'} {ecab.cell ? `· ${ecab.cell}` : ''}</small>
              <em className={statusClass(ecab.status)}>{statusLabel[ecab.status]}</em>
            </button>
          ))}
        </aside>

        {selected ? (
          <section className="detail">
            <article className="requestCard">
              <div className="requestTop">
                <div>
                  <p className="kicker">Solicitud formal eCAB</p>
                  <h2>{selected.title}</h2>
                  <p>{selected.system || 'Sin sistema'} {selected.cell ? `· ${selected.cell}` : ''}</p>
                </div>
                <span className={`statusPill ${statusClass(selected.status)}`}>{statusLabel[selected.status]}</span>
              </div>

              <div className="summaryGrid">
                <div><span>Líder técnico</span><b>{selected.technical_lead || 'Pendiente'}</b></div>
                <div><span>Validador</span><b>{selected.validator || 'Pendiente'}</b></div>
                <div><span>Fecha deploy</span><b>{selected.proposed_deploy_at || 'Pendiente'}</b></div>
                <div><span>Autorización</span><b>{selected.approvals || approvalRuleLabel(selected.approval_rule)}</b></div>
              </div>

              <div className="urgencyBox">
                <span>Motivo de urgencia</span>
                <p>{selected.urgency_reason}</p>
              </div>
            </article>

            <article className="questionsCard">
              <div className="sectionHead">
                <div>
                  <p className="kicker">Preguntas eCAB</p>
                  <h3>Formulario estructurado</h3>
                </div>
                <span className="completeBadge">Expediente digital</span>
              </div>

              <div className="questionGrid">
                {questionAnswers(selected).map(([question, answer], index) => (
                  <div key={question}>
                    <span>{index + 1}</span>
                    <b>{question}</b>
                    <small>{answer}</small>
                  </div>
                ))}
              </div>
            </article>

            <article className="decisionCard">
              <div className="sectionHead">
                <div>
                  <p className="kicker">Decisión digital</p>
                  <h3>Acciones disponibles según rol</h3>
                </div>
              </div>

              <div className="decisionGrid">
                <button className="approve" type="button">Aprobar</button>
                <button className="observe" type="button">Observar</button>
                <button className="reject" type="button">Rechazar</button>
              </div>

              <textarea placeholder="Comentario u observación. Esta evidencia queda guardada en el historial eCAB." />
            </article>
          </section>
        ) : null}

        <aside className="audit">
          <h3>Expediente digital</h3>

          <div className="auditStep done"><span>✓</span><div><b>Solicitud creada</b><small>Líder técnico registró eCAB.</small></div></div>
          <div className="auditStep active"><span>◷</span><div><b>Revisión RM</b><small>Release Manager revisa y da OK.</small></div></div>
          <div className="auditStep"><span>○</span><div><b>Revisión previa</b><small>Áreas revisan dentro del sistema.</small></div></div>
          <div className="auditStep"><span>○</span><div><b>Autorización gerencial</b><small>Decisión digital según regla.</small></div></div>
          <div className="auditStep"><span>○</span><div><b>Plan PAP</b><small>Se habilita al aprobar eCAB.</small></div></div>
          <div className="auditStep"><span>○</span><div><b>Deploy y cierre</b><small>Ejecución y validación post deploy.</small></div></div>

          <div className="ruleBox">
            <span>Regla de aprobación</span>
            <b>{approvalRuleLabel(selected?.approval_rule)}</b>
            <small>Configurable por criticidad del eCAB.</small>
          </div>
        </aside>
      </section>

      <style jsx>{`
        .ecabPage { width:100%; min-height:100vh; padding:32px clamp(18px, 3vw, 42px) 64px; color:#00395f; background:#eef5f8; box-sizing:border-box; }
        .hero,.flowCard,.queue,.requestCard,.questionsCard,.decisionCard,.audit,.kpis article,.formFlow { background:#fff; border:1px solid #dfeaf0; border-radius:24px; box-shadow:0 18px 45px rgba(7,59,93,.06); }
        .hero { display:flex; align-items:flex-start; justify-content:space-between; gap:28px; padding:30px; margin-bottom:20px; }
        .kicker { margin:0 0 8px; color:#00a86b; font-weight:950; letter-spacing:.18em; font-size:12px; text-transform:uppercase; }
        h1,h2,h3,p { margin-top:0; }
        h1 { font-size:clamp(38px, 4vw, 64px); line-height:.98; letter-spacing:-.06em; margin-bottom:14px; }
        .hero p { color:#60748a; font-size:18px; line-height:1.45; max-width:880px; margin-bottom:0; }
        .heroActions { display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
        .heroActions button,.heroActions a,.formActions button { min-height:44px; border-radius:999px; padding:0 18px; border:1px solid #dfeaf0; background:#fff; color:#00395f; font-weight:900; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; }
        .heroActions .primaryAction,.formActions .primaryAction { background:#00b86b; color:#fff; border-color:#00b86b; }
        .successNotice,.errorBox { border-radius:18px; padding:16px 18px; margin-bottom:18px; font-weight:900; }
        .successNotice { background:#f0fff7; border:1px solid #86efac; color:#008f57; }
        .errorBox { background:#fff7ed; border:1px solid #fed7aa; color:#c2410c; }
        .kpis { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:16px; margin-bottom:20px; }
        .kpis article { padding:20px; }
        .kpis span,.summaryGrid span,.urgencyBox span,.ruleBox span,.progressBox span,.reviewGrid span,.reviewLong span { color:#60748a; font-size:12px; font-weight:900; display:block; margin-bottom:6px; }
        .kpis b { font-size:34px; color:#00a86b; }
        .flowCard { padding:24px; margin-bottom:20px; }
        .sectionHead { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:18px; }
        .sectionHead h2,.sectionHead h3 { margin:0; letter-spacing:-.04em; }
        .digitalBadge,.completeBadge,.statusPill { border-radius:999px; padding:9px 13px; background:#e8fff3; color:#008f57; font-weight:950; white-space:nowrap; }
        .statusPill.warning, .ecabItem em.warning { background:#fff7ed; color:#c2410c; }
        .statusPill.danger, .ecabItem em.danger { background:#fee2e2; color:#b91c1c; }
        .statusPill.info, .ecabItem em.info { background:#eff6ff; color:#0b67d8; }
        .flow { display:grid; grid-template-columns:1fr 26px 1fr 26px 1fr 26px 1fr 26px 1fr 26px 1fr 26px 1fr; align-items:stretch; }
        .flowItemWrap { display:contents; }
        .flowItem { border:1px solid #dfeaf0; border-radius:18px; padding:16px; background:#f8fbfd; min-height:130px; }
        .flowItem.done { background:#f0fff7; border-color:#bbf7d0; }
        .flowItem span { width:34px; height:34px; border-radius:999px; background:#00b86b; color:#fff; display:inline-flex; align-items:center; justify-content:center; font-weight:950; margin-bottom:12px; }
        .flowItem b { display:block; margin-bottom:6px; }
        .flowItem small { color:#60748a; font-weight:700; line-height:1.35; }
        .flowConnector { height:2px; align-self:center; border-top:2px dotted #9fb8cc; }
        .formFlow { padding:24px; margin-bottom:20px; }
        .formTop { display:flex; justify-content:space-between; gap:20px; margin-bottom:18px; }
        .formTop h2 { font-size:clamp(28px,2.5vw,44px); line-height:1; letter-spacing:-.05em; margin-bottom:8px; }
        .formTop p { color:#60748a; margin-bottom:0; }
        .formTop button { align-self:flex-start; border:1px solid #dfeaf0; background:#fff; border-radius:999px; padding:10px 16px; font-weight:900; cursor:pointer; color:#00395f; }
        .stepper { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; margin-bottom:16px; }
        .stepper button { border:1px solid #dfeaf0; border-radius:16px; background:#f8fbfd; padding:14px; text-align:left; cursor:pointer; min-height:112px; }
        .stepper button.active,.stepper button.done { background:#f0fff7; border-color:#86efac; }
        .stepper span { width:30px; height:30px; border-radius:999px; background:#e8fff3; color:#008f57; display:inline-flex; align-items:center; justify-content:center; font-weight:950; margin-bottom:8px; }
        .stepper button.active span,.stepper button.done span { background:#00b86b; color:#fff; }
        .stepper b { display:block; margin-bottom:5px; color:#00395f; }
        .stepper small { color:#60748a; font-weight:700; line-height:1.25; }
        .progressBox { border:1px solid #dfeaf0; border-radius:16px; padding:14px; margin-bottom:16px; background:#f8fbfd; display:grid; grid-template-columns:1fr auto; gap:10px; align-items:center; }
        .progressBox b { color:#00a86b; font-size:20px; }
        .progressBox div { grid-column:1/-1; height:10px; border-radius:999px; background:#e7f0f5; overflow:hidden; }
        .progressBox i { display:block; height:100%; background:#00b86b; border-radius:999px; transition:width .2s ease; }
        .formPanel { border:1px solid #dfeaf0; border-radius:20px; padding:20px; background:#fbfdff; }
        .formGrid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
        .field { display:grid; gap:7px; }
        .field.full { grid-column:1/-1; }
        .field label { color:#00395f; font-size:13px; font-weight:950; }
        input,select,textarea { width:100%; border:1px solid #d6e5ee; border-radius:14px; padding:13px 14px; font:inherit; color:#00395f; background:#fff; box-sizing:border-box; }
        textarea { resize:vertical; min-height:96px; }
        .formActions { display:flex; justify-content:flex-end; gap:10px; margin-top:16px; }
        .formActions button:disabled { opacity:.55; cursor:not-allowed; }
        .reviewPanel { display:grid; gap:16px; }
        .reviewHero { border:1px solid #bbf7d0; background:#f0fff7; border-radius:18px; padding:18px; }
        .reviewHero h3 { font-size:clamp(26px,2.2vw,40px); line-height:1; letter-spacing:-.05em; margin-bottom:8px; }
        .reviewHero span { color:#008f57; font-weight:950; }
        .reviewGrid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
        .reviewGrid div,.reviewLong div { border:1px solid #dfeaf0; background:#fff; border-radius:14px; padding:14px; min-width:0; }
        .reviewGrid b,.reviewLong b { display:block; overflow-wrap:anywhere; color:#00395f; line-height:1.35; }
        .reviewLong { display:grid; gap:12px; }
        .layout { display:grid; grid-template-columns:minmax(270px, 320px) minmax(0, 1fr) minmax(280px, 340px); gap:20px; align-items:start; }
        .queue,.audit { padding:22px; position:sticky; top:24px; }
        .queueHead { display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:16px; }
        .queueHead h2 { margin:0; letter-spacing:-.04em; }
        .queueHead span { width:38px; height:38px; border-radius:999px; background:#e8fff3; color:#008f57; display:inline-flex; align-items:center; justify-content:center; font-weight:950; }
        .ecabItem { width:100%; border:1px solid #dfeaf0; border-radius:16px; background:#f8fbfd; text-align:left; padding:16px; margin-bottom:12px; display:flex; flex-direction:column; gap:7px; cursor:pointer; }
        .ecabItem.active { background:#f0fff7; border-color:#86efac; }
        .ecabItem strong { color:#00395f; line-height:1.25; }
        .ecabItem small { color:#60748a; font-weight:800; }
        .ecabItem em { align-self:flex-start; border-radius:999px; padding:5px 9px; font-style:normal; font-weight:950; font-size:12px; }
        .detail { display:grid; gap:18px; min-width:0; }
        .requestCard,.questionsCard,.decisionCard { padding:24px; }
        .requestTop { display:flex; justify-content:space-between; gap:18px; margin-bottom:18px; }
        .requestTop h2 { font-size:clamp(28px, 2.5vw, 44px); line-height:1.05; letter-spacing:-.05em; margin-bottom:8px; overflow-wrap:anywhere; }
        .requestTop p { color:#60748a; margin-bottom:0; }
        .summaryGrid { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:12px; margin-bottom:16px; }
        .summaryGrid div,.urgencyBox { border:1px solid #dfeaf0; border-radius:14px; background:#f8fbfd; padding:14px; min-width:0; }
        .summaryGrid b { display:block; overflow-wrap:anywhere; }
        .urgencyBox p { margin:0; color:#00395f; line-height:1.4; }
        .questionGrid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:12px; }
        .questionGrid div { border:1px solid #dfeaf0; border-radius:14px; background:#f8fbfd; padding:14px; min-width:0; }
        .questionGrid span { width:28px; height:28px; border-radius:999px; background:#e8fff3; color:#008f57; display:inline-flex; align-items:center; justify-content:center; font-weight:950; margin-bottom:8px; }
        .questionGrid b { display:block; margin-bottom:7px; line-height:1.25; }
        .questionGrid small { color:#60748a; font-weight:700; line-height:1.35; overflow-wrap:anywhere; }
        .decisionGrid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; margin-bottom:12px; }
        .decisionGrid button { min-height:48px; border:0; border-radius:14px; color:#fff; font-weight:950; cursor:pointer; }
        .approve { background:#00b86b; } .observe { background:#f59e0b; } .reject { background:#dc2626; }
        .audit h3 { margin-bottom:18px; letter-spacing:-.04em; }
        .auditStep { display:grid; grid-template-columns:34px 1fr; gap:12px; padding:13px 0; border-bottom:1px solid #edf3f7; }
        .auditStep span { width:32px; height:32px; border-radius:999px; background:#eef5f8; display:inline-flex; align-items:center; justify-content:center; font-weight:950; }
        .auditStep.done span,.auditStep.active span { background:#e8fff3; color:#008f57; }
        .auditStep b { display:block; }
        .auditStep small { color:#60748a; font-weight:700; line-height:1.35; }
        .ruleBox { margin-top:18px; border:1px solid #bbf7d0; border-radius:16px; background:#f0fff7; padding:16px; }
        .ruleBox b { display:block; margin-bottom:6px; }
        .ruleBox small { color:#60748a; font-weight:700; }
        @media(max-width:1450px){ .layout { grid-template-columns:1fr; } .queue,.audit { position:relative; top:auto; } .flow { grid-template-columns:repeat(4, minmax(0, 1fr)); gap:12px; } .flowItemWrap { display:block; } .flowConnector { display:none; } }
        @media(max-width:1080px){ .stepper { grid-template-columns:repeat(2,minmax(0,1fr)); } .formGrid,.questionGrid,.reviewGrid,.summaryGrid,.decisionGrid,.kpis { grid-template-columns:1fr; } }
        @media(max-width:960px){ .hero,.requestTop,.sectionHead,.formTop { flex-direction:column; } .flow { grid-template-columns:1fr; } .heroActions { width:100%; justify-content:flex-start; } }
      `}</style>
    </main>
  );
}

function Field({ label, children, full = false }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'field full' : 'field'}>
      <label>{label}</label>
      {children}
    </div>
  );
}

function Review({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span>{label}</span>
      <b>{value || 'Pendiente'}</b>
    </div>
  );
}

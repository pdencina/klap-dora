'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type ApprovalRole = {
  id: string;
  role_name: string;
  approver_name: string;
  approver_email?: string | null;
  approver_account_id?: string | null;
};

type JiraUser = {
  accountId?: string;
  displayName?: string;
  emailAddress?: string;
  avatarUrl?: string;
};

const categoriaOptions = ['Mantención', 'Proyecto', 'Incidente', 'Hotfix', 'ECAB', 'Recurrente'];
const sistemaOptions = ['POS', 'Anticipo', 'Abono Ya', 'Bridge', 'H2H', 'BO', 'SmartVista', 'API', 'Middleware', 'Portal', 'App Klap', 'Data Analytics', 'Otro'];
const celulaOptions = ['SmartVista', 'POS', 'Adquirencia', 'Adquirencia Clearing', 'Core', 'Boleta Electrónica y Multiservicios', 'Operaciones', 'QA', 'Infraestructura', 'Canales Presenciales', 'Otro'];
const impactOptions = ['Bajo', 'Medio', 'Alto', 'Crítico'];
const priorityOptions = ['Baja', 'Media', 'Alta', 'Urgente'];
const urgencyOptions = ['Normal', 'Bajo', 'Emergencia'];
const changeTypeOptions = ['Software', 'Infraestructura', 'Redes', 'Sistema Operativo / Utilidades', 'Base de Datos', 'Procedimiento', 'Seguridad', 'Datos'];
const businessOptions = ['PCI', 'Multiservicio', 'Verticales', 'No aplica'];
const environmentOptions = ['Producción', 'Pre-Producción', 'Sandbox', 'Ambiente Exclusivo Sodexo'];

const APPROVER_ROLES = ['Dueño Cambio', 'QA', 'DBA', 'Deployment', 'Release Management', 'Redes', 'Seguridad', 'Infraestructura', 'Arquitectura'];

const STEPS = [
  {
    title: 'General',
    help: 'Identifica el cambio, origen, sistema, fecha tentativa y clasificación básica.',
  },
  {
    title: 'Descripción',
    help: 'Explica qué cambia, por qué cambia, solución e impacto esperado.',
  },
  {
    title: 'Responsables',
    help: 'Define presentador, líder técnico, QA, validador y aprobadores CAB.',
  },
  {
    title: 'Revisión',
    help: 'Confirma el resumen antes de enviar el RDC al flujo CAB.',
  },
];

export default function RdcLitePage() {
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);
  const [createdRdcId, setCreatedRdcId] = useState('');
  const [approvalRoles, setApprovalRoles] = useState<Record<string, ApprovalRole[]>>({});
  const [approvalRolesLoading, setApprovalRolesLoading] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Mantención',
    system: '',
    cell: '',
    jiraOrigin: '',
    rfc: '',
    proposedDeployDate: '',
    presenter: '',
    technicalLead: '',
    qaAnalyst: '',
    businessValidator: '',

    requirementDescription: '',
    implementedSolution: '',
    affectedServices: '',
    affectedUsers: '',
    consequenceNotImplementing: '',
    validationPlan: '',

    changeType: 'Software',
    urgency: 'Normal',
    impactedBusiness: 'Verticales',
    environment: 'Producción',
    area: '',
    impact: 'Medio',
    priority: 'Media',
    affectedSystemsText: '',

    // Campos livianos para compatibilidad con backend/detalle.
    deploymentPlan: 'Plan operativo se completará en el módulo Plan PAP una vez aprobado el RDC.',
    rollbackPlan: 'Rollback detallado se completará en el módulo Plan PAP antes de la ejecución.',
    qaPlan: 'Plan QA/validación se completará y ajustará en Plan PAP.',
    repositories: '',
    mitigationPlan: '',
    dependentRdc: 'No aplica',

    requiresDba: false,
    requiresNetworks: false,
    requiresInfra: false,
    requiresMonitoring: false,

    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment'] as string[],
  });

  function update(name: string, value: string | boolean | string[]) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function loadApprovalRoles() {
    try {
      setApprovalRolesLoading(true);
      const response = await fetch('/api/approvals/roles', { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && data.ok) setApprovalRoles(data.grouped || {});
    } catch {
      setApprovalRoles({});
    } finally {
      setApprovalRolesLoading(false);
    }
  }

  useEffect(() => {
    loadApprovalRoles();
  }, []);

  function toggleApprovalRole(role: string) {
    setForm((current) => {
      const currentRoles = current.selectedApprovalRoles || [];
      const exists = currentRoles.includes(role);
      return {
        ...current,
        selectedApprovalRoles: exists ? currentRoles.filter((r) => r !== role) : [...currentRoles, role],
      };
    });
  }

  function getSelectedApprovalConfig() {
    return (form.selectedApprovalRoles || []).reduce((acc: Record<string, any>, role) => {
      const firstActiveApprover = approvalRoles[role]?.[0];
      if (firstActiveApprover) acc[role] = firstActiveApprover;
      return acc;
    }, {});
  }

  function buildFormData() {
    return {
      version: 'rdc_lite_1_0',
      mode: 'lite',
      classification: {
        changeType: form.changeType,
        urgency: form.urgency,
        category: form.category,
        impact: form.impact,
        priority: form.priority,
      },
      business: {
        impactedBusiness: form.impactedBusiness,
        environment: form.environment,
        area: form.area,
      },
      systemsAffected: {
        primarySystem: form.system,
        cell: form.cell,
        text: form.affectedSystemsText || `${form.system}${form.cell ? `, ${form.cell}` : ''}`,
      },
      planning: {
        papModuleRequired: true,
        note: 'Los pasos operativos, horarios, evidencias y checklist de despliegue se completan en el módulo Plan PAP después de la aprobación CAB.',
      },
      preRequirements: {
        networks: { applies: form.requiresNetworks, detail: form.requiresNetworks ? 'Requiere revisión en Plan PAP' : 'No aplica' },
        infrastructure: { applies: form.requiresInfra, detail: form.requiresInfra ? 'Requiere revisión en Plan PAP' : 'No aplica' },
        database: { applies: form.requiresDba, detail: form.requiresDba ? 'Requiere revisión DBA en Plan PAP' : 'No aplica' },
        monitoring: { required: form.requiresMonitoring, status: form.requiresMonitoring ? 'Completar monitoreo en Plan PAP' : 'No aplica' },
      },
      deployment: {
        qaPlan: form.qaPlan,
        productionPlan: form.deploymentPlan,
        rollback: form.rollbackPlan,
        mitigationPlanCab20: form.mitigationPlan,
      },
      pimComponents: [],
    };
  }

  function validateStep(s: number): string {
    if (s === 0) {
      if (!form.title.trim()) return 'Ponle un nombre al cambio.';
      if (!form.system) return 'Selecciona el sistema / producto.';
      if (!form.cell) return 'Selecciona la célula.';
      if (!form.proposedDeployDate) return 'Indica la fecha propuesta de paso a producción.';
    }

    if (s === 1) {
      if (!form.requirementDescription.trim() && !form.description.trim()) return 'Describe brevemente el requerimiento o alcance del cambio.';
      if (!form.implementedSolution.trim()) return 'Indica la solución o cambio que se implementará.';
      if (!form.impact) return 'Selecciona impacto.';
      if (!form.priority) return 'Selecciona prioridad.';
    }

    if (s === 2) {
      if (!form.presenter.trim()) return 'Indica el presentador.';
      if (!form.technicalLead.trim()) return 'Indica el líder técnico.';
      if (!form.selectedApprovalRoles.length) return 'Selecciona al menos un área aprobadora.';
    }

    return '';
  }

  function next() {
    const e = validateStep(step);
    if (e) { setStepError(e); return; }
    setStepError('');
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function back() {
    setStepError('');
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goTo(s: number) {
    if (s <= step) { setStepError(''); setStep(s); }
  }

  async function createRdc() {
    for (let s = 0; s < STEPS.length - 1; s++) {
      const e = validateStep(s);
      if (e) { setStep(s); setStepError(e); return; }
    }

    try {
      setSaving(true);
      setStepError('');

      const response = await fetch('/api/rdc/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, formData: buildFormData(), approvalRoleConfig: getSelectedApprovalConfig() }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'No fue posible crear el RDC');

      setCreatedRdcId(data.rdc?.id || '');
      setCreated(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      setStepError(error?.message || 'Error creando RDC');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="rdcLite">
      {created ? (
        <div className="done">
          <span className="check">✓</span>
          <h1>RDC registrado</h1>
          <p>
            Tu solicitud quedó registrada y lista para el flujo CAB. Una vez aprobada, Release Management podrá completar el Plan PAP con los pasos operativos del paso a producción.
          </p>
          <div className="doneActions">
            {createdRdcId ? <a className="primary" href={`/rdc/${createdRdcId}`}>Abrir RDC →</a> : null}
            <a className="ghostLink" href="/mis-cambios">Ver en Mis Cambios</a>
            <button type="button" className="ghost" onClick={() => window.location.reload()}>Registrar otro</button>
          </div>
        </div>
      ) : (
        <>
          <header className="head">
            <p className="kicker">REGISTRO DE CAMBIO · RDC LITE</p>
            <h1>Nuevo RDC</h1>
            <p className="sub">
              Captura lo necesario para evaluar y aprobar el cambio. Los pasos operativos del deploy se completan después en <b>Plan PAP</b>.
            </p>
          </header>

          <div className="stepper">
            {STEPS.map((s, i) => (
              <button
                key={s.title}
                type="button"
                className={`stp ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
                onClick={() => goTo(i)}
              >
                <b>{i < step ? '✓' : i + 1}</b>
                <span>{s.title}</span>
              </button>
            ))}
          </div>

          <form className="form" onSubmit={(e) => e.preventDefault()}>
            {step === 0 && (
              <>
                <div className="notice">
                  <b>RDC más liviano</b>
                  <span>La planificación operativa, horarios, pasos detallados, evidencias y checklist quedan para el módulo Plan PAP.</span>
                </div>

                <Block title="1. Identificación del cambio">
                  <Field label="Nombre del cambio *">
                    <input value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="[Paso Prod][MANT] Ajuste servicio POS" />
                  </Field>
                  <Field label="Categoría">
                    <select value={form.category} onChange={(e) => update('category', e.target.value)}>{categoriaOptions.map((o) => <option key={o}>{o}</option>)}</select>
                  </Field>
                  <Field label="Sistema / Producto *">
                    <select value={form.system} onChange={(e) => update('system', e.target.value)}>
                      <option value="">Selecciona</option>
                      {sistemaOptions.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </Field>
                  <Field label="Célula *">
                    <select value={form.cell} onChange={(e) => update('cell', e.target.value)}>
                      <option value="">Selecciona</option>
                      {celulaOptions.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </Field>
                  <Field label="Fecha propuesta de paso *">
                    <input type="date" value={form.proposedDeployDate} onChange={(e) => update('proposedDeployDate', e.target.value)} />
                  </Field>
                  <Field label="Área / negocio responsable">
                    <input value={form.area} onChange={(e) => update('area', e.target.value)} placeholder="Ej: Canales Presenciales" />
                  </Field>
                </Block>

                <Block title="2. Origen">
                  <Field label="Jira origen">
                    <input value={form.jiraOrigin} onChange={(e) => update('jiraOrigin', e.target.value)} placeholder="Ej: CNLS-1916 / BEMS-1692" />
                  </Field>
                  <Field label="RFC">
                    <input value={form.rfc} onChange={(e) => update('rfc', e.target.value)} placeholder="Ej: RFC-1234 / No aplica" />
                  </Field>
                </Block>
              </>
            )}

            {step === 1 && (
              <>
                <Block title="3. Qué cambia y por qué">
                  <Field label="Resumen ejecutivo">
                    <textarea value={form.description} onChange={(e) => update('description', e.target.value)} rows={3} placeholder="Resumen breve para CAB." />
                  </Field>
                  <Field label="Descripción del requerimiento *">
                    <textarea value={form.requirementDescription} onChange={(e) => update('requirementDescription', e.target.value)} rows={4} placeholder="Qué necesidad, problema o solicitud motiva este cambio." />
                  </Field>
                  <Field label="Solución / cambio implementado *">
                    <textarea value={form.implementedSolution} onChange={(e) => update('implementedSolution', e.target.value)} rows={4} placeholder="Qué se modificará o desplegará." />
                  </Field>
                  <Field label="Servicios / sistemas afectados">
                    <textarea value={form.affectedServices} onChange={(e) => update('affectedServices', e.target.value)} rows={3} placeholder="Servicios, APIs, aplicaciones o componentes afectados." />
                  </Field>
                  <Field label="Usuarios afectados">
                    <textarea value={form.affectedUsers} onChange={(e) => update('affectedUsers', e.target.value)} rows={3} placeholder="Clientes, comercios, usuarios internos, operaciones, etc." />
                  </Field>
                  <Field label="Consecuencia si no se implementa">
                    <textarea value={form.consequenceNotImplementing} onChange={(e) => update('consequenceNotImplementing', e.target.value)} rows={3} placeholder="Riesgo o impacto de no realizar el cambio." />
                  </Field>
                </Block>

                <Block title="4. Clasificación y riesgo">
                  <Field label="Tipo de cambio">
                    <select value={form.changeType} onChange={(e) => update('changeType', e.target.value)}>{changeTypeOptions.map((o) => <option key={o}>{o}</option>)}</select>
                  </Field>
                  <Field label="Urgencia">
                    <select value={form.urgency} onChange={(e) => update('urgency', e.target.value)}>{urgencyOptions.map((o) => <option key={o}>{o}</option>)}</select>
                  </Field>
                  <Field label="Impacto">
                    <select value={form.impact} onChange={(e) => update('impact', e.target.value)}>{impactOptions.map((o) => <option key={o}>{o}</option>)}</select>
                  </Field>
                  <Field label="Prioridad">
                    <select value={form.priority} onChange={(e) => update('priority', e.target.value)}>{priorityOptions.map((o) => <option key={o}>{o}</option>)}</select>
                  </Field>
                  <Field label="Negocio impactado">
                    <select value={form.impactedBusiness} onChange={(e) => update('impactedBusiness', e.target.value)}>{businessOptions.map((o) => <option key={o}>{o}</option>)}</select>
                  </Field>
                  <Field label="Ambiente">
                    <select value={form.environment} onChange={(e) => update('environment', e.target.value)}>{environmentOptions.map((o) => <option key={o}>{o}</option>)}</select>
                  </Field>
                </Block>

                <Block title="5. Requerimientos de apoyo">
                  <div className="checks">
                    <label><input type="checkbox" checked={form.requiresDba} onChange={(e) => update('requiresDba', e.target.checked)} /> Requiere DBA</label>
                    <label><input type="checkbox" checked={form.requiresNetworks} onChange={(e) => update('requiresNetworks', e.target.checked)} /> Requiere Redes</label>
                    <label><input type="checkbox" checked={form.requiresInfra} onChange={(e) => update('requiresInfra', e.target.checked)} /> Requiere Infraestructura</label>
                    <label><input type="checkbox" checked={form.requiresMonitoring} onChange={(e) => update('requiresMonitoring', e.target.checked)} /> Requiere Monitoreo</label>
                  </div>
                  <Field label="Sistemas afectados adicionales">
                    <textarea value={form.affectedSystemsText} onChange={(e) => update('affectedSystemsText', e.target.value)} rows={3} placeholder="Ej: POS, TMS Cloud, SmartVista. Detalle fino se completa en Plan PAP." />
                  </Field>
                </Block>
              </>
            )}

            {step === 2 && (
              <>
                <Block title="6. Responsables del cambio">
                  <Field label="Presentador *"><UserAutocomplete value={form.presenter} placeholder="Buscar presentador en Jira" onChange={(v) => update('presenter', v)} /></Field>
                  <Field label="Líder Técnico *"><UserAutocomplete value={form.technicalLead} placeholder="Buscar líder técnico en Jira" onChange={(v) => update('technicalLead', v)} /></Field>
                  <Field label="Analista QA"><UserAutocomplete value={form.qaAnalyst} placeholder="Buscar analista QA en Jira" onChange={(v) => update('qaAnalyst', v)} /></Field>
                  <Field label="Validador Negocio"><UserAutocomplete value={form.businessValidator} placeholder="Buscar validador en Jira" onChange={(v) => update('businessValidator', v)} /></Field>
                </Block>

                <Block title="7. Plan general">
                  <Field label="Plan de validación general">
                    <textarea value={form.validationPlan} onChange={(e) => update('validationPlan', e.target.value)} rows={3} placeholder="Validación general esperada. El detalle operativo se completa en Plan PAP." />
                  </Field>
                  <Field label="RDC dependiente">
                    <input value={form.dependentRdc} onChange={(e) => update('dependentRdc', e.target.value)} placeholder="No aplica / RDC relacionado" />
                  </Field>
                </Block>

                <Block title="8. Aprobadores CAB">
                  <div className="approvalIntro">
                    <p>Selecciona las áreas que deben aprobar este cambio. Al crear el RDC se generan aprobaciones pendientes con link y OTP.</p>
                    <p><b>Nota:</b> el Plan PAP se completará después de la aprobación CAB.</p>
                    {approvalRolesLoading ? <small>Cargando aprobadores configurados…</small> : null}
                  </div>
                  <div className="approvalRoles">
                    {APPROVER_ROLES.map((role) => {
                      const checked = form.selectedApprovalRoles.includes(role);
                      const approver = approvalRoles[role]?.[0];
                      return (
                        <label className={checked ? 'approvalRole active' : 'approvalRole'} key={role}>
                          <input type="checkbox" checked={checked} onChange={() => toggleApprovalRole(role)} />
                          <span><b>{role}</b><small>{approver?.approver_name || 'Aprobador por definir'}</small></span>
                        </label>
                      );
                    })}
                  </div>
                </Block>
              </>
            )}

            {step === 3 && (
              <>
                <section className="review">
                  <div className="reviewHead">
                    <div>
                      <p className="kicker">Resumen antes de enviar</p>
                      <h2>{form.title || 'RDC sin nombre'}</h2>
                      <p>{form.description || form.requirementDescription || 'Sin descripción'}</p>
                    </div>
                    <span>{form.impact} · {form.priority}</span>
                  </div>

                  <div className="reviewGrid">
                    <div><b>Sistema</b><span>{form.system || 'No informado'}</span></div>
                    <div><b>Célula</b><span>{form.cell || 'No informado'}</span></div>
                    <div><b>Categoría</b><span>{form.category}</span></div>
                    <div><b>Fecha propuesta</b><span>{form.proposedDeployDate || 'Sin fecha'}</span></div>
                    <div><b>Jira origen</b><span>{form.jiraOrigin || 'No informado'}</span></div>
                    <div><b>RFC</b><span>{form.rfc || 'No aplica'}</span></div>
                    <div><b>Presentador</b><span>{form.presenter || 'No informado'}</span></div>
                    <div><b>Líder técnico</b><span>{form.technicalLead || 'No informado'}</span></div>
                  </div>

                  <div className="papCallout">
                    <b>Después de aprobar CAB</b>
                    <span>El detalle operativo del despliegue se generará en el módulo <b>Plan PAP</b>: actividades, responsables, horarios, estados y evidencias.</span>
                  </div>

                  <div className="selectedApprovers">
                    <h3>Aprobadores seleccionados</h3>
                    <div>
                      {form.selectedApprovalRoles.map((role) => <span key={role}>{role}</span>)}
                    </div>
                  </div>
                </section>
              </>
            )}

            {stepError ? <div className="err">{stepError}</div> : null}

            <div className="wizNav">
              <button type="button" className="ghost" onClick={back} disabled={step === 0}>← Atrás</button>
              <span className="count">Paso {step + 1} de {STEPS.length}</span>
              {step < STEPS.length - 1 ? (
                <button type="button" onClick={next}>Siguiente →</button>
              ) : (
                <button type="button" onClick={createRdc} disabled={saving}>{saving ? 'Creando RDC…' : 'Crear RDC'}</button>
              )}
            </div>
          </form>
        </>
      )}

      <style jsx global>{`
        .rdcLite { max-width: 980px; margin: 0 auto; padding: 32px 6vw 64px; }
        .rdcLite .head { margin-bottom: 18px; }
        .rdcLite .kicker { color: var(--green-d); font-size: 13px; font-weight: 900; letter-spacing: .16em; margin: 0 0 8px; text-transform: uppercase; }
        .rdcLite h1 { font-size: clamp(34px, 5vw, 54px); line-height: 1.02; letter-spacing: -.055em; color: var(--navy-d); margin: 0; }
        .rdcLite .sub { color: var(--ink-soft); margin: 10px 0 0; font-size: 16px; line-height: 1.45; max-width: 760px; }
        .rdcLite .stepper { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 22px 0 24px; }
        .rdcLite .stp { display: flex; align-items: center; gap: 10px; text-align: left; background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 13px 12px; cursor: default; font: inherit; }
        .rdcLite .stp b { width: 28px; height: 28px; flex: none; display: flex; align-items: center; justify-content: center; border-radius: 999px; background: #eef4f8; color: var(--ink-soft); font-size: 13px; }
        .rdcLite .stp span { font-size: 13px; font-weight: 900; color: var(--ink-soft); line-height: 1.15; }
        .rdcLite .stp.active { border-color: #9be7bf; background: var(--green-soft); }
        .rdcLite .stp.active b { background: var(--green); color: #fff; }
        .rdcLite .stp.active span { color: var(--navy-d); }
        .rdcLite .stp.done { cursor: pointer; }
        .rdcLite .stp.done b { background: var(--navy); color: #fff; }
        .rdcLite .form { background: #fff; border: 1px solid var(--line); border-radius: 22px; padding: 22px; display: grid; gap: 18px; box-shadow: 0 18px 45px rgba(7,59,93,.06); }
        .rdcLite .notice, .rdcLite .papCallout { background: #ecfdf4; border: 1px solid #bbf7d0; color: #007d4f; border-radius: 16px; padding: 14px; display: grid; gap: 4px; }
        .rdcLite .notice span, .rdcLite .papCallout span { color: #246b50; }
        .rdcLite .block, .rdcLite .review { background: #f8fbfd; border: 1px solid #e5eef3; border-radius: 18px; padding: 18px; }
        .rdcLite .block h2 { margin: 0 0 14px; font-size: 19px; letter-spacing: -.02em; color: var(--navy-d); }
        .rdcLite .fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .rdcLite .field { display: grid; gap: 7px; }
        .rdcLite .field.wide { grid-column: 1 / -1; }
        .rdcLite label { font-size: 13px; font-weight: 800; color: #315873; }
        .rdcLite input, .rdcLite select, .rdcLite textarea { width: 100%; border: 1px solid #d9e7ef; background: #fff; border-radius: 12px; padding: 12px 13px; font: inherit; color: var(--ink); outline: none; min-height: 48px; }
        .rdcLite input:focus, .rdcLite select:focus, .rdcLite textarea:focus { border-color: var(--green); box-shadow: 0 0 0 3px rgba(0,193,110,.12); }
        .rdcLite textarea { resize: vertical; }
        .rdcLite .checks { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .rdcLite .checks label { display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid #d9e7ef; border-radius: 12px; padding: 12px; }
        .rdcLite .checks input { width: auto; min-height: auto; }
        .rdcLite .approvalIntro { grid-column: 1 / -1; color: var(--ink-soft); line-height: 1.45; }
        .rdcLite .approvalIntro p { margin: 0 0 8px; }
        .rdcLite .approvalIntro small { color: var(--green-d); font-weight: 900; }
        .rdcLite .approvalRoles { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .rdcLite .approvalRole { display: flex; gap: 12px; align-items: flex-start; background: #fff; border: 1px solid #d9e7ef; border-radius: 14px; padding: 14px; cursor: pointer; }
        .rdcLite .approvalRole.active { border-color: #9be7bf; background: #f0fff7; }
        .rdcLite .approvalRole input { width: auto; min-height: auto; margin-top: 4px; }
        .rdcLite .approvalRole b { display: block; color: var(--navy-d); }
        .rdcLite .approvalRole small { display: block; color: var(--ink-soft); margin-top: 3px; font-weight: 700; }
        .rdcLite .reviewHead { display: flex; justify-content: space-between; gap: 18px; }
        .rdcLite .reviewHead h2 { margin: 0 0 8px; font-size: 30px; color: var(--navy-d); letter-spacing: -.04em; }
        .rdcLite .reviewHead p { color: var(--ink-soft); margin: 0; line-height: 1.45; }
        .rdcLite .reviewHead span { background: #fff7e6; color: #9a6700; border-radius: 999px; padding: 10px 13px; font-weight: 900; height: max-content; }
        .rdcLite .reviewGrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
        .rdcLite .reviewGrid div { background: #fff; border: 1px solid #d9e7ef; border-radius: 14px; padding: 12px; }
        .rdcLite .reviewGrid b, .rdcLite .reviewGrid span { display: block; }
        .rdcLite .reviewGrid b { color: var(--ink-soft); font-size: 12px; margin-bottom: 6px; }
        .rdcLite .reviewGrid span { color: var(--navy-d); font-weight: 800; }
        .rdcLite .selectedApprovers h3 { margin: 16px 0 8px; color: var(--navy-d); }
        .rdcLite .selectedApprovers div { display: flex; flex-wrap: wrap; gap: 8px; }
        .rdcLite .selectedApprovers span { background: #ecf7ff; color: #02568c; border-radius: 999px; padding: 8px 11px; font-weight: 900; font-size: 12px; }
        .rdcLite .err { background: #fff1f0; border: 1px solid #ffd0cb; color: #c0392b; padding: 12px 14px; border-radius: 12px; font-weight: 800; font-size: 14px; }
        .rdcLite .wizNav { display: flex; align-items: center; gap: 14px; }
        .rdcLite .count { color: var(--ink-soft); font-size: 13px; font-weight: 800; margin-right: auto; }
        .rdcLite button { border: 0; background: var(--green); color: #fff; border-radius: 999px; padding: 13px 20px; font-weight: 900; cursor: pointer; }
        .rdcLite button:disabled { opacity: .55; cursor: not-allowed; }
        .rdcLite button.ghost, .rdcLite .ghostLink { background: #fff; color: var(--navy); border: 1px solid var(--line); padding: 13px 20px; border-radius: 999px; font-weight: 900; }
        .rdcLite .autocomplete { position: relative; }
        .rdcLite .suggestions { position: absolute; z-index: 20; top: calc(100% + 6px); left: 0; right: 0; background: #fff; border: 1px solid #d9e7ef; border-radius: 14px; box-shadow: 0 18px 45px rgba(7,59,93,.14); overflow: hidden; }
        .rdcLite .suggestion { width: 100%; border: 0; border-radius: 0; background: #fff; color: var(--ink); display: flex; align-items: center; gap: 10px; padding: 11px 12px; text-align: left; cursor: pointer; font-weight: 700; }
        .rdcLite .suggestion:hover { background: var(--bg); }
        .rdcLite .suggestion img { width: 26px; height: 26px; border-radius: 999px; }
        .rdcLite .suggestion small { display: block; color: var(--ink-soft); font-weight: 600; }
        .rdcLite .suggestionEmpty { padding: 12px; color: var(--ink-soft); font-size: 13px; }
        .rdcLite .done { background: #fff; border: 1px solid var(--line); border-radius: 22px; padding: 44px; text-align: center; max-width: 620px; margin: 40px auto; box-shadow: 0 18px 45px rgba(7,59,93,.06); }
        .rdcLite .done .check { display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 999px; background: var(--green-soft); color: var(--green-d); font-size: 28px; font-weight: 900; }
        .rdcLite .done h1 { margin: 18px 0 8px; }
        .rdcLite .done p { color: var(--ink-soft); line-height: 1.5; margin: 0 0 24px; }
        .rdcLite .doneActions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .rdcLite .doneActions .primary { background: var(--green); color: #fff; padding: 13px 20px; border-radius: 999px; font-weight: 900; }
        @media (max-width: 960px) { .rdcLite .stepper { grid-template-columns: repeat(2, 1fr); } .rdcLite .reviewGrid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 760px) {
          .rdcLite .stepper, .rdcLite .fields, .rdcLite .checks, .rdcLite .approvalRoles, .rdcLite .reviewGrid { grid-template-columns: 1fr; }
          .rdcLite .wizNav, .rdcLite .reviewHead { flex-wrap: wrap; flex-direction: column; align-items: flex-start; }
          .rdcLite .wizNav button { width: 100%; }
        }
      `}</style>
    </main>
  );
}

function UserAutocomplete({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (value: string) => void }) {
  const [query, setQuery] = useState(value || '');
  const [users, setUsers] = useState<JiraUser[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setQuery(value || ''); }, [value]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) { setUsers([]); setLoading(false); return; }

    timer.current = setTimeout(async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/jira/users?q=${encodeURIComponent(trimmed)}&query=${encodeURIComponent(trimmed)}&search=${encodeURIComponent(trimmed)}`, { cache: 'no-store' });
        const data = await response.json();
        const rawList = Array.isArray(data) ? data
          : Array.isArray(data.users) ? data.users
          : Array.isArray(data.results) ? data.results
          : Array.isArray(data.values) ? data.values
          : Array.isArray(data.data) ? data.data : [];
        const list = rawList.map((item: any) => ({
          accountId: item.accountId || item.id || item.account_id,
          displayName: item.displayName || item.name || item.label || item.value || item.emailAddress || item.email,
          emailAddress: item.emailAddress || item.email || item.mail,
          avatarUrl: item.avatarUrl || item.avatarUrls?.['24x24'] || item.avatarUrls?.['32x32'] || item.avatarUrls?.['48x48'] || item.picture || '',
        })).filter((item: JiraUser) => item.displayName);
        setUsers(list);
        setOpen(true);
      } catch {
        setUsers([]); setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  function selectUser(user: JiraUser) {
    const name = user.displayName || user.emailAddress || '';
    setQuery(name); onChange(name); setOpen(false);
  }

  return (
    <div className="autocomplete">
      <input
        value={query}
        onChange={(event) => { setQuery(event.target.value); onChange(event.target.value); setOpen(true); }}
        onFocus={() => { if (users.length > 0) setOpen(true); }}
        onBlur={() => { setTimeout(() => setOpen(false), 160); }}
        placeholder={placeholder}
      />
      {open && query.trim().length >= 2 ? (
        <div className="suggestions">
          {loading ? <div className="suggestionEmpty">Buscando usuarios…</div> : null}
          {!loading && users.length === 0 ? <div className="suggestionEmpty">Sin resultados para “{query}”</div> : null}
          {!loading && users.map((user) => (
            <button type="button" className="suggestion" key={user.accountId || user.emailAddress || user.displayName} onMouseDown={(e) => e.preventDefault()} onClick={() => selectUser(user)}>
              {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : null}
              <span>{user.displayName || user.emailAddress}{user.emailAddress ? <small>{user.emailAddress}</small> : null}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="block">
      <h2>{title}</h2>
      <div className="fields">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const wide = ['Resumen', 'Descripción', 'Solución', 'Servicios', 'Usuarios', 'Consecuencia', 'Sistemas', 'Plan'].some((w) => label.includes(w));
  return (
    <div className={wide ? 'field wide' : 'field'}>
      <label>{label}</label>
      {children}
    </div>
  );
}

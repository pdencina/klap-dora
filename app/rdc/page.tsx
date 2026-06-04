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

type PimComponent = {
  component: string;
  version: string;
  status: string;
  observation: string;
};

const categoriaOptions = ['Mantención', 'Proyecto', 'Incidente', 'Hotfix', 'ECAB', 'Recurrente'];
const sistemaOptions = ['POS', 'Anticipo', 'Abono Ya', 'Bridge', 'H2H', 'BO', 'SmartVista', 'API', 'Middleware', 'Portal', 'App Klap', 'Data Analytics', 'Otro'];
const celulaOptions = ['SmartVista', 'POS', 'Adquirencia', 'Adquirencia Clearing', 'Core', 'Boleta Electrónica y Multiservicios', 'Operaciones', 'QA', 'Infraestructura', 'Canales Presenciales', 'Otro'];

const changeTypeOptions = ['Software', 'Infraestructura', 'Redes', 'Sistema Operativo / Utilidades', 'Base de Datos', 'Procedimiento', 'Seguridad', 'Datos'];
const urgencyOptions = ['Emergencia', 'Normal', 'Bajo'];
const businessOptions = ['PCI', 'Multiservicio', 'Verticales', 'No aplica'];
const environmentOptions = ['Producción', 'Pre-Producción', 'Sandbox', 'Ambiente Exclusivo Sodexo'];
const impactOptions = ['Bajo', 'Medio', 'Alto', 'Crítico'];
const priorityOptions = ['Baja', 'Media', 'Alta', 'Urgente'];
const simpleStatusOptions = ['No aplica', 'Aplica', 'Pendiente', 'Revisado OK', 'Revisado NO OK'];
const monitoringOptions = ['No aplica, el servicio ya está monitoreado', 'Sí, el servicio es nuevo', 'No aplica'];
const scheduleOptions = ['Sin restricción', 'Con restricción', 'Día y hora coordinada con Deployment'];
const assistanceOptions = ['No aplica', 'Semi asistido', 'Asistido'];
const programmedCutOptions = ['No aplica corte programado', 'Aplica corte programado'];
const cutImpactOptions = ['No aplica', 'Bajo (1 a 4 comercios)', 'Medio (5 a 20 comercios)', 'Alto (Mayor a 20 comercios)'];
const pimStatusOptions = ['Pendiente', 'Error de Despliegue', 'Instalado en QA', 'Certificado', 'Listo para PROD'];

const STEPS = [
  { title: 'General y origen', help: 'Identifica el cambio, sistema, célula y origen Jira/RFC.' },
  { title: 'Descripción del cambio', help: 'Explica necesidad, solución, servicios, usuarios y validación.' },
  { title: 'Clasificación y negocio', help: 'Clasifica el cambio, ambiente, negocio impactado, urgencia, impacto y prioridad.' },
  { title: 'Requisitos previos', help: 'Registra redes, infraestructura, BD, monitoreo, diagrama, deprecación y respaldos.' },
  { title: 'Ejecución', help: 'Define horario, asistencia, comunicación, corte programado y dependencias.' },
  { title: 'Despliegue y aprobadores', help: 'Documenta QA, producción, rollback, componentes PIM y aprobadores CAB.' },
];

const APPROVER_ROLES = ['Dueño Cambio', 'QA', 'DBA', 'Deployment', 'Release Management', 'Redes', 'Seguridad', 'Infraestructura', 'Arquitectura'];

const defaultPimComponent: PimComponent = {
  component: '',
  version: '',
  status: 'Listo para PROD',
  observation: '',
};

export default function RdcPage() {
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
    presenter: '',
    technicalLead: '',
    qaAnalyst: '',
    businessValidator: '',
    jiraOrigin: '',
    rfc: '',
    proposedDeployDate: '',

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

    requiresDba: false,
    requiresNetworks: false,
    requiresInfra: false,
    requiresMonitoring: false,
    networkRequirementDetail: '',
    infraRequirementDetail: '',
    databaseRequirementDetail: '',
    criticalDbApplies: 'No aplica',
    criticalDbReviewer: '',
    criticalDbResult: 'No aplica',
    itServiceTicket: '',
    technicalDiagramApplies: 'No aplica',
    technicalDiagramUrl: '',
    monitoringStatus: 'No aplica, el servicio ya está monitoreado',
    monitoringService: '',
    deprecatesComponent: 'No depreca componente(s)',
    deprecatedComponentName: '',
    backupBeforeDelete: 'No aplica',

    scheduleRestriction: 'Día y hora coordinada con Deployment',
    executionWindow: '',
    assistanceType: 'No aplica',
    assistancePeople: '',
    commerceCommunication72h: false,
    programmedCut: 'No aplica corte programado',
    cutImpact: 'No aplica',
    cutEvidence: '',
    dependentRdc: '',

    qaPlan: '',
    repositories: '',
    deploymentPlan: '',
    rollbackPlan: '',
    mitigationPlan: '',
    backupApp: 'No aplica',
    backupDatabase: 'No aplica',
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment'] as string[],
    pimComponents: [{ ...defaultPimComponent }] as PimComponent[],
  });

  function update(name: string, value: string | boolean | string[] | PimComponent[]) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updatePim(index: number, key: keyof PimComponent, value: string) {
    const next = [...form.pimComponents];
    next[index] = { ...next[index], [key]: value };
    update('pimComponents', next);
  }

  function addPimComponent() {
    update('pimComponents', [...form.pimComponents, { ...defaultPimComponent }]);
  }

  function removePimComponent(index: number) {
    update('pimComponents', form.pimComponents.filter((_, i) => i !== index));
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
      version: 'rdc_2_0',
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
        text: form.affectedSystemsText,
      },
      preRequirements: {
        networks: {
          applies: form.requiresNetworks,
          detail: form.networkRequirementDetail,
        },
        infrastructure: {
          applies: form.requiresInfra,
          detail: form.infraRequirementDetail,
        },
        database: {
          applies: form.requiresDba,
          detail: form.databaseRequirementDetail,
        },
        criticalDatabase: {
          applies: form.criticalDbApplies,
          reviewer: form.criticalDbReviewer,
          result: form.criticalDbResult,
          itServiceTicket: form.itServiceTicket,
        },
        technicalDiagram: {
          applies: form.technicalDiagramApplies,
          url: form.technicalDiagramUrl,
        },
        monitoring: {
          required: form.requiresMonitoring,
          status: form.monitoringStatus,
          service: form.monitoringService,
        },
        deprecation: {
          status: form.deprecatesComponent,
          componentName: form.deprecatedComponentName,
          backupBeforeDelete: form.backupBeforeDelete,
        },
      },
      execution: {
        scheduleRestriction: form.scheduleRestriction,
        executionWindow: form.executionWindow,
        assistanceType: form.assistanceType,
        assistancePeople: form.assistancePeople,
        commerceCommunication72h: form.commerceCommunication72h,
        programmedCut: form.programmedCut,
        cutImpact: form.cutImpact,
        cutEvidence: form.cutEvidence,
        dependentRdc: form.dependentRdc,
      },
      deployment: {
        qaPlan: form.qaPlan,
        repositories: form.repositories,
        productionPlan: form.deploymentPlan,
        rollback: form.rollbackPlan,
        mitigationPlanCab20: form.mitigationPlan,
        backups: {
          appJarWar: form.backupApp,
          database: form.backupDatabase,
        },
      },
      pimComponents: form.pimComponents.filter((item) => item.component || item.version || item.observation),
    };
  }

  useEffect(() => {
    loadApprovalRoles();
  }, []);

  function validateStep(s: number): string {
    if (s === 0) {
      if (!form.title.trim()) return 'Ponle un nombre al cambio.';
      if (!form.system) return 'Selecciona el sistema / producto.';
      if (!form.cell) return 'Selecciona la célula.';
    }

    if (s === 1) {
      if (!form.requirementDescription.trim() && !form.description.trim()) return 'Describe el requerimiento o el alcance del cambio.';
      if (!form.implementedSolution.trim()) return 'Indica la solución implementada.';
    }

    if (s === 2) {
      if (!form.area.trim()) return 'Indica el área responsable o negocio.';
      if (!form.impact) return 'Selecciona el impacto.';
      if (!form.priority) return 'Selecciona la prioridad.';
    }

    if (s === 4) {
      if (!form.proposedDeployDate) return 'Indica la fecha propuesta de paso a producción.';
    }

    if (s === 5) {
      if (!form.deploymentPlan.trim()) return 'Indica el plan de despliegue en producción.';
      if (!form.rollbackPlan.trim()) return 'Indica el plan de rollback.';
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
    for (let s = 0; s < STEPS.length; s++) {
      const e = validateStep(s);
      if (e) { setStep(s); setStepError(e); return; }
    }

    try {
      setSaving(true);
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
    <main className="rdc">
      {created ? (
        <div className="done">
          <span className="check">✓</span>
          <h1>RDC registrado</h1>
          <p>Tu cambio quedó guardado con estructura RDC 2.0, se generaron las aprobaciones por área y quedó listo para seguimiento CAB.</p>
          <div className="doneActions">
            {createdRdcId ? <a className="primary" href={`/rdc/${createdRdcId}`}>Abrir RDC →</a> : null}
            <a className="ghostLink" href="/mis-cambios">Ver en Mis Cambios</a>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setCreated(false);
                setCreatedRdcId('');
                setStep(0);
                setStepError('');
              }}
            >
              Registrar otro
            </button>
          </div>
        </div>
      ) : (
        <>
          <header className="head">
            <p className="kicker">REGISTRO DE CAMBIO · RDC 2.0</p>
            <h1>Nuevo RDC</h1>
            <p className="sub">{STEPS[step].help}</p>
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
                <Block title="1. Información general">
                  <Field label="Nombre del cambio *">
                    <input value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="[Paso Prod][MANT] Ajuste servicio POS" />
                  </Field>
                  <Field label="Resumen / Alcance corto">
                    <textarea value={form.description} onChange={(e) => update('description', e.target.value)} rows={4} placeholder="Resumen ejecutivo breve del cambio." />
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
                  <Field label="Área">
                    <input value={form.area} onChange={(e) => update('area', e.target.value)} placeholder="Ej: Canales Presenciales" />
                  </Field>
                </Block>

                <Block title="2. Origen del cambio">
                  <Field label="Jira Origen">
                    <input value={form.jiraOrigin} onChange={(e) => update('jiraOrigin', e.target.value)} placeholder="Ej: CNLS-1916 / BEMS-1692 / TRX-931" />
                  </Field>
                  <Field label="RFC">
                    <input value={form.rfc} onChange={(e) => update('rfc', e.target.value)} placeholder="Ej: RFC-1234 / No aplica" />
                  </Field>
                </Block>

                <Block title="3. Responsables">
                  <Field label="Presentador"><UserAutocomplete value={form.presenter} placeholder="Buscar presentador en Jira" onChange={(v) => update('presenter', v)} /></Field>
                  <Field label="Líder Técnico"><UserAutocomplete value={form.technicalLead} placeholder="Buscar líder técnico en Jira" onChange={(v) => update('technicalLead', v)} /></Field>
                  <Field label="Analista QA"><UserAutocomplete value={form.qaAnalyst} placeholder="Buscar analista QA en Jira" onChange={(v) => update('qaAnalyst', v)} /></Field>
                  <Field label="Validador Negocio"><UserAutocomplete value={form.businessValidator} placeholder="Buscar validador en Jira" onChange={(v) => update('businessValidator', v)} /></Field>
                </Block>
              </>
            )}

            {step === 1 && (
              <>
                <Block title="4. Descripción del cambio">
                  <Field label="Descripción del requerimiento *"><textarea value={form.requirementDescription} onChange={(e) => update('requirementDescription', e.target.value)} rows={5} placeholder="Qué necesidad o problema resuelve el cambio." /></Field>
                  <Field label="Solución implementada *"><textarea value={form.implementedSolution} onChange={(e) => update('implementedSolution', e.target.value)} rows={4} placeholder="Qué se modificó o implementó técnicamente." /></Field>
                  <Field label="Servicios afectados"><textarea value={form.affectedServices} onChange={(e) => update('affectedServices', e.target.value)} rows={3} placeholder="APIs, módulos, componentes, apps o servicios impactados." /></Field>
                  <Field label="Usuarios afectados"><textarea value={form.affectedUsers} onChange={(e) => update('affectedUsers', e.target.value)} rows={3} placeholder="Clientes, comercios, operaciones, usuarios internos, etc." /></Field>
                  <Field label="Consecuencia si no se implementa"><textarea value={form.consequenceNotImplementing} onChange={(e) => update('consequenceNotImplementing', e.target.value)} rows={3} placeholder="Riesgo de posponer o no aprobar el cambio." /></Field>
                  <Field label="Plan de validación"><textarea value={form.validationPlan} onChange={(e) => update('validationPlan', e.target.value)} rows={4} placeholder="Cómo se validará luego de la implementación." /></Field>
                </Block>
              </>
            )}

            {step === 2 && (
              <>
                <Block title="5. Clasificación del cambio">
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
                </Block>

                <Block title="6. Negocio y ambiente">
                  <Field label="Negocio impactado">
                    <select value={form.impactedBusiness} onChange={(e) => update('impactedBusiness', e.target.value)}>{businessOptions.map((o) => <option key={o}>{o}</option>)}</select>
                  </Field>
                  <Field label="Ambiente">
                    <select value={form.environment} onChange={(e) => update('environment', e.target.value)}>{environmentOptions.map((o) => <option key={o}>{o}</option>)}</select>
                  </Field>
                  <Field label="Sistema(s) afectado(s)">
                    <textarea value={form.affectedSystemsText} onChange={(e) => update('affectedSystemsText', e.target.value)} rows={4} placeholder="Ej: POS, App Ticketing EFE, SmartVista. En V2 se puede transformar en catálogo completo 1.x–17.x." />
                  </Field>
                </Block>
              </>
            )}

            {step === 3 && (
              <>
                <Block title="7. Requisitos previos">
                  <div className="checks">
                    <label><input type="checkbox" checked={form.requiresNetworks} onChange={(e) => update('requiresNetworks', e.target.checked)} /> Requisitos de Redes</label>
                    <label><input type="checkbox" checked={form.requiresInfra} onChange={(e) => update('requiresInfra', e.target.checked)} /> Requisitos de Infraestructura</label>
                    <label><input type="checkbox" checked={form.requiresDba} onChange={(e) => update('requiresDba', e.target.checked)} /> Requisitos de Base de Datos</label>
                    <label><input type="checkbox" checked={form.requiresMonitoring} onChange={(e) => update('requiresMonitoring', e.target.checked)} /> Requiere Monitoreo</label>
                  </div>
                  <Field label="Detalle Redes"><textarea value={form.networkRequirementDetail} onChange={(e) => update('networkRequirementDetail', e.target.value)} rows={3} placeholder="No aplica / detalle de redes." /></Field>
                  <Field label="Detalle Infraestructura"><textarea value={form.infraRequirementDetail} onChange={(e) => update('infraRequirementDetail', e.target.value)} rows={3} placeholder="No aplica / detalle de infraestructura." /></Field>
                  <Field label="Detalle Base de Datos"><textarea value={form.databaseRequirementDetail} onChange={(e) => update('databaseRequirementDetail', e.target.value)} rows={3} placeholder="No aplica / detalle BD." /></Field>
                </Block>

                <Block title="8. BD crítica, diagrama y monitoreo">
                  <Field label="BD crítica">
                    <select value={form.criticalDbApplies} onChange={(e) => update('criticalDbApplies', e.target.value)}>{simpleStatusOptions.map((o) => <option key={o}>{o}</option>)}</select>
                  </Field>
                  <Field label="DBA revisor">
                    <input value={form.criticalDbReviewer} onChange={(e) => update('criticalDbReviewer', e.target.value)} placeholder="Nombre DBA revisor / No aplica" />
                  </Field>
                  <Field label="Resultado revisión BD">
                    <select value={form.criticalDbResult} onChange={(e) => update('criticalDbResult', e.target.value)}>{simpleStatusOptions.map((o) => <option key={o}>{o}</option>)}</select>
                  </Field>
                  <Field label="Ticket IT Service">
                    <input value={form.itServiceTicket} onChange={(e) => update('itServiceTicket', e.target.value)} placeholder="No aplica / ticket" />
                  </Field>
                  <Field label="Diagrama técnico">
                    <select value={form.technicalDiagramApplies} onChange={(e) => update('technicalDiagramApplies', e.target.value)}>{['Aplica', 'No aplica'].map((o) => <option key={o}>{o}</option>)}</select>
                  </Field>
                  <Field label="Link diagrama">
                    <input value={form.technicalDiagramUrl} onChange={(e) => update('technicalDiagramUrl', e.target.value)} placeholder="URL Confluence / Jira / No aplica" />
                  </Field>
                  <Field label="Estado monitoreo">
                    <select value={form.monitoringStatus} onChange={(e) => update('monitoringStatus', e.target.value)}>{monitoringOptions.map((o) => <option key={o}>{o}</option>)}</select>
                  </Field>
                  <Field label="Servicio a monitorear">
                    <input value={form.monitoringService} onChange={(e) => update('monitoringService', e.target.value)} placeholder="No aplica / servicio" />
                  </Field>
                </Block>

                <Block title="9. Deprecación y respaldo">
                  <Field label="¿Depreca componente?">
                    <select value={form.deprecatesComponent} onChange={(e) => update('deprecatesComponent', e.target.value)}>{['Si depreca componente(s)', 'No depreca componente(s)', 'No aplica'].map((o) => <option key={o}>{o}</option>)}</select>
                  </Field>
                  <Field label="Componente a deprecar">
                    <input value={form.deprecatedComponentName} onChange={(e) => update('deprecatedComponentName', e.target.value)} placeholder="No aplica / nombre componente" />
                  </Field>
                  <Field label="¿Se realizó respaldo antes de eliminar?">
                    <select value={form.backupBeforeDelete} onChange={(e) => update('backupBeforeDelete', e.target.value)}>{['Sí', 'No', 'No aplica'].map((o) => <option key={o}>{o}</option>)}</select>
                  </Field>
                </Block>
              </>
            )}

            {step === 4 && (
              <>
                <Block title="10. Ejecución">
                  <Field label="Fecha propuesta paso a producción *">
                    <input type="date" value={form.proposedDeployDate} onChange={(e) => update('proposedDeployDate', e.target.value)} />
                  </Field>
                  <Field label="Horario de ejecución">
                    <select value={form.scheduleRestriction} onChange={(e) => update('scheduleRestriction', e.target.value)}>{scheduleOptions.map((o) => <option key={o}>{o}</option>)}</select>
                  </Field>
                  <Field label="Ventana / coordinación Deployment">
                    <input value={form.executionWindow} onChange={(e) => update('executionWindow', e.target.value)} placeholder="Ej: 23:00 a 23:30 / coordinado con Deployment" />
                  </Field>
                  <Field label="Asistencia">
                    <select value={form.assistanceType} onChange={(e) => update('assistanceType', e.target.value)}>{assistanceOptions.map((o) => <option key={o}>{o}</option>)}</select>
                  </Field>
                  <Field label="Personas que asistirán">
                    <input value={form.assistancePeople} onChange={(e) => update('assistancePeople', e.target.value)} placeholder="Desarrolladores / DBA / Operaciones / No aplica" />
                  </Field>
                  <Field label="RDC dependiente">
                    <input value={form.dependentRdc} onChange={(e) => update('dependentRdc', e.target.value)} placeholder="Ej: RDC-2026-001 / No aplica" />
                  </Field>
                </Block>

                <Block title="11. Comunicación y corte programado">
                  <div className="checks">
                    <label><input type="checkbox" checked={form.commerceCommunication72h} onChange={(e) => update('commerceCommunication72h', e.target.checked)} /> Comunicación a comercios 72h antes</label>
                  </div>
                  <Field label="Corte programado">
                    <select value={form.programmedCut} onChange={(e) => update('programmedCut', e.target.value)}>{programmedCutOptions.map((o) => <option key={o}>{o}</option>)}</select>
                  </Field>
                  <Field label="Impacto corte programado">
                    <select value={form.cutImpact} onChange={(e) => update('cutImpact', e.target.value)}>{cutImpactOptions.map((o) => <option key={o}>{o}</option>)}</select>
                  </Field>
                  <Field label="Evidencia comunicación/corte">
                    <input value={form.cutEvidence} onChange={(e) => update('cutEvidence', e.target.value)} placeholder="URL Jira/Confluence/Teams / No aplica" />
                  </Field>
                </Block>
              </>
            )}

            {step === 5 && (
              <>
                <Block title="12. Plan QA, repositorios y respaldos">
                  <Field label="Plan QA"><textarea value={form.qaPlan} onChange={(e) => update('qaPlan', e.target.value)} rows={4} placeholder="Plan de despliegue/certificación QA." /></Field>
                  <Field label="Repositorios"><textarea value={form.repositories} onChange={(e) => update('repositories', e.target.value)} rows={3} placeholder="GitLab / Bitbucket / No aplica." /></Field>
                  <Field label="Respaldo App-Jar-War"><textarea value={form.backupApp} onChange={(e) => update('backupApp', e.target.value)} rows={3} placeholder="No aplica / detalle respaldo." /></Field>
                  <Field label="Respaldo Base de Datos"><textarea value={form.backupDatabase} onChange={(e) => update('backupDatabase', e.target.value)} rows={3} placeholder="No aplica / detalle respaldo BD." /></Field>
                </Block>

                <Block title="13. Despliegue producción y rollback">
                  <Field label="Plan Deploy producción *"><textarea value={form.deploymentPlan} onChange={(e) => update('deploymentPlan', e.target.value)} rows={5} placeholder="Pasos para realizar el paso a producción." /></Field>
                  <Field label="Plan Rollback *"><textarea value={form.rollbackPlan} onChange={(e) => update('rollbackPlan', e.target.value)} rows={5} placeholder="Pasos para volver a la última configuración estable." /></Field>
                  <Field label="Plan Mitigación CAB 2.0"><textarea value={form.mitigationPlan} onChange={(e) => update('mitigationPlan', e.target.value)} rows={4} placeholder="Mitigación en caso de requerir al momento del despliegue." /></Field>
                </Block>

                <Block title="14. PIM - Componentes de Software">
                  <div className="pimList">
                    {form.pimComponents.map((item, index) => (
                      <div className="pimRow" key={index}>
                        <Field label="Componente">
                          <input value={item.component} onChange={(e) => updatePim(index, 'component', e.target.value)} placeholder="Ej: App Ticketing EFE" />
                        </Field>
                        <Field label="Versión">
                          <input value={item.version} onChange={(e) => updatePim(index, 'version', e.target.value)} placeholder="Ej: 8.1.9" />
                        </Field>
                        <Field label="Estado">
                          <select value={item.status} onChange={(e) => updatePim(index, 'status', e.target.value)}>{pimStatusOptions.map((o) => <option key={o}>{o}</option>)}</select>
                        </Field>
                        <Field label="Observación">
                          <input value={item.observation} onChange={(e) => updatePim(index, 'observation', e.target.value)} placeholder="No aplica / detalle" />
                        </Field>
                        {form.pimComponents.length > 1 ? <button type="button" className="ghost remove" onClick={() => removePimComponent(index)}>Quitar</button> : null}
                      </div>
                    ))}
                    <button type="button" className="ghost" onClick={addPimComponent}>+ Agregar componente</button>
                  </div>
                </Block>

                <Block title="15. Aprobadores requeridos">
                  <div className="approvalIntro">
                    <p>Selecciona las áreas que deben aprobar este cambio. Al crear el RDC se generan aprobaciones pendientes con link y OTP.</p>
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
        .rdc { max-width: 980px; margin: 0 auto; padding: 32px 6vw 64px; }
        .rdc .head { margin-bottom: 18px; }
        .rdc .kicker { color: var(--green-d); font-size: 13px; font-weight: 800; letter-spacing: .16em; margin: 0 0 8px; }
        .rdc h1 { font-size: clamp(30px, 4vw, 44px); line-height: 1.05; letter-spacing: -.03em; color: var(--navy-d); margin: 0; }
        .rdc .sub { color: var(--ink-soft); margin: 10px 0 0; font-size: 16px; }
        .rdc .stepper { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin: 22px 0 24px; }
        .rdc .stp { display: flex; align-items: center; gap: 10px; text-align: left; background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 12px 10px; cursor: default; font: inherit; }
        .rdc .stp b { width: 26px; height: 26px; flex: none; display: flex; align-items: center; justify-content: center; border-radius: 999px; background: #eef4f8; color: var(--ink-soft); font-size: 13px; }
        .rdc .stp span { font-size: 12px; font-weight: 800; color: var(--ink-soft); line-height: 1.15; }
        .rdc .stp.active { border-color: #9be7bf; background: var(--green-soft); }
        .rdc .stp.active b { background: var(--green); color: #fff; }
        .rdc .stp.active span { color: var(--navy-d); }
        .rdc .stp.done { cursor: pointer; }
        .rdc .stp.done b { background: var(--navy); color: #fff; }
        .rdc .form { background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 22px; display: grid; gap: 18px; }
        .rdc .block { background: #f8fbfd; border: 1px solid #e5eef3; border-radius: 16px; padding: 18px; }
        .rdc .block h2 { margin: 0 0 14px; font-size: 19px; letter-spacing: -.02em; color: var(--navy-d); }
        .rdc .fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .rdc .field { display: grid; gap: 7px; }
        .rdc .field.wide { grid-column: 1 / -1; }
        .rdc label { font-size: 13px; font-weight: 700; color: #315873; }
        .rdc input, .rdc select, .rdc textarea { width: 100%; border: 1px solid #d9e7ef; background: #fff; border-radius: 12px; padding: 12px 13px; font: inherit; color: var(--ink); outline: none; min-height: 48px; }
        .rdc input:focus, .rdc select:focus, .rdc textarea:focus { border-color: var(--green); box-shadow: 0 0 0 3px rgba(0,193,110,.12); }
        .rdc textarea { resize: vertical; }
        .rdc .checks { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .rdc .checks label { display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid #d9e7ef; border-radius: 12px; padding: 12px; }
        .rdc .checks input { width: auto; min-height: auto; }
        .rdc .approvalIntro { grid-column: 1 / -1; color: var(--ink-soft); line-height: 1.45; }
        .rdc .approvalIntro p { margin: 0 0 8px; }
        .rdc .approvalIntro small { color: var(--green-d); font-weight: 800; }
        .rdc .approvalRoles { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .rdc .approvalRole { display: flex; gap: 12px; align-items: flex-start; background: #fff; border: 1px solid #d9e7ef; border-radius: 14px; padding: 14px; cursor: pointer; }
        .rdc .approvalRole.active { border-color: #9be7bf; background: #f0fff7; }
        .rdc .approvalRole input { width: auto; min-height: auto; margin-top: 4px; }
        .rdc .approvalRole b { display: block; color: var(--navy-d); }
        .rdc .approvalRole small { display: block; color: var(--ink-soft); margin-top: 3px; font-weight: 700; }
        .rdc .pimList { grid-column: 1 / -1; display: grid; gap: 12px; }
        .rdc .pimRow { background: #fff; border: 1px solid #d9e7ef; border-radius: 16px; padding: 14px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; align-items: end; }
        .rdc .pimRow .field { min-width: 0; }
        .rdc .pimRow .remove { grid-column: 1 / -1; justify-self: end; }
        .rdc .err { background: #fff1f0; border: 1px solid #ffd0cb; color: #c0392b; padding: 12px 14px; border-radius: 12px; font-weight: 700; font-size: 14px; }
        .rdc .wizNav { display: flex; align-items: center; gap: 14px; }
        .rdc .count { color: var(--ink-soft); font-size: 13px; font-weight: 700; margin-right: auto; }
        .rdc button { border: 0; background: var(--green); color: #fff; border-radius: 999px; padding: 13px 20px; font-weight: 800; cursor: pointer; }
        .rdc button:disabled { opacity: .55; cursor: not-allowed; }
        .rdc button.ghost, .rdc .ghostLink { background: #fff; color: var(--navy); border: 1px solid var(--line); padding: 13px 20px; border-radius: 999px; font-weight: 800; }
        .rdc .autocomplete { position: relative; }
        .rdc .suggestions { position: absolute; z-index: 20; top: calc(100% + 6px); left: 0; right: 0; background: #fff; border: 1px solid #d9e7ef; border-radius: 14px; box-shadow: 0 18px 45px rgba(7,59,93,.14); overflow: hidden; }
        .rdc .suggestion { width: 100%; border: 0; border-radius: 0; background: #fff; color: var(--ink); display: flex; align-items: center; gap: 10px; padding: 11px 12px; text-align: left; cursor: pointer; font-weight: 700; }
        .rdc .suggestion:hover { background: var(--bg); }
        .rdc .suggestion img { width: 26px; height: 26px; border-radius: 999px; }
        .rdc .suggestion small { display: block; color: var(--ink-soft); font-weight: 600; }
        .rdc .suggestionEmpty { padding: 12px; color: var(--ink-soft); font-size: 13px; }
        .rdc .done { background: #fff; border: 1px solid var(--line); border-radius: 20px; padding: 44px; text-align: center; max-width: 620px; margin: 40px auto; }
        .rdc .done .check { display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 999px; background: var(--green-soft); color: var(--green-d); font-size: 28px; font-weight: 800; }
        .rdc .done h1 { margin: 18px 0 8px; }
        .rdc .done p { color: var(--ink-soft); line-height: 1.5; margin: 0 0 24px; }
        .rdc .doneActions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .rdc .doneActions .primary { background: var(--green); color: #fff; padding: 13px 20px; border-radius: 999px; font-weight: 800; }
        @media (max-width: 960px) {
          .rdc .stepper { grid-template-columns: repeat(3, 1fr); }
          .rdc .pimRow { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 760px) {
          .rdc .stepper { grid-template-columns: 1fr 1fr; }
          .rdc .fields, .rdc .checks, .rdc .approvalRoles, .rdc .pimRow { grid-template-columns: 1fr; }
          .rdc .wizNav { flex-wrap: wrap; }
          .rdc .wizNav button { flex: 1; }
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
  const wide = ['Resumen', 'Descripción', 'Plan', 'Solución', 'Servicios', 'Usuarios', 'Consecuencia', 'Detalle', 'Sistema(s)', 'Repositorios', 'Rollback', 'Deploy', 'Mitigación', 'Respaldo'].some((w) => label.includes(w));
  return (
    <div className={wide ? 'field wide' : 'field'}>
      <label>{label}</label>
      {children}
    </div>
  );
}

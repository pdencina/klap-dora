'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { getCombinedSuggestions, suggestTitle, type RdcSuggestion } from '@/lib/rdc-suggestions';

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
  name: string;
  version: string;
  status: string;
  jenkinsQa: string;
  parameters: string;
};

// ===== Opciones del formulario =====
const categoriaOptions = ['Mantención', 'Proyecto', 'Incidente', 'Hotfix', 'Recurrente'];
const sistemaOptions = ['POS Tradicional Ingenico', 'POS Tradicional Verifone', 'SmartPago', 'POS Integrado Android', 'App Klap (TTP)', 'API Tarjetas (E-Commerce)', 'API H2H', 'API Transit', 'Checkout / Link de Pago', 'Boleta Electrónica', 'SmartVista', 'Web Privada (Portal Comercios)', 'Web Pública (klap.cl)', 'Backoffice', 'Multiservicios (PDC/Recargas/JDA)', 'Alimentación (Pluxee/Edenred/Amipass)', 'Clearing (Visa/Mastercard/Amex)', 'Anticipo Klap / Abono Ya', 'R2 Crédito Emprende', 'Cuota Comercio', 'Data Analytics (Redshift/S3)', 'Redes', 'Infraestructura / Ingeniería', 'Afiliación y Contrato', 'IMED', 'Otro'];
const celulaOptions = ['Adquirencia Transaccional', 'Adquirencia Clearing', 'Adquirencia H2H', 'E-Commerce API', 'E-Commerce Checkout', 'Boleta Electrónica y Multiservicios', 'SmartVista', 'Desarrollo POS', 'Canales Presenciales', 'App Klap', 'Alimentación', 'APM', 'SVA', 'Facturación y Servicios Financieros', 'BO y Multiservicios Central', 'Multiservicios', 'Web Privada', 'Web Pública', 'Salud', 'Retail', 'Afiliación y Contrato', 'Redes', 'Ingeniería de Sistemas', 'Problemas', 'Mejora Continua', 'Incidentes', 'Clientes', 'Integraciones', 'Arquitectura', 'Ciberdefensa', 'Otro'];
const impactOptions = ['Bajo', 'Medio', 'Alto', 'Crítico'];
const priorityOptions = ['Baja', 'Media', 'Alta', 'Urgente'];
const urgencyOptions = ['Normal', 'Hotfix', 'Recurrente', 'Emergencia'];
const changeTypeOptions = ['Software', 'Infraestructura', 'Redes', 'Sistema Operativo / Utilidades', 'Base de Datos', 'Procedimiento', 'Seguridad', 'Datos'];
const businessOptions = ['PCI', 'Multiservicio', 'Verticales', 'No aplica'];
const environmentOptions = ['Producción', 'Pre-Producción', 'Sandbox', 'Ambiente Exclusivo Sodexo'];
const cutImpactOptions = ['No aplica corte programado', 'Bajo (1 a 4 comercios)', 'Medio (5 a 20 comercios)', 'Alto (Mayor a 20 comercios)'];
const assistedOptions = ['No Aplica', 'Semi asistido', 'Asistido'];
const scheduleOptions = ['Sin restricción', 'Con restricción'];
const deprecatesOptions = ['No aplica', 'No depreca componente(s)', 'Si depreca componente(s)'];
const pimStatusOptions = ['Pendiente', 'Error de Despliegue', 'Instalado en QA', 'Certificado', 'Listo para PROD'];

const APPROVER_ROLES = ['Dueño Cambio', 'QA', 'DBA', 'Deployment', 'Release Management', 'Redes', 'Seguridad', 'Infraestructura', 'Arquitectura'];

// ===== Catálogo de Sistemas Relacionados (Template V.7) =====
const SYSTEMS_CATALOG: Record<string, string[]> = {
  '1. Afiliación y Contrato': ['Registro Comercio', 'Reporte Registro Comercio', 'Reporte Depósitos en Garantía', 'Reporte Contratos', 'Afiliación Cybersource', 'App Afiliación', 'Afiliación Masiva Copec', 'Autoafiliación Ecommerce', 'Firma de contratos y anexo', 'Backoffice: Mantención de comercios existentes contrato digital'],
  '2. APM': ['App Vender: Alimentación - Retail', 'App de restaurant POPAPP', 'Transacciones tarjetas cerradas: Hites', 'Transacciones Tarjetas de Alimentación: Sodexo - Edenred - Amipass', 'APK: POS Salud', 'APK: KLAP salud', 'APK: matchOnCard', 'APK: RME dispensador', 'APK: RME prescriptor', 'APK: BAS Fonasa', 'APK: Caja Los Andes', 'Rendición de transacciones', 'Transacciones de cajas de compensación', 'IMED'],
  '3. Boleta Electrónica y Multiservicios': ['Robot Descarga CAF', 'Generación de lote de folios', 'Recepción de BE POS', 'Envío BE SII', 'Consulta estado BE SII', 'Generación Resúmenes Diarios SII', 'Consulta Resúmenes SII', 'APIs de recepción/conciliación/consulta/carga masiva', 'Módulo Administración comercios con BE en BO', 'POS Tradicional: PDC - Juegos de Azar - Recargas', 'Recargas Telefónicas', 'Recargas BIP!', 'Pago de Cuentas Web', 'Rendiciones multiservicios'],
  '4. Adquirencia E-Commerce': ['Switch TRN: API Tarjetas Grandes Clientes', 'Switch TRN: API H2H con MercadoPago', 'Switch TRN: API Transit'],
  '5. E-Commerce-Checkout': ['Klap Checkout (Pasarela)', 'Checkout Transparente', 'Oneclick', 'Módulo anulaciones', 'TGR', 'Robot Banco Chile (SLP, SLC)', 'Botón de Pago (Efectivo, TEF)', 'Transferencia con Banco Bice y Security', 'Link de Pago'],
  '6. Servicios de Valor Agregado': ['Anticipo Klap', 'R2', 'Cuota Comercio'],
  '7. App Klap': ['App Klap + Tap To Phone'],
  '8. Web': ['Portal Público Klap', 'Intranet Klap', 'Portal Privado Comercios'],
  '9. Facturación y SSFF': ['Cargas masivas Condiciones Comerciales', 'Pago de Renta Variable', 'Bono Ticket', 'Procesos de pagos y Cobros comisiones', 'Cuenta Corriente', 'Tickets de sistemas BO', 'Página de Servicios o CRM', 'Facturación', 'Liquidaciones', 'Sistema Deudas', 'Merchant Discount desde Backoffice', 'Línea de crédito'],
  '10. BO y Multiservicio Central': ['Backoffice: Inventario', 'Backoffice: Integración XCash', 'Backoffice: Mantenimientos operaciones', 'Backoffice: Robot Afiliación', 'Backoffice: Robot Deudas Masivas', 'Backoffice: Robot Carterización', 'Proyecto Latidos e Inventario', 'Integraciones SLC/SLP', 'ISWITCH', 'Core Switch Transaccional Multiservicios', 'Replicación de Datos', 'Reportes BO'],
  '11. Adquirencia Transaccional': ['Switch TRN: Ventas con tarjetas', 'Switch TRX PCI', 'Switch TRN: Integración autorizadores marcas', 'Productor de trxs JSON a Kafka', 'Switch BAT y LEG: Replicación', 'Procesamiento transaccional', 'Mantenciones generales adquirencia', 'Backoffice contracargos'],
  '12. Adquirencia Clearing (RealNear)': ['Switch BAT: Clearing/Settlement', 'CNL', 'Switch BAT', 'Switch CIP', 'Switch LEG', 'Contracargos y Disputas', 'Integración endpoints marcas', 'Consumers Kafka Confluent'],
  '13. Adquirencia H2H (SmartCell)': ['Switch TRN: Adquirencia H2H', 'SwitchEDP - Cybersource', 'SwitchTRN - Api Notificaciones Cybs'],
  '14. POS': ['Pos Ingenico', 'Pos Verifone', 'Smart Pago', 'Poslib', 'H2H', 'Pos Integrado Android'],
  '15. SmartVista': ['SVXP Generator', 'Consumers (Amex, Visa, Mastercard, UPI)', 'Gestor de cuotas', 'Contabilidad', 'Consumidor-Generador SVAP'],
  '16. Liquidaciones WEB': ['Visualización de Liquidaciones Web en portal Comercio'],
  '17. Data Analytics': ['Data warehouse (Redshift)', 'Data lake (S3)', 'Data Gobernance (Lakeformation)'],
  '18. OTI': ['Sistemas de Respaldo', 'Ciberseguridad', 'vSphere Teatinos', 'vSphere Kudos'],
};

const STEPS = [
  { title: 'Detalles', help: 'Identificación del cambio, origen Jira y responsable técnico.' },
  { title: 'Descripción', help: 'Qué cambia, por qué, a quién afecta y plan de validación.' },
  { title: 'Requisitos', help: 'Redes, infra, BD, diagrama, monitoreo y deprecación.' },
  { title: 'Clasificación', help: 'Negocio, ambiente, sistemas, tipo, impacto, horario y corte.' },
  { title: 'Despliegue', help: 'Componentes PIM, repositorios, plan QA, producción y rollback.' },
  { title: 'Aprobadores', help: 'Selección de áreas y revisión final antes de enviar.' },
];


export default function RdcPage() {
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);
  const [createdRdcId, setCreatedRdcId] = useState('');
  const [createdJiraKey, setCreatedJiraKey] = useState('');
  const [jiraWarning, setJiraWarning] = useState('');
  const [approvalRoles, setApprovalRoles] = useState<Record<string, ApprovalRole[]>>({});
  const [approvalRolesLoading, setApprovalRolesLoading] = useState(false);

  const [form, setForm] = useState({
    // === 1. Detalles del Cambio ===
    title: '',
    jiraOrigin: '',
    category: 'Mantención',
    system: '',
    cell: '',
    area: '',
    technicalLead: '',
    technicalLeadPhone: '',
    proposedDeployDate: '',

    // === 2. Descripción del Cambio ===
    requirementDescription: '',
    implementedSolution: '',
    affectedServices: '',
    affectedUsers: '',
    consequenceNotImplementing: '',
    businessValidator: '',
    validationPlan: '',

    // === 3. Requisitos Previos ===
    requiresNetworks: false,
    requiresInfra: false,
    requiresDba: false,
    requiresMonitoring: false,
    monitoringDetail: '',
    dbCriticalApplies: false,
    dbCriticalName: '',
    dbCriticalDba: '',
    dbCriticalResult: '',
    diagramApplies: false,
    diagramLink: '',
    deprecates: 'No aplica',
    deprecatesDetail: '',
    backupBeforeDelete: '',

    // === 4. Clasificación y Negocio ===
    changeType: 'Software',
    urgency: 'Normal',
    impact: 'Medio',
    priority: 'Media',
    impactedBusiness: 'Verticales',
    environment: 'Producción',
    relatedSystems: [] as string[],
    schedule: 'Sin restricción',
    scheduleDetail: '',
    assisted: 'No Aplica',
    assistedDetail: '',
    dependentRdc: 'No aplica',
    cutImpact: 'No aplica corte programado',
    cutEvidence: '',

    // === 5. Despliegue ===
    pimComponents: [{ name: '', version: '', status: 'Pendiente', jenkinsQa: '', parameters: '' }] as PimComponent[],
    backupApp: false,
    backupDb: false,
    repositories: '',
    deployPlanQa: '',
    rollbackQa: '',
    certificationStories: '',
    deployPlanProd: '',
    rollbackProd: '',
    mitigationPlan: '',

    // === 6. Aprobadores ===
    presenter: '',
    qaAnalyst: '',
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment'] as string[],
  });

  const [suggestion, setSuggestion] = useState<RdcSuggestion | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  function update(name: string, value: any) {
    // Formateo automático de teléfono chileno
    if (name === 'technicalLeadPhone') {
      value = formatChileanPhone(value);
    }
    setForm((c) => ({ ...c, [name]: value }));

    // Cuando cambia el sistema, generar sugerencias IA
    if (name === 'system' && value) {
      const sug = getCombinedSuggestions(value, form.category);
      if (sug && Object.keys(sug).length > 0) {
        setSuggestion(sug);
        setSuggestionDismissed(false);
      } else {
        setSuggestion(null);
      }
    }
    if (name === 'category' && form.system) {
      const sug = getCombinedSuggestions(form.system, value);
      if (sug && Object.keys(sug).length > 0) {
        setSuggestion(sug);
        setSuggestionDismissed(false);
      } else {
        setSuggestion(null);
      }
    }
  }

  /** Formatea número de teléfono al formato +56 9 XXXX XXXX */
  function formatChileanPhone(input: string): string {
    // Quitar todo lo que no sea dígito o +
    const digits = input.replace(/[^\d+]/g, '');
    // Si empieza con +56, formatear
    if (digits.startsWith('+569') && digits.length <= 12) {
      const num = digits.slice(3); // quita +56
      if (num.length <= 1) return '+56 ' + num;
      if (num.length <= 5) return '+56 ' + num.slice(0, 1) + ' ' + num.slice(1);
      return '+56 ' + num.slice(0, 1) + ' ' + num.slice(1, 5) + ' ' + num.slice(5, 9);
    }
    if (digits.startsWith('+56') && digits.length <= 12) {
      const num = digits.slice(3);
      if (num.length <= 1) return '+56 ' + num;
      if (num.length <= 5) return '+56 ' + num.slice(0, 1) + ' ' + num.slice(1);
      return '+56 ' + num.slice(0, 1) + ' ' + num.slice(1, 5) + ' ' + num.slice(5, 9);
    }
    // Si escribe 9XXXXXXXX sin prefijo
    if (digits.startsWith('9') && digits.length >= 2 && !digits.startsWith('+')) {
      if (digits.length <= 1) return '+56 ' + digits;
      if (digits.length <= 5) return '+56 ' + digits.slice(0, 1) + ' ' + digits.slice(1);
      return '+56 ' + digits.slice(0, 1) + ' ' + digits.slice(1, 5) + ' ' + digits.slice(5, 9);
    }
    // Si escribe 569XXXXXXXX
    if (digits.startsWith('569') && !digits.startsWith('+')) {
      const num = digits.slice(2);
      if (num.length <= 1) return '+56 ' + num;
      if (num.length <= 5) return '+56 ' + num.slice(0, 1) + ' ' + num.slice(1);
      return '+56 ' + num.slice(0, 1) + ' ' + num.slice(1, 5) + ' ' + num.slice(5, 9);
    }
    return input;
  }

  function applySuggestions() {
    if (!suggestion) return;
    setForm((c) => ({
      ...c,
      ...(suggestion.cell && !c.cell ? { cell: suggestion.cell } : {}),
      ...(suggestion.changeType ? { changeType: suggestion.changeType } : {}),
      ...(suggestion.impactedBusiness ? { impactedBusiness: suggestion.impactedBusiness } : {}),
      ...(suggestion.environment ? { environment: suggestion.environment } : {}),
      ...(suggestion.impact ? { impact: suggestion.impact } : {}),
      ...(suggestion.priority ? { priority: suggestion.priority } : {}),
      ...(suggestion.urgency ? { urgency: suggestion.urgency } : {}),
      ...(suggestion.affectedServices && !c.affectedServices ? { affectedServices: suggestion.affectedServices } : {}),
      ...(suggestion.relatedSystems && suggestion.relatedSystems.length > 0 ? { relatedSystems: [...new Set([...c.relatedSystems, ...suggestion.relatedSystems])] } : {}),
      ...(suggestion.selectedApprovalRoles ? { selectedApprovalRoles: suggestion.selectedApprovalRoles } : {}),
      ...(suggestion.assisted ? { assisted: suggestion.assisted } : {}),
      ...(suggestion.schedule ? { schedule: suggestion.schedule } : {}),
      ...(suggestion.cutImpact ? { cutImpact: suggestion.cutImpact } : {}),
      ...(suggestion.requiresDba !== undefined ? { requiresDba: suggestion.requiresDba } : {}),
      ...(suggestion.requiresNetworks !== undefined ? { requiresNetworks: suggestion.requiresNetworks } : {}),
      ...(suggestion.requiresInfra !== undefined ? { requiresInfra: suggestion.requiresInfra } : {}),
      ...(suggestion.requiresMonitoring !== undefined ? { requiresMonitoring: suggestion.requiresMonitoring } : {}),
      ...(!c.title.trim() ? { title: suggestTitle(c.system, c.category) } : {}),
    }));
    setSuggestionDismissed(true);
  }

  function dismissSuggestions() {
    setSuggestionDismissed(true);
  }

  // Cargar roles de aprobación
  useEffect(() => {
    (async () => {
      try {
        setApprovalRolesLoading(true);
        const r = await fetch('/api/approvals/roles', { cache: 'no-store' });
        const d = await r.json();
        if (r.ok && d.ok) setApprovalRoles(d.grouped || {});
      } catch { setApprovalRoles({}); }
      finally { setApprovalRolesLoading(false); }
    })();
  }, []);

  function toggleApprovalRole(role: string) {
    setForm((c) => {
      const roles = c.selectedApprovalRoles;
      return { ...c, selectedApprovalRoles: roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role] };
    });
  }

  function toggleSystem(sys: string) {
    setForm((c) => {
      const list = c.relatedSystems;
      return { ...c, relatedSystems: list.includes(sys) ? list.filter((s) => s !== sys) : [...list, sys] };
    });
  }

  function addPimComponent() {
    setForm((c) => ({ ...c, pimComponents: [...c.pimComponents, { name: '', version: '', status: 'Pendiente', jenkinsQa: '', parameters: '' }] }));
  }

  function updatePim(index: number, field: keyof PimComponent, value: string) {
    setForm((c) => {
      const pim = [...c.pimComponents];
      pim[index] = { ...pim[index], [field]: value };
      return { ...c, pimComponents: pim };
    });
  }

  function removePim(index: number) {
    setForm((c) => ({ ...c, pimComponents: c.pimComponents.filter((_, i) => i !== index) }));
  }

  function validateStep(s: number): string {
    if (s === 0) {
      if (!form.title.trim()) return 'El nombre del cambio es obligatorio.';
      if (!form.system) return 'Selecciona el sistema / producto.';
      if (!form.cell) return 'Selecciona la célula responsable.';
      if (!form.technicalLead.trim()) return 'Indica el líder técnico.';
      if (!form.technicalLeadPhone.trim()) return 'Indica el teléfono del líder técnico.';
      if (form.technicalLeadPhone.replace(/[^\d]/g, '').length < 9) return 'El teléfono debe tener al menos 9 dígitos.';
      if (!form.proposedDeployDate) return 'Indica la fecha propuesta de paso a producción.';
      // Validar que la fecha no sea en el pasado
      const today = new Date().toISOString().slice(0, 10);
      if (form.proposedDeployDate < today) return 'La fecha propuesta no puede ser anterior a hoy.';
    }
    if (s === 1) {
      if (!form.requirementDescription.trim()) return 'Describe el requerimiento.';
      if (!form.implementedSolution.trim()) return 'Indica la solución implementada.';
      if (!form.affectedServices.trim()) return 'Indica los servicios afectados por el cambio.';
    }
    if (s === 3) {
      if (!form.changeType) return 'Selecciona el tipo de cambio.';
      if (!form.impact) return 'Selecciona el impacto del cambio.';
      if (!form.environment) return 'Selecciona el ambiente.';
    }
    if (s === 4) {
      if (!form.deployPlanProd.trim()) return 'Indica el plan de despliegue en producción.';
      if (!form.rollbackProd.trim()) return 'Indica el plan de rollback en producción.';
    }
    if (s === 5) {
      if (!form.presenter.trim()) return 'Indica el presentador del cambio.';
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

  function back() { setStepError(''); setStep((s) => Math.max(s - 1, 0)); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function goTo(s: number) { if (s <= step) { setStepError(''); setStep(s); } }

  async function createRdc() {
    for (let s = 0; s <= 5; s++) {
      const e = validateStep(s);
      if (e) { setStep(s); setStepError(e); return; }
    }
    try {
      setSaving(true); setStepError('');
      const response = await fetch('/api/rdc/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: suggestTitle(form.system || '', form.category) + form.title,
          description: form.requirementDescription,
          category: form.category,
          system: form.system,
          cell: form.cell,
          jiraOrigin: form.jiraOrigin,
          proposedDeployDate: form.proposedDeployDate,
          presenter: form.presenter,
          technicalLead: form.technicalLead,
          qaAnalyst: form.qaAnalyst,
          businessValidator: form.businessValidator,
          requirementDescription: form.requirementDescription,
          implementedSolution: form.implementedSolution,
          affectedServices: form.affectedServices,
          affectedUsers: form.affectedUsers,
          consequenceNotImplementing: form.consequenceNotImplementing,
          validationPlan: form.validationPlan,
          impact: form.impact,
          priority: form.priority,
          requiresDba: form.requiresDba,
          requiresNetworks: form.requiresNetworks,
          requiresInfra: form.requiresInfra,
          requiresMonitoring: form.requiresMonitoring,
          dependentRdc: form.dependentRdc,
          selectedApprovalRoles: form.selectedApprovalRoles,
          formData: {
            version: 'rdc_v7_full',
            technicalLeadPhone: form.technicalLeadPhone,
            area: form.area,
            monitoringDetail: form.monitoringDetail,
            dbCritical: { applies: form.dbCriticalApplies, name: form.dbCriticalName, dba: form.dbCriticalDba, result: form.dbCriticalResult },
            diagram: { applies: form.diagramApplies, link: form.diagramLink },
            deprecates: form.deprecates,
            deprecatesDetail: form.deprecatesDetail,
            backupBeforeDelete: form.backupBeforeDelete,
            classification: { changeType: form.changeType, urgency: form.urgency, impact: form.impact, priority: form.priority },
            business: { impactedBusiness: form.impactedBusiness, environment: form.environment },
            relatedSystems: form.relatedSystems,
            schedule: form.schedule,
            scheduleDetail: form.scheduleDetail,
            assisted: form.assisted,
            assistedDetail: form.assistedDetail,
            cutImpact: form.cutImpact,
            cutEvidence: form.cutEvidence,
            pimComponents: form.pimComponents.filter((p) => p.name.trim()),
            backups: { app: form.backupApp, db: form.backupDb },
            repositories: form.repositories,
            deployPlanQa: form.deployPlanQa,
            rollbackQa: form.rollbackQa,
            certificationStories: form.certificationStories,
            deployPlanProd: form.deployPlanProd,
            rollbackProd: form.rollbackProd,
            mitigationPlan: form.mitigationPlan,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'No fue posible crear el RDC');

      setCreatedRdcId(data.rdc?.id || '');
      setCreatedJiraKey(data.jiraKey || '');
      if (data.jiraDiagnostics?.createdWithFallback && data.jiraDiagnostics?.firstAttemptError) {
        const errDetail = JSON.stringify(data.jiraDiagnostics.firstAttemptError?.errors || data.jiraDiagnostics.firstAttemptError);
        setJiraWarning(`Custom fields rechazados por Jira (se usó fallback): ${errDetail}`);
      } else {
        setJiraWarning(data.jiraError || '');
      }
      setCreated(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) { setStepError(err?.message || 'Error creando RDC'); }
    finally { setSaving(false); }
  }

  // ===== RENDER =====
  return (
    <main className="rdcLite">
      {created ? (
        <div className="done">
          <span className="check">✓</span>
          <h1>RDC registrado</h1>
          <p>RDC registrado y enviado al flujo CAB.</p>
          {createdJiraKey && (
            <div className="jiraSuccess">
              <span className="jiraIcon">🎫</span>
              <p>Ticket Jira creado: <a href={`https://multicaja-cloud.atlassian.net/browse/${createdJiraKey}`} target="_blank" rel="noopener noreferrer"><strong>{createdJiraKey}</strong></a></p>
            </div>
          )}
          {jiraWarning && (
            <div className="jiraWarn">
              <span>⚠️</span>
              <p>{jiraWarning}</p>
            </div>
          )}
          {!createdJiraKey && !jiraWarning && (
            <div className="jiraWarn">
              <span>⚠️</span>
              <p>No se pudo crear ticket en Jira. Puedes crearlo manualmente desde el detalle del RDC.</p>
            </div>
          )}
          <div className="doneActions">
            {createdRdcId ? <a className="primary" href={`/rdc/${createdRdcId}`}>Abrir RDC →</a> : null}
            {createdJiraKey && <a className="primary" href={`https://multicaja-cloud.atlassian.net/browse/${createdJiraKey}`} target="_blank" rel="noopener noreferrer">Ver en Jira →</a>}
            <a className="ghostLink" href="/mis-cambios">Ver en Mis Cambios</a>
            <button type="button" className="ghost" onClick={() => window.location.reload()}>Registrar otro</button>
          </div>
        </div>
      ) : (
        <>
          <header className="head">
            <p className="kicker">REGISTRO DE CAMBIO · RDC V.7</p>
            <h1>Nuevo RDC</h1>
            <p className="sub">Template RDC R.M V.7 — Captura toda la información requerida para evaluar, aprobar y ejecutar el cambio.</p>
          </header>

          <div className="stepper">
            {STEPS.map((s, i) => (
              <button key={s.title} type="button" className={`stp ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} onClick={() => goTo(i)}>
                <b>{i < step ? '✓' : i + 1}</b>
                <span>{s.title}</span>
              </button>
            ))}
          </div>

          <form className="form" onSubmit={(e) => e.preventDefault()}>

            {/* ===== PASO 1: Detalles del Cambio ===== */}
            {step === 0 && (
              <>
                <Block title="Detalles del Cambio">
                  <Field label="Nombre del cambio *">
                    <div className="titleComposite">
                      <span className="titlePrefix">{suggestTitle(form.system || '', form.category)}</span>
                      <input value={form.title} onChange={(e) => update('title', e.target.value)} placeholder={form.category === 'Hotfix' ? 'Descripción del incidente / JIRA-XXX' : form.category === 'Incidente' ? 'Descripción del incidente / JIRA-XXX' : form.category === 'Proyecto' ? 'Nombre del proyecto / JIRA-XXX' : 'Descripción breve del cambio / JIRA-XXX'} />
                    </div>
                    <small className="fieldHint">Escribe solo la descripción. El prefijo se genera automáticamente según la categoría.</small>
                  </Field>
                  <Field label="Solicitud de cambio (Jira)">
                    <input value={form.jiraOrigin} onChange={(e) => update('jiraOrigin', e.target.value)} placeholder="Indicar enlace de Jira" />
                  </Field>
                  <Field label="Categoría del Cambio">
                    <select value={form.category} onChange={(e) => update('category', e.target.value)}>{categoriaOptions.map((o) => <option key={o}>{o}</option>)}</select>
                  </Field>
                  <Field label="Sistema / Producto *">
                    <select value={form.system} onChange={(e) => update('system', e.target.value)}>
                      <option value="">Seleccionar producto</option>
                      {sistemaOptions.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </Field>

                  {/* Banner de sugerencias IA */}
                  {suggestion && !suggestionDismissed && form.system && (
                    <div className="aiSuggestion">
                      <div className="aiSugHead">
                        <span className="aiIcon">✨</span>
                        <div>
                          <b>Autocompletado inteligente</b>
                          <p>Basado en RDCs anteriores de <strong>{form.system}</strong>, se sugieren valores frecuentes para célula, tipo, impacto, aprobadores y más.</p>
                        </div>
                      </div>
                      <div className="aiSugPreview">
                        {suggestion.cell && <span><b>Célula:</b> {suggestion.cell}</span>}
                        {suggestion.impact && <span><b>Impacto:</b> {suggestion.impact}</span>}
                        {suggestion.changeType && <span><b>Tipo:</b> {suggestion.changeType}</span>}
                        {suggestion.urgency && <span><b>Urgencia:</b> {suggestion.urgency}</span>}
                        {suggestion.assisted && <span><b>Asistido:</b> {suggestion.assisted}</span>}
                      </div>
                      <div className="aiSugActions">
                        <button type="button" className="aiApply" onClick={applySuggestions}>Aplicar sugerencias</button>
                        <button type="button" className="ghost small" onClick={dismissSuggestions}>No, gracias</button>
                      </div>
                    </div>
                  )}
                  <Field label="Célula *">
                    <select value={form.cell} onChange={(e) => update('cell', e.target.value)}>
                      <option value="">Selecciona</option>
                      {celulaOptions.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </Field>
                  <Field label="Área responsable">
                    <input value={form.area} onChange={(e) => update('area', e.target.value)} placeholder="Área responsable por la solicitud de cambio" />
                  </Field>
                  <Field label="Líder Técnico *">
                    <UserAutocomplete value={form.technicalLead} placeholder="Nombre del responsable del cambio" onChange={(v) => update('technicalLead', v)} />
                  </Field>
                  <Field label="Teléfono Líder Técnico *">
                    <input value={form.technicalLeadPhone} onChange={(e) => update('technicalLeadPhone', e.target.value)} placeholder="+56 9 XXXX XXXX" />
                  </Field>
                  <Field label="Fecha propuesta paso a producción *">
                    <input type="date" value={form.proposedDeployDate} onChange={(e) => update('proposedDeployDate', e.target.value)} />
                  </Field>
                </Block>
              </>
            )}

            {/* ===== PASO 2: Descripción del Cambio ===== */}
            {step === 1 && (
              <>
                <Block title="Descripción del Cambio">
                  <Field label="Descripción del requerimiento *">
                    <textarea value={form.requirementDescription} onChange={(e) => update('requirementDescription', e.target.value)} rows={4} placeholder="Describe el problema o incidente al que se refiere la solicitud de cambio." />
                  </Field>
                  <Field label="Solución del requerimiento *">
                    <textarea value={form.implementedSolution} onChange={(e) => update('implementedSolution', e.target.value)} rows={4} placeholder="¿Cuál es el resultado deseado del cambio? Indicar que es lo que se espera lograr." />
                  </Field>
                  <Field label="Servicios afectados *">
                    <textarea value={form.affectedServices} onChange={(e) => update('affectedServices', e.target.value)} rows={3} placeholder="Enumere los servicios a los que afecta la solicitud del cambio." />
                  </Field>
                  <Field label="Usuarios afectados">
                    <textarea value={form.affectedUsers} onChange={(e) => update('affectedUsers', e.target.value)} rows={3} placeholder="Enumere los usuarios a los que afecta la solicitud del cambio." />
                  </Field>
                  <Field label="¿Cuáles son las consecuencias si el cambio no es aprobado o pospuesto?">
                    <textarea value={form.consequenceNotImplementing} onChange={(e) => update('consequenceNotImplementing', e.target.value)} rows={3} placeholder="Indicar brevemente algún riesgo. Ejemplo: incumplimiento de SLA, exigencia de cliente crítico, etc." />
                  </Field>
                  <Field label="Validador">
                    <UserAutocomplete value={form.businessValidator} placeholder="Responsable a validar el cambio luego de ser desplegado" onChange={(v) => update('businessValidator', v)} />
                  </Field>
                  <Field label="Plan de validación">
                    <textarea value={form.validationPlan} onChange={(e) => update('validationPlan', e.target.value)} rows={3} placeholder="Enumerar paso(s) para validar cambio una vez desplegado." />
                  </Field>
                </Block>

              </>
            )}

            {/* ===== PASO 3: Requisitos Previos ===== */}
            {step === 2 && (
              <>
                <Block title="Requisitos Previos para ejecutar el Cambio">
                  <div className="checks">
                    <label><input type="checkbox" checked={form.requiresNetworks} onChange={(e) => update('requiresNetworks', e.target.checked)} /> Requisitos de Redes</label>
                    <label><input type="checkbox" checked={form.requiresInfra} onChange={(e) => update('requiresInfra', e.target.checked)} /> Requisitos de Infraestructura</label>
                    <label><input type="checkbox" checked={form.requiresDba} onChange={(e) => update('requiresDba', e.target.checked)} /> Requisitos de Base de datos (No críticas)</label>
                    <label><input type="checkbox" checked={form.dbCriticalApplies} onChange={(e) => update('dbCriticalApplies', e.target.checked)} /> Revisión Base de datos Críticas</label>
                  </div>

                  {form.dbCriticalApplies ? (
                    <>
                      <Field label="Base de datos impactada"><input value={form.dbCriticalName} onChange={(e) => update('dbCriticalName', e.target.value)} placeholder="Indicar la base de datos impactada" /></Field>
                      <Field label="DBA Revisor"><input value={form.dbCriticalDba} onChange={(e) => update('dbCriticalDba', e.target.value)} placeholder="@ mencionar el DBA revisor" /></Field>
                      <Field label="Resultado Revisión">
                        <select value={form.dbCriticalResult} onChange={(e) => update('dbCriticalResult', e.target.value)}>
                          <option value="">Selecciona</option>
                          <option value="REVISADO OK">REVISADO OK</option>
                          <option value="REVISADO NO OK">REVISADO NO OK</option>
                          <option value="No Aplica">No Aplica</option>
                        </select>
                      </Field>
                    </>
                  ) : null}
                </Block>

                <Block title="Diagrama Técnico">
                  <div className="checks">
                    <label><input type="checkbox" checked={form.diagramApplies} onChange={(e) => update('diagramApplies', e.target.checked)} /> Aplica diagrama técnico</label>
                  </div>
                  {form.diagramApplies ? (
                    <Field label="Link de diagrama"><input value={form.diagramLink} onChange={(e) => update('diagramLink', e.target.value)} placeholder="Adjuntar link de diagrama" /></Field>
                  ) : null}
                </Block>

                <Block title="¿Requiere Monitoreo?">
                  <div className="checks">
                    <label><input type="checkbox" checked={form.requiresMonitoring} onChange={(e) => update('requiresMonitoring', e.target.checked)} /> Sí, el servicio es nuevo</label>
                  </div>
                  {form.requiresMonitoring ? (
                    <Field label="Servicio que requiere ser monitoreado"><input value={form.monitoringDetail} onChange={(e) => update('monitoringDetail', e.target.value)} placeholder="Indicar el servicio" /></Field>
                  ) : null}
                </Block>

                <Block title="¿Este cambio DEPRECA algún componente anterior?">
                  <Field label="Estado de deprecación">
                    <select value={form.deprecates} onChange={(e) => update('deprecates', e.target.value)}>{deprecatesOptions.map((o) => <option key={o}>{o}</option>)}</select>
                  </Field>
                  {form.deprecates === 'Si depreca componente(s)' ? (
                    <>
                      <Field label="Componente a deprecar"><input value={form.deprecatesDetail} onChange={(e) => update('deprecatesDetail', e.target.value)} placeholder="Indicar nombre de componente a deprecar" /></Field>
                      <Field label="¿Se realizó respaldo antes de eliminar?">
                        <select value={form.backupBeforeDelete} onChange={(e) => update('backupBeforeDelete', e.target.value)}>
                          <option value="">Selecciona</option>
                          <option value="Si">Sí</option>
                          <option value="No">No</option>
                        </select>
                      </Field>
                    </>
                  ) : null}
                </Block>
              </>
            )}

            {/* ===== PASO 4: Clasificación y Negocio ===== */}
            {step === 3 && (
              <>
                <Block title="Cambio">
                  <Field label="Tipo de Cambio"><select value={form.changeType} onChange={(e) => update('changeType', e.target.value)}>{changeTypeOptions.map((o) => <option key={o}>{o}</option>)}</select></Field>
                  <Field label="Urgencia de Cambio"><select value={form.urgency} onChange={(e) => update('urgency', e.target.value)}>{urgencyOptions.map((o) => <option key={o}>{o}</option>)}</select></Field>
                  <Field label="Impacto del Cambio"><select value={form.impact} onChange={(e) => update('impact', e.target.value)}>{impactOptions.map((o) => <option key={o}>{o}</option>)}</select></Field>
                  <Field label="Prioridad del Cambio"><select value={form.priority} onChange={(e) => update('priority', e.target.value)}>{priorityOptions.map((o) => <option key={o}>{o}</option>)}</select></Field>
                </Block>

                <Block title="Negocio">
                  <Field label="Negocio Impactado"><select value={form.impactedBusiness} onChange={(e) => update('impactedBusiness', e.target.value)}>{businessOptions.map((o) => <option key={o}>{o}</option>)}</select></Field>
                  <Field label="Ambiente"><select value={form.environment} onChange={(e) => update('environment', e.target.value)}>{environmentOptions.map((o) => <option key={o}>{o}</option>)}</select></Field>
                </Block>

                <Block title="Sistema(s) Relacionado(s)">
                  <div className="systemsCatalog">
                    {Object.entries(SYSTEMS_CATALOG).map(([group, products]) => (
                      <details key={group} className="sysGroup">
                        <summary><b>{group}</b> <small>{form.relatedSystems.filter((s) => products.includes(s)).length > 0 ? `(${form.relatedSystems.filter((s) => products.includes(s)).length} seleccionados)` : ''}</small></summary>
                        <div className="sysProducts">
                          {products.map((p) => (
                            <label key={p} className={form.relatedSystems.includes(p) ? 'sysProd active' : 'sysProd'}>
                              <input type="checkbox" checked={form.relatedSystems.includes(p)} onChange={() => toggleSystem(p)} />
                              <span>{p}</span>
                            </label>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </Block>

                <Block title="Horario de Ejecución">
                  <Field label="Restricción de horario"><select value={form.schedule} onChange={(e) => update('schedule', e.target.value)}>{scheduleOptions.map((o) => <option key={o}>{o}</option>)}</select></Field>
                  {form.schedule === 'Con restricción' ? (
                    <Field label="Día y hora coordinada con Deployment"><input value={form.scheduleDetail} onChange={(e) => update('scheduleDetail', e.target.value)} placeholder="Coordinado con Líder de Deployment previo a la entrega al CAB" /></Field>
                  ) : null}
                </Block>

                <Block title="Asistido">
                  <Field label="Modalidad"><select value={form.assisted} onChange={(e) => update('assisted', e.target.value)}>{assistedOptions.map((o) => <option key={o}>{o}</option>)}</select></Field>
                  {form.assisted !== 'No Aplica' ? (
                    <Field label="Desarrolladores / DBA que asistirán"><textarea value={form.assistedDetail} onChange={(e) => update('assistedDetail', e.target.value)} rows={3} placeholder="Indicar quién asistirá el paso a producción previa coordinación con Operaciones TI" /></Field>
                  ) : null}
                </Block>

                <Block title="Dependencia con otro RDC">
                  <Field label="Dependencia"><input value={form.dependentRdc} onChange={(e) => update('dependentRdc', e.target.value)} placeholder="No aplica / Indicar RDC's de los que depende" /></Field>
                </Block>

                <Block title="Programar Corte">
                  <Field label="Impacto de corte programado"><select value={form.cutImpact} onChange={(e) => update('cutImpact', e.target.value)}>{cutImpactOptions.map((o) => <option key={o}>{o}</option>)}</select></Field>
                  {form.cutImpact !== 'No aplica corte programado' ? (
                    <Field label="Evidencia de comunicado a comercio(s)"><textarea value={form.cutEvidence} onChange={(e) => update('cutEvidence', e.target.value)} rows={2} placeholder="Adjuntar evidencia. Fecha y hora debe ser previamente coordinada con Deployment." /></Field>
                  ) : null}
                  {form.cutImpact !== 'No aplica corte programado' ? (
                    <div className="cutWarning">IMPORTANTE: Comunicar a el/los comercios afectados con 72hrs de anticipación.</div>
                  ) : null}
                </Block>
              </>
            )}

            {/* ===== PASO 5: Despliegue ===== */}
            {step === 4 && (
              <>
                <Block title="Respaldos">
                  <div className="checks">
                    <label><input type="checkbox" checked={form.backupApp} onChange={(e) => update('backupApp', e.target.checked)} /> App-Jar-War (respaldar antes del paso)</label>
                    <label><input type="checkbox" checked={form.backupDb} onChange={(e) => update('backupDb', e.target.checked)} /> Base de Datos-Esquema-Tabla-Funciones (respaldar DDL, Datos)</label>
                  </div>
                </Block>

                <Block title="PIM - Componentes de Software">
                  <div className="pimTable">
                    {form.pimComponents.map((comp, i) => (
                      <div className="pimRow" key={i}>
                        <input value={comp.name} onChange={(e) => updatePim(i, 'name', e.target.value)} placeholder="Componente" />
                        <input value={comp.version} onChange={(e) => updatePim(i, 'version', e.target.value)} placeholder="Versión" />
                        <select value={comp.status} onChange={(e) => updatePim(i, 'status', e.target.value)}>{pimStatusOptions.map((o) => <option key={o}>{o}</option>)}</select>
                        <input value={comp.jenkinsQa} onChange={(e) => updatePim(i, 'jenkinsQa', e.target.value)} placeholder="Jenkins QA" />
                        <input value={comp.parameters} onChange={(e) => updatePim(i, 'parameters', e.target.value)} placeholder="Parámetros" />
                        <button type="button" className="ghost small" onClick={() => removePim(i)}>✕</button>
                      </div>
                    ))}
                    <button type="button" className="ghost" onClick={addPimComponent}>+ Agregar componente</button>
                  </div>
                </Block>

                <Block title="Despliegue QA">
                  <Field label="Historias a Certificar"><textarea value={form.certificationStories} onChange={(e) => update('certificationStories', e.target.value)} rows={3} placeholder="Solicitud de Certificación" /></Field>
                  <Field label="Repositorios"><textarea value={form.repositories} onChange={(e) => update('repositories', e.target.value)} rows={3} placeholder="Ingresar enlace de GitLab/Bitbucket para consultar los ficheros" /></Field>
                  <Field label="Plan de Despliegue en QA"><textarea value={form.deployPlanQa} onChange={(e) => update('deployPlanQa', e.target.value)} rows={4} placeholder="1. Paso uno&#10;2. Paso dos&#10;3. Paso tres" /></Field>
                  <Field label="Rollback QA"><textarea value={form.rollbackQa} onChange={(e) => update('rollbackQa', e.target.value)} rows={3} placeholder="Agregar listado de tareas para la vuelta atrás" /></Field>
                </Block>

                <Block title="Despliegue Producción">
                  <Field label="Plan Despliegue Producción *"><textarea value={form.deployPlanProd} onChange={(e) => update('deployPlanProd', e.target.value)} rows={4} placeholder="1. Paso uno&#10;2. Paso dos&#10;3. Paso tres" /></Field>
                  <Field label="Rollback Producción *"><textarea value={form.rollbackProd} onChange={(e) => update('rollbackProd', e.target.value)} rows={3} placeholder="Describir plan de marcha atrás para recuperar la última configuración estable." /></Field>
                </Block>

                <Block title="Plan de Mitigación para CAB 2.0">
                  <Field label="Plan de Mitigación"><textarea value={form.mitigationPlan} onChange={(e) => update('mitigationPlan', e.target.value)} rows={4} placeholder="1. (Indicar responsable a contactar si el despliegue falla)&#10;2. (Indicar posibles casos de falla y soluciones alternativas)" /></Field>
                </Block>
              </>
            )}

            {/* ===== PASO 6: Aprobadores y Revisión ===== */}
            {step === 5 && (
              <>
                <Block title="Responsables">
                  <Field label="Presentador *"><UserAutocomplete value={form.presenter} placeholder="Buscar presentador" onChange={(v) => update('presenter', v)} /></Field>
                  <Field label="Analista QA"><UserAutocomplete value={form.qaAnalyst} placeholder="Buscar analista QA" onChange={(v) => update('qaAnalyst', v)} /></Field>
                </Block>

                <Block title="Aprobaciones">
                  <div className="approvalIntro">
                    <p>Selecciona las áreas que deben aprobar este cambio. Al crear el RDC se generan aprobaciones con link y OTP.</p>
                    {approvalRolesLoading ? <small>Cargando aprobadores configurados…</small> : null}
                  </div>
                  <div className="approvalRoles">
                    {APPROVER_ROLES.map((role) => {
                      const checked = form.selectedApprovalRoles.includes(role);
                      const approver = approvalRoles[role]?.[0];
                      return (
                        <label className={checked ? 'approvalRole active' : 'approvalRole'} key={role}>
                          <input type="checkbox" checked={checked} onChange={() => toggleApprovalRole(role)} />
                          <span><b>{role}</b><small>{approver?.approver_name || 'Por definir'}</small></span>
                        </label>
                      );
                    })}
                  </div>
                </Block>

                <section className="review">
                  <div className="reviewHead">
                    <div>
                      <p className="kicker">Resumen antes de enviar</p>
                      <h2>{(suggestTitle(form.system || '', form.category) + form.title) || 'Sin nombre'}</h2>
                      <p>{form.requirementDescription?.slice(0, 200) || 'Sin descripción'}</p>
                    </div>
                    <span>{form.impact} · {form.priority}</span>
                  </div>
                  <div className="reviewGrid">
                    <div><b>Sistema</b><span>{form.system || '—'}</span></div>
                    <div><b>Célula</b><span>{form.cell || '—'}</span></div>
                    <div><b>Categoría</b><span>{form.category}</span></div>
                    <div><b>Fecha</b><span>{form.proposedDeployDate || '—'}</span></div>
                    <div><b>Líder Técnico</b><span>{form.technicalLead || '—'}</span></div>
                    <div><b>Tipo</b><span>{form.changeType}</span></div>
                    <div><b>Urgencia</b><span>{form.urgency}</span></div>
                    <div><b>Ambiente</b><span>{form.environment}</span></div>
                  </div>
                  {form.relatedSystems.length > 0 ? (
                    <div className="reviewSystems"><b>Sistemas relacionados:</b> {form.relatedSystems.join(', ')}</div>
                  ) : null}
                  <div className="selectedApprovers"><h3>Aprobadores</h3><div>{form.selectedApprovalRoles.map((r) => <span key={r}>{r}</span>)}</div></div>
                </section>
              </>
            )}

            {stepError ? <div className="err">{stepError}</div> : null}

            <div className="wizNav">
              <button type="button" className="ghost" onClick={back} disabled={step === 0}>← Atrás</button>
              <span className="count">Paso {step + 1} de {STEPS.length}</span>
              {step < STEPS.length - 1 ? <button type="button" onClick={next}>Siguiente →</button> : null}
              {step === STEPS.length - 1 ? <button type="button" onClick={createRdc} disabled={saving}>{saving ? 'Creando RDC…' : 'Crear RDC'}</button> : null}
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
        .rdcLite .stepper { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin: 22px 0 24px; }
        .rdcLite .stp { display: flex; align-items: center; gap: 8px; text-align: left; background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 11px 10px; cursor: default; font: inherit; }
        .rdcLite .stp b { width: 26px; height: 26px; flex: none; display: flex; align-items: center; justify-content: center; border-radius: 999px; background: #eef4f8; color: var(--ink-soft); font-size: 12px; }
        .rdcLite .stp span { font-size: 12px; font-weight: 800; color: var(--ink-soft); line-height: 1.15; }
        .rdcLite .stp.active { border-color: #9be7bf; background: var(--green-soft); }
        .rdcLite .stp.active b { background: var(--green); color: #fff; }
        .rdcLite .stp.active span { color: var(--navy-d); }
        .rdcLite .stp.done { cursor: pointer; }
        .rdcLite .stp.done b { background: var(--navy); color: #fff; }
        .rdcLite .form { background: #fff; border: 1px solid var(--line); border-radius: 22px; padding: 22px; display: grid; gap: 18px; box-shadow: 0 18px 45px rgba(7,59,93,.06); }
        .rdcLite .block, .rdcLite .review { background: #f8fbfd; border: 1px solid #e5eef3; border-radius: 18px; padding: 18px; }
        .rdcLite .block h2 { margin: 0 0 14px; font-size: 18px; letter-spacing: -.02em; color: var(--navy-d); }
        .rdcLite .fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .rdcLite .field { display: grid; gap: 7px; }
        .rdcLite .field.wide { grid-column: 1 / -1; }
        .rdcLite label { font-size: 13px; font-weight: 800; color: #315873; }
        .rdcLite input, .rdcLite select, .rdcLite textarea { width: 100%; border: 1px solid #d9e7ef; background: #fff; border-radius: 12px; padding: 12px 13px; font: inherit; color: var(--ink); outline: none; min-height: 48px; }
        .rdcLite input:focus, .rdcLite select:focus, .rdcLite textarea:focus { border-color: var(--green); box-shadow: 0 0 0 3px rgba(0,193,110,.12); }
        .rdcLite textarea { resize: vertical; }
        .rdcLite .checks { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .rdcLite .checks label { display: flex; align-items: center; gap: 10px; background: #fff; border: 1px solid #d9e7ef; border-radius: 12px; padding: 12px; font-size: 13px; cursor: pointer; }
        .rdcLite .checks input { width: auto; min-height: auto; }
        .rdcLite .cutWarning { grid-column: 1 / -1; background: #fffbeb; border: 1px solid #fde68a; color: #92400e; border-radius: 12px; padding: 12px; font-weight: 800; font-size: 13px; }
        .rdcLite .systemsCatalog { grid-column: 1 / -1; display: grid; gap: 8px; }
        .rdcLite .sysGroup { background: #fff; border: 1px solid #e5eef3; border-radius: 14px; overflow: hidden; }
        .rdcLite .sysGroup summary { padding: 12px 14px; cursor: pointer; font-weight: 800; color: var(--navy-d); display: flex; gap: 8px; align-items: center; }
        .rdcLite .sysGroup summary small { color: var(--green-d); font-size: 11px; }
        .rdcLite .sysProducts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; padding: 0 14px 12px; }
        .rdcLite .sysProd { display: flex; gap: 8px; align-items: center; font-size: 12px; font-weight: 600; color: var(--ink-soft); padding: 6px 8px; border-radius: 8px; cursor: pointer; }
        .rdcLite .sysProd.active { background: var(--green-soft); color: var(--green-d); }
        .rdcLite .sysProd input { width: auto; min-height: auto; }
        .rdcLite .pimTable { grid-column: 1 / -1; display: grid; gap: 10px; }
        .rdcLite .pimRow { display: grid; grid-template-columns: 1.5fr 0.8fr 1fr 1fr 1fr auto; gap: 8px; align-items: center; }
        .rdcLite .pimRow input, .rdcLite .pimRow select { min-height: 40px; padding: 8px 10px; font-size: 13px; }
        .rdcLite .small { padding: 8px 12px; font-size: 12px; }
        .rdcLite .approvalIntro { grid-column: 1 / -1; color: var(--ink-soft); line-height: 1.45; }
        .rdcLite .approvalIntro p { margin: 0 0 8px; }
        .rdcLite .approvalRoles { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .rdcLite .approvalRole { display: flex; gap: 12px; align-items: flex-start; background: #fff; border: 1px solid #d9e7ef; border-radius: 14px; padding: 12px; cursor: pointer; }
        .rdcLite .approvalRole.active { border-color: #9be7bf; background: #f0fff7; }
        .rdcLite .approvalRole input { width: auto; min-height: auto; margin-top: 3px; }
        .rdcLite .approvalRole b { display: block; color: var(--navy-d); font-size: 13px; }
        .rdcLite .approvalRole small { display: block; color: var(--ink-soft); margin-top: 2px; font-weight: 700; font-size: 11px; }
        .rdcLite .reviewHead { display: flex; justify-content: space-between; gap: 18px; }
        .rdcLite .reviewHead h2 { margin: 0 0 8px; font-size: 26px; color: var(--navy-d); letter-spacing: -.04em; }
        .rdcLite .reviewHead p { color: var(--ink-soft); margin: 0; line-height: 1.45; max-width: 520px; }
        .rdcLite .reviewHead span { background: #fff7e6; color: #9a6700; border-radius: 999px; padding: 10px 13px; font-weight: 900; font-size: 12px; height: max-content; white-space: nowrap; }
        .rdcLite .reviewGrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
        .rdcLite .reviewGrid div { background: #fff; border: 1px solid #d9e7ef; border-radius: 12px; padding: 11px; }
        .rdcLite .reviewGrid b, .rdcLite .reviewGrid span { display: block; }
        .rdcLite .reviewGrid b { color: var(--ink-soft); font-size: 11px; margin-bottom: 4px; }
        .rdcLite .reviewGrid span { color: var(--navy-d); font-weight: 800; font-size: 13px; }
        .rdcLite .reviewSystems { margin: 12px 0; font-size: 13px; color: var(--ink-soft); line-height: 1.5; }
        .rdcLite .reviewSystems b { color: var(--navy-d); }
        .rdcLite .selectedApprovers h3 { margin: 14px 0 8px; color: var(--navy-d); font-size: 15px; }
        .rdcLite .selectedApprovers div { display: flex; flex-wrap: wrap; gap: 8px; }
        .rdcLite .selectedApprovers span { background: #ecf7ff; color: #02568c; border-radius: 999px; padding: 7px 11px; font-weight: 900; font-size: 11px; }
        .rdcLite .err { background: #fff1f0; border: 1px solid #ffd0cb; color: #c0392b; padding: 12px 14px; border-radius: 12px; font-weight: 800; font-size: 14px; }
        .rdcLite .wizNav { display: flex; align-items: center; gap: 14px; }
        .rdcLite .count { color: var(--ink-soft); font-size: 13px; font-weight: 800; margin-right: auto; }
        .rdcLite button { border: 0; background: var(--green); color: #fff; border-radius: 999px; padding: 13px 20px; font-weight: 900; cursor: pointer; font: inherit; }
        .rdcLite button:disabled { opacity: .55; cursor: not-allowed; }
        .rdcLite button.ghost, .rdcLite .ghostLink { background: #fff; color: var(--navy); border: 1px solid var(--line); padding: 13px 20px; border-radius: 999px; font-weight: 900; text-decoration: none; display: inline-flex; align-items: center; }
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
        .rdcLite .doneActions .primary { background: var(--green); color: #fff; padding: 13px 20px; border-radius: 999px; font-weight: 900; text-decoration: none; }
        .rdcLite .jiraSuccess { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 14px; padding: 14px 18px; display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
        .rdcLite .jiraSuccess .jiraIcon { font-size: 22px; flex: none; }
        .rdcLite .jiraSuccess p { margin: 0; color: #0369a1; font-size: 14px; font-weight: 700; }
        .rdcLite .jiraSuccess a { color: #0284c7; text-decoration: underline; }
        .rdcLite .jiraWarn { background: #fffbeb; border: 1px solid #fde68a; border-radius: 14px; padding: 14px 18px; display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
        .rdcLite .jiraWarn p { margin: 0; color: #92400e; font-size: 13px; font-weight: 600; line-height: 1.4; }
        .rdcLite .aiSuggestion { grid-column: 1 / -1; background: linear-gradient(135deg, #f0f9ff 0%, #ecfdf5 100%); border: 1px solid #a7f3d0; border-radius: 16px; padding: 18px; animation: aiFadeIn .3s ease; }
        @keyframes aiFadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .rdcLite .aiSugHead { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
        .rdcLite .aiSugHead .aiIcon { font-size: 22px; flex: none; }
        .rdcLite .aiSugHead b { display: block; color: var(--navy-d); font-size: 14px; margin-bottom: 4px; }
        .rdcLite .aiSugHead p { margin: 0; color: var(--ink-soft); font-size: 13px; line-height: 1.4; }
        .rdcLite .aiSugPreview { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
        .rdcLite .aiSugPreview span { background: #fff; border: 1px solid #d1fae5; border-radius: 999px; padding: 6px 12px; font-size: 12px; color: #065f46; font-weight: 700; }
        .rdcLite .aiSugPreview span b { color: #6b7280; font-weight: 600; margin-right: 4px; font-size: 11px; }
        .rdcLite .aiSugActions { display: flex; gap: 10px; align-items: center; }
        .rdcLite .aiApply { background: #059669 !important; color: #fff !important; border: 0 !important; border-radius: 999px; padding: 10px 18px; font-weight: 900; font-size: 13px; cursor: pointer; }
        .rdcLite .aiApply:hover { background: #047857 !important; }
        .rdcLite .titleComposite { display: flex; align-items: center; border: 1px solid #d9e7ef; background: #fff; border-radius: 12px; overflow: hidden; min-height: 48px; }
        .rdcLite .titleComposite:focus-within { border-color: var(--green); box-shadow: 0 0 0 3px rgba(0,193,110,.12); }
        .rdcLite .titlePrefix { flex: none; padding: 12px 14px; background: #f0fdf4; border-right: 1px solid #d1fae5; font-size: 13px; font-weight: 900; color: #065f46; white-space: nowrap; }
        .rdcLite .titleComposite input { border: 0 !important; box-shadow: none !important; min-height: auto; border-radius: 0; flex: 1; padding: 12px 14px; }
        .rdcLite .fieldHint { display: block; margin-top: 6px; font-size: 11px; color: #6b7280; font-weight: 600; }
        @media (max-width: 960px) { .rdcLite .stepper { grid-template-columns: repeat(3, 1fr); } .rdcLite .reviewGrid { grid-template-columns: repeat(2, 1fr); } .rdcLite .pimRow { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 760px) { .rdcLite .stepper, .rdcLite .fields, .rdcLite .checks, .rdcLite .approvalRoles, .rdcLite .reviewGrid, .rdcLite .sysProducts { grid-template-columns: 1fr; } .rdcLite .wizNav { flex-wrap: wrap; flex-direction: column; align-items: stretch; } .rdcLite .pimRow { grid-template-columns: 1fr; } }
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
        const response = await fetch(`/api/jira/users?q=${encodeURIComponent(trimmed)}`, { cache: 'no-store' });
        const data = await response.json();
        const rawList = Array.isArray(data) ? data : Array.isArray(data.users) ? data.users : Array.isArray(data.results) ? data.results : [];
        setUsers(rawList.map((item: any) => ({
          accountId: item.accountId || item.id,
          displayName: item.displayName || item.name || item.emailAddress,
          emailAddress: item.emailAddress || item.email,
          avatarUrl: item.avatarUrl || item.avatarUrls?.['24x24'] || '',
        })).filter((u: JiraUser) => u.displayName));
        setOpen(true);
      } catch { setUsers([]); setOpen(true); }
      finally { setLoading(false); }
    }, 300);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  function selectUser(user: JiraUser) { const name = user.displayName || ''; setQuery(name); onChange(name); setOpen(false); }

  return (
    <div className="autocomplete">
      <input value={query} onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }} onFocus={() => { if (users.length) setOpen(true); }} onBlur={() => setTimeout(() => setOpen(false), 160)} placeholder={placeholder} />
      {open && query.trim().length >= 2 ? (
        <div className="suggestions">
          {loading ? <div className="suggestionEmpty">Buscando…</div> : null}
          {!loading && users.length === 0 ? <div className="suggestionEmpty">Sin resultados</div> : null}
          {!loading && users.map((u) => (
            <button type="button" className="suggestion" key={u.accountId || u.emailAddress} onMouseDown={(e) => e.preventDefault()} onClick={() => selectUser(u)}>
              {u.avatarUrl ? <img src={u.avatarUrl} alt="" /> : null}
              <span>{u.displayName}{u.emailAddress ? <small>{u.emailAddress}</small> : null}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (<section className="block"><h2>{title}</h2><div className="fields">{children}</div></section>);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const wide = ['Nombre del cambio', 'Descripción', 'Solución', 'Servicios', 'Usuarios', 'Consecuencia', 'Plan', 'Repositorios', 'Historias', 'Rollback', 'Mitigación', 'Componente', 'Motivo', 'problema', 'solución', 'riesgo', 'afecta', 'validación', 'Sistemas afectados'].some((w) => label.includes(w));
  return (<div className={wide ? 'field wide' : 'field'}><label>{label}</label>{children}</div>);
}

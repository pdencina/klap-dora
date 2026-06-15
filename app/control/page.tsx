'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type ChangeType = 'CAB' | 'eCAB';

type ProcessStatus =
  | 'rm_review'
  | 'observed'
  | 'approval'
  | 'approved_for_pap'
  | 'pap_created'
  | 'closed'
  | 'rejected'
  | 'cancelled';

type EcabRequest = {
  id: string;
  rdc_id?: string | null;
  title: string;
  system?: string | null;
  cell?: string | null;
  status?: string | null;
  urgency_reason?: string | null;
  technical_lead?: string | null;
  validator?: string | null;
  proposed_deploy_at?: string | null;
  created_by?: string | null;
  impact?: string | null;
  risk?: string | null;
  approval_rule?: string | null;
  approvals?: string | null;
  ecab_decisions?: Array<{
    id?: string;
    stage?: string | null;
    decision?: string | null;
    actor_name?: string | null;
    actor_email?: string | null;
    comment?: string | null;
    created_at?: string | null;
  }>;
};

type ControlChange = {
  id: string;
  externalId: string;
  title: string;
  type: ChangeType;
  status: ProcessStatus;
  system: string;
  cell: string;
  requester: string;
  technicalLead: string;
  validator: string;
  priority: 'Crítica' | 'Alta' | 'Media' | 'Baja';
  impact: string;
  risk: string;
  proposedDate: string;
  sla: string;
  summary: string;
  approvals: {
    label: string;
    actor: string;
    status: 'Aprobado' | 'Pendiente' | 'Observado' | 'Rechazado';
    date?: string;
  }[];
  timeline: {
    title: string;
    detail: string;
    date?: string;
    done: boolean;
    active?: boolean;
  }[];
  evidenceCount: number;
  papCreated: boolean;
};

const demoChanges: ControlChange[] = [
  {
    id: 'demo-ecab-1',
    externalId: 'RDC-2026-045',
    title: 'Corrección reversas POS duplicadas – HOTFIX',
    type: 'eCAB',
    status: 'rm_review',
    system: 'POS, Pagos',
    cell: 'TI Aplicaciones',
    requester: 'María Salazar',
    technicalLead: 'M. Salazar',
    validator: 'Juan Pérez',
    priority: 'Crítica',
    impact: 'Alto',
    risk: 'Alto',
    proposedDate: '05/06/2026 09:15 a. m.',
    sla: '- 2h 15m',
    summary:
      'Se requiere corrección inmediata por duplicidad de reversas en transacciones POS que está generando inconsistencias contables y reclamos operativos.',
    approvals: [
      { label: 'Revisión RM', actor: 'Release Manager', status: 'Pendiente', date: '05/06 09:15' },
      { label: 'Autorización gerencial', actor: 'Rafael / Julio / Cristian', status: 'Pendiente' },
    ],
    timeline: [
      { title: 'Solicitud creada', detail: 'RDC creado con información completa.', date: '05/06 09:15', done: true },
      { title: 'Pendiente revisión RM', detail: 'En espera de evaluación del Release Manager.', active: true, done: false },
      { title: 'Autorización eCAB', detail: 'Pendiente autorización gerencial.', done: false },
      { title: 'Plan PAP', detail: 'Pendiente creación de plan.', done: false },
      { title: 'Cierre', detail: 'Pendiente cierre digital.', done: false },
    ],
    evidenceCount: 3,
    papCreated: false,
  },
  {
    id: 'demo-cab-1',
    externalId: 'RDC-2026-040',
    title: 'Actualización motor de reglas de crédito',
    type: 'CAB',
    status: 'approval',
    system: 'Core crédito',
    cell: 'TI Desarrollo',
    requester: 'J. Villanueva',
    technicalLead: 'J. Villanueva',
    validator: 'Felipe Jara',
    priority: 'Alta',
    impact: 'Medio',
    risk: 'Medio',
    proposedDate: '08/06/2026 22:00',
    sla: '- 1d 2h',
    summary: 'Cambio planificado con ventana de despliegue y validación funcional definida.',
    approvals: [
      { label: 'Arquitectura', actor: 'Equipo Arquitectura', status: 'Aprobado', date: '05/06 10:15' },
      { label: 'Seguridad', actor: 'Equipo Seguridad', status: 'Pendiente' },
      { label: 'Release', actor: 'Release Manager', status: 'Pendiente' },
    ],
    timeline: [
      { title: 'Solicitud creada', detail: 'RDC registrado.', done: true },
      { title: 'Revisión RM', detail: 'Solicitud validada.', done: true },
      { title: 'Aprobación CAB', detail: 'En aprobación por áreas.', active: true, done: false },
      { title: 'Plan PAP', detail: 'Pendiente evidencia CAB.', done: false },
      { title: 'Cierre', detail: 'Pendiente.', done: false },
    ],
    evidenceCount: 1,
    papCreated: false,
  },
  {
    id: 'demo-ecab-2',
    externalId: 'RDC-2026-043',
    title: 'Ajuste de cálculo de comisiones en liquidación',
    type: 'eCAB',
    status: 'pap_created',
    system: 'Liquidación',
    cell: 'Negocio',
    requester: 'C. Rojas',
    technicalLead: 'C. Rojas',
    validator: 'Juan Pérez',
    priority: 'Alta',
    impact: 'Alto',
    risk: 'Medio',
    proposedDate: '07/06/2026 23:00',
    sla: 'Cumple',
    summary: 'eCAB autorizado por gerencia y con Plan PAP creado para su ejecución controlada.',
    approvals: [
      { label: 'Revisión RM', actor: 'Pablo Encina', status: 'Aprobado', date: '06/06 10:15' },
      { label: 'Autorización gerencial', actor: 'Rafael / Julio / Cristian', status: 'Aprobado', date: '06/06 10:40' },
    ],
    timeline: [
      { title: 'Solicitud creada', detail: 'Solicitud eCAB registrada.', done: true },
      { title: 'Revisión RM', detail: 'Aprobada por Release Manager.', done: true },
      { title: 'Autorización eCAB', detail: 'Gerencia autorizó digitalmente.', done: true },
      { title: 'Plan PAP', detail: 'Plan PAP creado.', active: true, done: true },
      { title: 'Cierre', detail: 'Pendiente cierre digital.', done: false },
    ],
    evidenceCount: 5,
    papCreated: true,
  },
];

const statusLabel: Record<ProcessStatus, string> = {
  rm_review: 'Pendiente RM',
  observed: 'Observado',
  approval: 'En aprobación',
  approved_for_pap: 'Listo para PAP',
  pap_created: 'Con PAP creado',
  closed: 'Cerrado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
};

function mapEcabStatus(status?: string | null, rdcId?: string | null): ProcessStatus {
  if (rdcId || status === 'pap_created') return 'pap_created';
  if (status === 'rm_review' || status === 'rm_observed') return status === 'rm_observed' ? 'observed' : 'rm_review';
  if (status === 'management_authorization' || status === 'management_observed') return status === 'management_observed' ? 'observed' : 'approval';
  if (status === 'ready_for_pap' || status === 'ready_for_deploy') return 'approved_for_pap';
  if (status === 'closed') return 'closed';
  if (status === 'rm_rejected' || status === 'management_rejected') return 'rejected';
  if (status === 'cancelled') return 'cancelled';
  return 'rm_review';
}

function priorityFrom(item: EcabRequest): ControlChange['priority'] {
  const raw = `${item.impact || ''} ${item.risk || ''} ${item.urgency_reason || ''}`.toLowerCase();
  if (raw.includes('crít') || raw.includes('crit') || raw.includes('urgente') || raw.includes('hotfix')) return 'Crítica';
  if (raw.includes('alto') || raw.includes('alta')) return 'Alta';
  if (raw.includes('bajo') || raw.includes('baja')) return 'Baja';
  return 'Media';
}

function buildEcabChange(item: EcabRequest): ControlChange {
  const status = mapEcabStatus(item.status, item.rdc_id);
  const rmApproved = item.ecab_decisions?.some((d) => d.stage === 'rm' && d.decision === 'approve');
  const managementApproved = item.ecab_decisions?.filter((d) => d.stage === 'management' && d.decision === 'approve').length || 0;
  const papCreated = status === 'pap_created';

  return {
    id: item.id,
    externalId: item.rdc_id ? `RDC asociado` : `eCAB-${item.id.slice(0, 8)}`,
    title: item.title || 'Solicitud eCAB',
    type: 'eCAB',
    status,
    system: item.system || 'Sin sistema',
    cell: item.cell || 'Sin célula',
    requester: item.created_by || item.technical_lead || 'Solicitante',
    technicalLead: item.technical_lead || 'Sin líder técnico',
    validator: normalizeValidator(item.validator),
    priority: priorityFrom(item),
    impact: normalizeImpact(item.impact),
    risk: normalizeRisk(item.risk),
    proposedDate: item.proposed_deploy_at || 'Sin fecha',
    sla: status === 'closed' || papCreated ? 'Cumple' : '- 3h 40m',
    summary: item.urgency_reason || 'Solicitud eCAB registrada para revisión y trazabilidad digital.',
    approvals: [
      {
        label: 'Revisión RM',
        actor: item.ecab_decisions?.find((d) => d.stage === 'rm' && d.decision === 'approve')?.actor_name || 'Release Manager',
        status: rmApproved ? 'Aprobado' : status === 'observed' ? 'Observado' : 'Pendiente',
      },
      {
        label: 'Autorización gerencial',
        actor: 'Rafael Osorio / Julio Quiroz / Cristian Krauss',
        status: managementApproved >= 3 || papCreated || status === 'approved_for_pap' ? 'Aprobado' : 'Pendiente',
      },
    ],
    timeline: [
      { title: 'Solicitud creada', detail: 'Líder técnico registró la solicitud.', done: true },
      { title: 'Revisión RM', detail: 'Release Manager valida completitud y urgencia.', done: Boolean(rmApproved) || status !== 'rm_review', active: status === 'rm_review' },
      { title: 'Autorización eCAB', detail: 'Gerencia autoriza digitalmente.', done: managementApproved >= 3 || papCreated || status === 'approved_for_pap', active: status === 'approval' },
      { title: 'Plan PAP', detail: 'Se habilita PAP con evidencia del cambio.', done: papCreated, active: status === 'approved_for_pap' || status === 'pap_created' },
      { title: 'Cierre', detail: 'Validación post deploy y cierre digital.', done: status === 'closed', active: status === 'closed' },
    ],
    evidenceCount: item.ecab_decisions?.length || 0,
    papCreated,
  };
}

function badgeTone(status: ProcessStatus) {
  if (status === 'rm_review') return 'blue';
  if (status === 'observed') return 'orange';
  if (status === 'approval') return 'purple';
  if (status === 'approved_for_pap' || status === 'pap_created') return 'green';
  if (status === 'closed') return 'slate';
  return 'red';
}

function priorityTone(priority: string) {
  if (priority === 'Crítica') return 'critical';
  if (priority === 'Alta') return 'high';
  if (priority === 'Baja') return 'low';
  return 'medium';
}


function primaryDisplayId(item: ControlChange) {
  if (item.type === 'eCAB') {
    if (item.externalId === 'RDC asociado') return `eCAB-${item.id.slice(0, 4)}`;
    if (item.externalId.toLowerCase().includes('rdc')) return item.externalId;
    return item.externalId;
  }

  return item.externalId;
}

function secondaryDisplayId(item: ControlChange) {
  if (item.type === 'eCAB') {
    if (item.externalId === 'RDC asociado') return 'RDC asociado';
    if (item.externalId.toLowerCase().includes('rdc')) return 'Origen: eCAB';
    return 'Solicitud urgente';
  }

  return 'Origen: CAB';
}


function flowLabelOf(item?: ControlChange | null) {
  if (!item) return 'Flujo no definido';
  return item.type === 'eCAB' ? 'Flujo: eCAB urgente' : 'Flujo: CAB regular';
}

function processActionLabel(item?: ControlChange | null) {
  if (!item) return '{processActionLabel(selected)}';
  if (item.status === 'rm_review' || item.status === 'observed') return 'Revisar solicitud';
  if (item.status === 'approval') return item.type === 'eCAB' ? 'Ver autorización gerencial' : 'Ver aprobaciones CAB';
  if (item.status === 'approved_for_pap') return 'Crear Plan PAP';
  if (item.status === 'pap_created') return 'Abrir Plan PAP';
  if (item.status === 'closed') return 'Ver cierre';
  return '{processActionLabel(selected)}';
}

function expedienteCompleteness(item?: ControlChange | null) {
  if (!item) return 0;
  const checks = [
    Boolean(item.title),
    Boolean(item.system),
    Boolean(item.requester),
    Boolean(item.technicalLead),
    Boolean(item.validator && item.validator !== 'Sin validador definido'),
    Boolean(item.impact),
    Boolean(item.risk),
    item.approvals.some((approval) => approval.status === 'Aprobado'),
    item.evidenceCount > 0,
    item.papCreated || item.status === 'approved_for_pap' || item.status === 'closed',
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function normalizeImpact(value?: string | null) {
  const raw = String(value || '').trim();
  const normalized = raw.toLowerCase();
  if (!raw || normalized.includes('prueba') || normalized.includes('test')) return 'Medio';
  if (normalized.includes('alto') || normalized.includes('crít') || normalized.includes('crit')) return 'Alto';
  if (normalized.includes('bajo')) return 'Bajo';
  return raw;
}

function normalizeRisk(value?: string | null) {
  const raw = String(value || '').trim();
  const normalized = raw.toLowerCase();
  if (!raw || normalized.includes('prueba') || normalized.includes('test')) return 'Medio';
  if (normalized.includes('alto') || normalized.includes('crít') || normalized.includes('crit')) return 'Alto';
  if (normalized.includes('bajo')) return 'Bajo';
  return raw;
}

function normalizeValidator(value?: string | null) {
  const raw = String(value || '').trim();
  const normalized = raw.toLowerCase();
  if (!raw || normalized.includes('prueba') || normalized.includes('test')) return 'Sin validador definido';
  return raw;
}


function actionRouteOf(item?: ControlChange | null) {
  if (!item) return '/control';

  if (item.type === 'eCAB') {
    if (item.status === 'pap_created') return `/pap?rdcId=${encodeURIComponent(item.id)}`;
    return `/ecab`;
  }

  if (item.status === 'approval') return `/approvals`;
  if (item.status === 'approved_for_pap' || item.status === 'pap_created') return `/pap?rdcId=${encodeURIComponent(item.id)}`;
  if (item.status === 'closed') return `/cierre?rdcId=${encodeURIComponent(item.id)}`;

  return `/approvals`;
}

function expedienteRouteOf(item?: ControlChange | null) {
  if (!item) return '/control';

  if (item.type === 'eCAB') return '/ecab';
  return `/mis-cambios`;
}

function approvalRouteOf(item?: ControlChange | null) {
  if (!item) return '/approvals';

  if (item.type === 'eCAB') return '/ecab';
  return '/approvals';
}


export default function ControlCenterPage() {
  const router = useRouter();
  const [changes, setChanges] = useState<ControlChange[]>(demoChanges);
  const [selectedId, setSelectedId] = useState(demoChanges[0].id);
  const [filter, setFilter] = useState<'all' | ProcessStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ChangeType>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;

    async function loadEcabs() {
      try {
        const response = await fetch('/api/ecab', { cache: 'no-store' });
        const data = await response.json().catch(() => null);

        if (!active) return;

        if (response.ok && data?.ok && Array.isArray(data.ecabs) && data.ecabs.length) {
          const mapped = data.ecabs.map((item: EcabRequest) => buildEcabChange(item));
          const merged = [...mapped, ...demoChanges.filter((item) => item.type === 'CAB')];
          setChanges(merged);
          setSelectedId(mapped[0]?.id || merged[0]?.id || demoChanges[0].id);
        }
      } catch {
        // Mantiene fallback demo para no romper la vista si la API aún no está disponible.
      }
    }

    loadEcabs();

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();

    return changes.filter((item) => {
      const matchesStatus = filter === 'all' || item.status === filter;
      const matchesType = typeFilter === 'all' || item.type === typeFilter;
      const matchesTerm =
        !term ||
        item.title.toLowerCase().includes(term) ||
        item.externalId.toLowerCase().includes(term) ||
        item.system.toLowerCase().includes(term) ||
        item.requester.toLowerCase().includes(term);

      return matchesStatus && matchesType && matchesTerm;
    });
  }, [changes, filter, typeFilter, query]);

  const selected = changes.find((item) => item.id === selectedId) || filtered[0] || changes[0];

  const kpis = useMemo(() => {
    const count = (status: ProcessStatus) => changes.filter((item) => item.status === status).length;

    return [
      { label: 'Pendientes RM', value: count('rm_review'), icon: '▣', tone: 'blue', status: 'rm_review' as ProcessStatus },
      { label: 'Observados', value: count('observed'), icon: '◔', tone: 'orange', status: 'observed' as ProcessStatus },
      { label: 'En aprobación', value: count('approval'), icon: '⬟', tone: 'purple', status: 'approval' as ProcessStatus },
      { label: 'Listos para PAP', value: count('approved_for_pap'), icon: '✓', tone: 'green', status: 'approved_for_pap' as ProcessStatus },
      { label: 'Con PAP creado', value: count('pap_created'), icon: '▤', tone: 'blue', status: 'pap_created' as ProcessStatus },
      { label: 'Cerrados', value: count('closed'), icon: '▰', tone: 'slate', status: 'closed' as ProcessStatus },
    ];
  }, [changes]);

  function openExpediente() {
    router.push(expedienteRouteOf(selected));
  }

  function openMainAction() {
    router.push(actionRouteOf(selected));
  }

  function openApprovals() {
    router.push(approvalRouteOf(selected));
  }


  const processMetrics = [
    { label: 'Cumplimiento SLA', value: '92%', help: 'Cambios dentro del SLA acordado', tone: 'green' },
    { label: 'Cambios gestionados', value: String(changes.length), help: 'Total en proceso visible', tone: 'blue' },
    { label: 'Tiempo promedio', value: '8.6 h', help: 'Desde solicitud hasta aprobación', tone: 'purple' },
    { label: 'Evidencia completa', value: '97%', help: 'Cambios con evidencia adjunta', tone: 'orange' },
  ];

  const officialFlow = [
    ['1', 'Solicitud', 'RDC/eCAB creado con información completa'],
    ['2', 'Revisión RM', 'Release Manager evalúa completitud y urgencia'],
    ['3', 'CAB / eCAB', 'Aprobación por áreas o autorización gerencial'],
    ['4', 'Plan PAP', 'Se habilita PAP con evidencia del cambio'],
    ['5', 'Cierre', 'Cierre digital con validación y evidencia final'],
  ];

  return (
    <main className="controlPage">
      <header className="controlHeader">
        <div>
          <p className="kicker">Release Management</p>
          <h1>Centro de Control CAB / eCAB</h1>
          <p>Gobernanza y control del proceso de cambios. Trazabilidad, aprobaciones y evidencia oficial.</p>
        </div>

        <div className="headerTools">
          <label className="searchBox">
            <span>⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar cambio, RDC, solicitante..."
            />
          </label>
          <button type="button" className="exportButton">⇩ Exportar reporte</button>
        </div>
      </header>

      <section className="kpiGrid">
        {kpis.map((item) => (
          <button
            type="button"
            key={item.label}
            className={`kpiCard ${item.tone} ${filter === item.status ? 'active' : ''}`}
            onClick={() => setFilter(filter === item.status ? 'all' : item.status)}
          >
            <span className="kpiIcon">{item.icon}</span>
            <div>
              <small>{item.label}</small>
              <b>{item.value}</b>
              <em>Ver detalle →</em>
            </div>
          </button>
        ))}
      </section>

      <section className="controlGrid">
        <div className="mainColumn">
          <section className="decisionPanel">
            <div className="panelHead">
              <div>
                <h2>Bandeja de control del proceso</h2>
                <p>Cambios que requieren revisión, aprobación o seguimiento del Release Manager</p>
              </div>
              <div className="filters">
                <button className={typeFilter === 'all' ? 'active' : ''} type="button" onClick={() => setTypeFilter('all')}>Todos</button>
                <button className={typeFilter === 'CAB' ? 'active' : ''} type="button" onClick={() => setTypeFilter('CAB')}>CAB</button>
                <button className={typeFilter === 'eCAB' ? 'active' : ''} type="button" onClick={() => setTypeFilter('eCAB')}>eCAB</button>
              </div>
            </div>

            <div className="statusTabs">
              {[
                ['all', 'Todos'],
                ['rm_review', 'Pendientes RM'],
                ['observed', 'Observados'],
                ['approval', 'En aprobación'],
                ['approved_for_pap', 'Listos para PAP'],
                ['pap_created', 'Con PAP creado'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={filter === value ? 'active' : ''}
                  onClick={() => setFilter(value as 'all' | ProcessStatus)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="decisionTable">
              <div className="tableHeader">
                <span>RDC / ID</span>
                <span>Tipo</span>
                <span>Título del cambio</span>
                <span>Solicitante</span>
                <span>Prioridad</span>
                <span>Estado actual</span>
                <span>SLA</span>
              </div>

              {filtered.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={selected?.id === item.id ? 'tableRow selected' : 'tableRow'}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span>
                    <b>{primaryDisplayId(item)}</b>
                    <small>{secondaryDisplayId(item)}</small>
                  </span>
                  <span><em className={`typeBadge ${item.type === 'eCAB' ? 'ecab' : 'cab'}`}>{item.type}</em></span>
                  <span><b>{item.title}</b><small>{item.system}</small></span>
                  <span><b>{item.requester}</b><small>{item.cell}</small></span>
                  <span><em className={`priority ${priorityTone(item.priority)}`}>{item.priority}</em></span>
                  <span><em className={`statusBadge ${badgeTone(item.status)}`}>{statusLabel[item.status]}</em></span>
                  <span className={item.sla.startsWith('-') ? 'sla late' : 'sla'}>{item.sla}</span>
                </button>
              ))}

              {!filtered.length ? <div className="emptyState">No hay cambios para los filtros seleccionados.</div> : null}
            </div>
          </section>

          <section className="flowPanel">
            <div>
              <h2>Flujo oficial del proceso de cambio</h2>
              <p>Vista del proceso de punta a punta</p>
            </div>
            <div className="officialFlow">
              {officialFlow.map(([step, title, help], index) => (
                <div className="flowStep" key={step}>
                  <span>{step}</span>
                  <b>{title}</b>
                  <small>{help}</small>
                  {index < officialFlow.length - 1 ? <i /> : null}
                </div>
              ))}
            </div>
          </section>

          <section className="metricsPanel">
            <h2>Indicadores del proceso <span>(30 días)</span></h2>
            <div className="metricGrid">
              {processMetrics.map((item) => (
                <article className={`metricCard ${item.tone}`} key={item.label}>
                  <b>{item.value}</b>
                  <strong>{item.label}</strong>
                  <p>{item.help}</p>
                  <div className="sparkline" />
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="detailPanel">
          <div className="detailHead">
            <h2>Detalle del cambio seleccionado</h2>
            <span>⌃</span>
          </div>

          {selected ? (
            <>
              <div className="selectedTitle">
                <div>
                  <p>
                    <strong>{primaryDisplayId(selected)}</strong>
                    <em className={`typeBadge ${selected.type === 'eCAB' ? 'ecab' : 'cab'}`}>{selected.type}</em>
                    <em className="flowBadge">{flowLabelOf(selected)}</em>
                    {selected.priority === 'Crítica' ? <em className="priority critical">HOTFIX</em> : null}
                  </p>
                  <h3>{selected.title}</h3>
                </div>
                <em className={`statusBadge ${badgeTone(selected.status)}`}>{statusLabel[selected.status]}</em>
              </div>

              <div className="detailFacts">
                <span><small>Solicitante</small><b>{selected.requester}</b></span>
                <span><small>Ambiente objetivo</small><b>Producción</b></span>
                <span><small>Sistema</small><b>{selected.system}</b></span>
                <span><small>Validador</small><b>{selected.validator}</b></span>
                <span><small>Impacto</small><b className="dangerText">{selected.impact}</b></span>
                <span><small>Riesgo</small><b>{selected.risk}</b></span>
              </div>

              <div className="detailTabs">
                <b>Resumen</b>
                <span>Aprobaciones</span>
                <span>Evidencias <em>{selected.evidenceCount}</em></span>
                <span>Plan PAP</span>
                <span>Trazabilidad</span>
              </div>

              <p className="summaryText">{selected.summary}</p>

              <section className="completenessBox">
                <div>
                  <h4>Completitud del expediente</h4>
                  <strong>{expedienteCompleteness(selected)}%</strong>
                </div>
                <div className="progressTrack">
                  <span style={{ width: `${expedienteCompleteness(selected)}%` }} />
                </div>
                <ul>
                  <li className="done">Solicitud completa</li>
                  <li className={selected.approvals.some((approval) => approval.status === 'Aprobado') ? 'done' : ''}>Aprobaciones registradas</li>
                  <li className={selected.evidenceCount > 0 ? 'done' : ''}>Evidencias adjuntas</li>
                  <li className={selected.papCreated ? 'done' : ''}>Plan PAP asociado</li>
                </ul>
              </section>

              <section className="approvalBox">
                <h4>Aprobaciones</h4>
                {selected.approvals.map((item) => (
                  <div className="approvalRow" key={item.label}>
                    <span>
                      <b>{item.label}</b>
                      <small>{item.actor}</small>
                    </span>
                    <em className={`approvalStatus ${item.status.toLowerCase()}`}>{item.status}</em>
                  </div>
                ))}
              </section>

              <section className="timelineBox">
                <h4>Línea de tiempo del cambio</h4>
                <div className="timeline">
                  {selected.timeline.map((item) => (
                    <div className={item.active ? 'timelineItem active' : item.done ? 'timelineItem done' : 'timelineItem'} key={item.title}>
                      <span />
                      <div>
                        <b>{item.title}</b>
                        <p>{item.detail}</p>
                        {item.date ? <small>{item.date}</small> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="detailActions">
                <button type="button" onClick={openExpediente}>▣ Ver expediente completo</button>
                <button type="button" className="primary" onClick={openMainAction}>{processActionLabel(selected)}</button>
              </div>
            </>
          ) : null}
        </aside>
      </section>

      <style jsx>{`
        .controlPage {
          min-height: 100vh;
          padding: 28px clamp(18px, 3vw, 44px) 56px;
          background: #f3f8fb;
          color: #00395f;
          box-sizing: border-box;
        }

        .controlHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 24px;
        }

        .kicker {
          margin: 0 0 8px;
          color: #00a86b;
          font-size: 12px;
          letter-spacing: .18em;
          text-transform: uppercase;
          font-weight: 950;
        }

        h1, h2, h3, p { margin-top: 0; }

        h1 {
          margin-bottom: 8px;
          font-size: clamp(34px, 3.2vw, 52px);
          line-height: 1;
          letter-spacing: -.055em;
        }

        .controlHeader p {
          color: #5c7187;
          font-size: 16px;
          margin-bottom: 0;
        }

        .headerTools {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .searchBox {
          width: min(360px, 38vw);
          min-height: 48px;
          border: 1px solid #dce8f0;
          border-radius: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 14px;
          background: #fff;
        }

        .searchBox input {
          width: 100%;
          border: 0;
          outline: 0;
          font: inherit;
          color: #00395f;
          background: transparent;
        }

        button {
          font: inherit;
        }

        .exportButton {
          min-height: 48px;
          border-radius: 14px;
          border: 1px solid #dce8f0;
          background: #fff;
          color: #0058d8;
          padding: 0 18px;
          font-weight: 900;
          cursor: pointer;
        }

        .kpiGrid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .kpiCard, .decisionPanel, .flowPanel, .metricsPanel, .detailPanel {
          background: #fff;
          border: 1px solid #dce8f0;
          border-radius: 20px;
          box-shadow: 0 16px 36px rgba(7, 59, 93, .05);
        }

        .kpiCard {
          min-height: 100px;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px;
          text-align: left;
          cursor: pointer;
          color: #00395f;
          transition: transform .16s ease, border-color .16s ease;
        }

        .kpiCard:hover,
        .kpiCard.active {
          transform: translateY(-2px);
          border-color: #9fdcbd;
        }

        .kpiIcon {
          width: 44px;
          height: 44px;
          border-radius: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 950;
          background: #eaf4ff;
          color: #0b63ce;
        }

        .kpiCard.green .kpiIcon { background: #e8fff3; color: #00a86b; }
        .kpiCard.orange .kpiIcon { background: #fff4df; color: #bd6a00; }
        .kpiCard.purple .kpiIcon { background: #f0e9ff; color: #7c3aed; }
        .kpiCard.slate .kpiIcon { background: #eef2f6; color: #536579; }

        .kpiCard small {
          display: block;
          font-weight: 900;
          color: #48627a;
        }

        .kpiCard b {
          display: block;
          font-size: 30px;
          color: #00a86b;
          line-height: 1;
          margin: 5px 0;
        }

        .kpiCard em {
          font-style: normal;
          color: #0058d8;
          font-weight: 900;
          font-size: 12px;
        }

        .controlGrid {
          display: grid;
          grid-template-columns: minmax(0, 1.65fr) minmax(360px, .9fr);
          gap: 18px;
          align-items: start;
        }

        .mainColumn {
          display: flex;
          flex-direction: column;
          gap: 18px;
          min-width: 0;
        }

        .decisionPanel, .flowPanel, .metricsPanel, .detailPanel {
          padding: 18px;
        }

        .panelHead {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 14px;
        }

        .panelHead h2,
        .flowPanel h2,
        .metricsPanel h2,
        .detailHead h2 {
          margin-bottom: 4px;
          font-size: 20px;
          letter-spacing: -.03em;
        }

        .panelHead p,
        .flowPanel p {
          margin: 0;
          color: #61768c;
          font-size: 13px;
        }

        .filters, .statusTabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .filters button,
        .statusTabs button {
          min-height: 34px;
          border: 1px solid #dce8f0;
          background: #fff;
          color: #00395f;
          border-radius: 999px;
          padding: 0 14px;
          font-weight: 900;
          cursor: pointer;
        }

        .filters button.active,
        .statusTabs button.active {
          color: #007a4c;
          background: #e8fff3;
          border-color: #aeecc8;
        }

        .statusTabs {
          padding-bottom: 14px;
          border-bottom: 1px solid #e5edf3;
          margin-bottom: 0;
        }

        .decisionTable {
          overflow: hidden;
        }

        .tableHeader,
        .tableRow {
          display: grid;
          grid-template-columns: 1fr .7fr 1.6fr 1.2fr .8fr 1fr .65fr;
          gap: 12px;
          align-items: center;
        }

        .tableHeader {
          padding: 14px 8px;
          color: #587189;
          font-size: 12px;
          font-weight: 950;
        }

        .tableRow {
          width: 100%;
          border: 0;
          border-top: 1px solid #e5edf3;
          background: #fff;
          padding: 14px 8px;
          text-align: left;
          color: #00395f;
          cursor: pointer;
        }

        .tableRow:hover,
        .tableRow.selected {
          background: #f7fbff;
        }

        .tableRow span {
          min-width: 0;
        }

        .tableRow b {
          display: block;
          font-size: 13px;
        }

        .tableRow small {
          display: block;
          color: #64788e;
          margin-top: 4px;
          font-size: 12px;
        }

        .typeBadge,
        .statusBadge,
        .priority,
        .approvalStatus {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          line-height: 1;
          font-style: normal;
          font-weight: 950;
          white-space: nowrap;
        }

        .typeBadge.ecab { color: #008f57; background: #dcfce7; }
        .typeBadge.cab { color: #0058d8; background: #eaf4ff; }

        .priority.critical { color: #d01818; background: #ffe7e7; }
        .priority.high { color: #dc6b00; background: #fff0dc; }
        .priority.medium { color: #a16207; background: #fff7d6; }
        .priority.low { color: #008f57; background: #e8fff3; }

        .statusBadge.blue { color: #0058d8; background: #eaf4ff; }
        .statusBadge.orange { color: #bd6a00; background: #fff4df; }
        .statusBadge.purple { color: #7c3aed; background: #f0e9ff; }
        .statusBadge.green { color: #008f57; background: #e8fff3; }
        .statusBadge.slate { color: #536579; background: #eef2f6; }
        .statusBadge.red { color: #cc1f1f; background: #ffe7e7; }

        .sla {
          color: #008f57;
          font-weight: 950;
        }

        .sla.late {
          color: #e11d48;
        }

        .emptyState {
          padding: 26px;
          color: #60748a;
          text-align: center;
          border-top: 1px solid #e5edf3;
        }

        .flowPanel {
          overflow: hidden;
        }

        .officialFlow {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 16px;
          margin-top: 18px;
        }

        .flowStep {
          position: relative;
          min-width: 0;
        }

        .flowStep span {
          width: 42px;
          height: 42px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #00a86b;
          background: #e8fff3;
          border: 1px solid #aeecc8;
          font-weight: 950;
          margin-bottom: 10px;
        }

        .flowStep i {
          position: absolute;
          top: 21px;
          left: 54px;
          right: 8px;
          border-top: 1px dashed #9eb2c4;
        }

        .flowStep b {
          display: block;
          margin-bottom: 6px;
        }

        .flowStep small {
          color: #5f7389;
          line-height: 1.35;
        }

        .metricGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .metricsPanel h2 span {
          color: #60748a;
          font-weight: 700;
        }

        .metricCard {
          border: 1px solid #e0eaf1;
          border-radius: 16px;
          padding: 16px;
          background: #fff;
        }

        .metricCard b {
          display: block;
          color: #00a86b;
          font-size: 28px;
          margin-bottom: 10px;
        }

        .metricCard.blue b { color: #0058d8; }
        .metricCard.purple b { color: #7c3aed; }
        .metricCard.orange b { color: #f97316; }

        .metricCard strong {
          display: block;
          margin-bottom: 6px;
        }

        .metricCard p {
          margin: 0;
          color: #60748a;
          font-size: 12px;
          line-height: 1.35;
        }

        .sparkline {
          height: 28px;
          margin-top: 14px;
          border-radius: 999px;
          background:
            linear-gradient(135deg, transparent 0 20%, rgba(0,168,107,.35) 21% 25%, transparent 26% 42%, rgba(0,168,107,.25) 43% 48%, transparent 49% 100%),
            #f4faf7;
        }

        .detailPanel {
          position: sticky;
          top: 20px;
        }

        .detailHead {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 14px;
          border-bottom: 1px solid #e5edf3;
          margin-bottom: 16px;
        }

        .selectedTitle {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .selectedTitle p {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }

        .selectedTitle h3 {
          font-size: 22px;
          line-height: 1.1;
          letter-spacing: -.03em;
          margin-bottom: 0;
        }

        .detailFacts {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .detailFacts span {
          border: 1px solid #e0eaf1;
          background: #f8fbfd;
          border-radius: 14px;
          padding: 12px;
        }

        .detailFacts small {
          display: block;
          color: #61768c;
          font-weight: 800;
          margin-bottom: 5px;
        }

        .dangerText {
          color: #e11d48;
        }

        .detailTabs {
          display: flex;
          gap: 16px;
          align-items: center;
          border-bottom: 1px solid #e5edf3;
          margin-bottom: 14px;
          overflow-x: auto;
        }

        .detailTabs b,
        .detailTabs span {
          padding: 0 0 12px;
          white-space: nowrap;
          font-size: 13px;
          font-weight: 900;
        }

        .detailTabs b {
          color: #0058d8;
          border-bottom: 3px solid #0058d8;
        }

        .detailTabs span {
          color: #506981;
        }

        .detailTabs em {
          font-style: normal;
          padding: 3px 7px;
          background: #eaf4ff;
          border-radius: 999px;
        }

        .summaryText {
          color: #526b83;
          font-size: 14px;
          line-height: 1.45;
          margin-bottom: 18px;
        }


        .flowBadge {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          line-height: 1;
          font-style: normal;
          font-weight: 950;
          color: #0058d8;
          background: #eaf4ff;
        }

        .completenessBox {
          margin: 16px 0 18px;
          border: 1px solid #dce8f0;
          background: #f8fbfd;
          border-radius: 16px;
          padding: 14px;
        }

        .completenessBox > div:first-child {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 10px;
        }

        .completenessBox h4 { margin: 0; }
        .completenessBox strong { color: #00a86b; font-size: 22px; }

        .progressTrack {
          height: 10px;
          border-radius: 999px;
          background: #e5edf3;
          overflow: hidden;
          margin-bottom: 12px;
        }

        .progressTrack span {
          display: block;
          height: 100%;
          border-radius: 999px;
          background: #00a86b;
        }

        .completenessBox ul {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .completenessBox li {
          color: #7a8da0;
          font-size: 12px;
          font-weight: 850;
        }

        .completenessBox li::before { content: '○'; margin-right: 6px; }
        .completenessBox li.done { color: #008f57; }
        .completenessBox li.done::before { content: '✓'; }

        .approvalBox,
        .timelineBox {
          margin-top: 18px;
        }

        .approvalBox h4,
        .timelineBox h4 {
          margin: 0 0 10px;
        }

        .approvalRow {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          border: 1px solid #e0eaf1;
          border-radius: 14px;
          padding: 12px;
          margin-bottom: 8px;
        }

        .approvalRow small {
          display: block;
          color: #64788e;
          margin-top: 3px;
        }

        .approvalStatus.aprobado { color: #008f57; background: #e8fff3; }
        .approvalStatus.pendiente { color: #0058d8; background: #eaf4ff; }
        .approvalStatus.observado { color: #bd6a00; background: #fff4df; }
        .approvalStatus.rechazado { color: #cc1f1f; background: #ffe7e7; }

        .timeline {
          border-left: 2px solid #dce8f0;
          margin-left: 10px;
          padding-left: 16px;
        }

        .timelineItem {
          position: relative;
          padding: 0 0 18px;
        }

        .timelineItem > span {
          position: absolute;
          left: -24px;
          top: 2px;
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: #fff;
          border: 2px solid #a8b9ca;
        }

        .timelineItem.done > span {
          background: #00a86b;
          border-color: #00a86b;
        }

        .timelineItem.active > span {
          background: #fff;
          border-color: #0058d8;
          box-shadow: 0 0 0 4px #eaf4ff;
        }

        .timelineItem b {
          display: block;
          margin-bottom: 4px;
        }

        .timelineItem p {
          margin: 0;
          color: #61768c;
          font-size: 13px;
        }

        .timelineItem small {
          color: #8ba0b4;
          font-size: 12px;
        }

        .detailActions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 18px;
        }

        .detailActions button {
          min-height: 44px;
          border-radius: 12px;
          border: 1px solid #dce8f0;
          background: #fff;
          color: #0058d8;
          font-weight: 950;
          cursor: pointer;
        }

        .detailActions .primary {
          background: #0058d8;
          color: #fff;
          border-color: #0058d8;
        }

        @media (max-width: 1250px) {
          .kpiGrid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .controlGrid { grid-template-columns: 1fr; }
          .detailPanel { position: static; }
        }

        @media (max-width: 860px) {
          .controlHeader { flex-direction: column; }
          .headerTools { width: 100%; justify-content: stretch; }
          .searchBox { width: 100%; }
          .kpiGrid { grid-template-columns: 1fr; }
          .tableHeader { display: none; }
          .tableRow {
            grid-template-columns: 1fr;
            gap: 8px;
            border: 1px solid #e0eaf1;
            border-radius: 16px;
            margin-bottom: 10px;
          }
          .officialFlow,
          .metricGrid,
          .detailFacts {
            grid-template-columns: 1fr;
          }
          .flowStep i { display: none; }
        }
      `}</style>
    </main>
  );
}

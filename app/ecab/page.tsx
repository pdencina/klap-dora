'use client';

import Link from 'next/link';

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

const sampleEcabs = [
  {
    id: 'demo-1',
    title: 'Mantención servicio consulta de terminales',
    system: 'Autoconfiguración POS Itaú',
    status: 'management_authorization' as EcabStatus,
    urgency_reason: 'Compromiso con negocio por incrementales de afiliación y autoconfiguración.',
    technical_lead: 'Bryan González',
    validator: 'Nicolás Pantoja / Felipe Jara',
    proposed_deploy_at: '08-06-2026',
    affected_systems: 'Autoconfiguración POS Itaú / Order Manager / Activación POS / Consulta BO',
    approvals: '0/3',
  },
  {
    id: 'demo-2',
    title: '[HOTFIX] Corrección reversas POS duplicadas',
    system: 'POS · Adquirencia',
    status: 'ready_for_pap' as EcabStatus,
    urgency_reason: 'Corrección requerida antes del siguiente CAB por impacto operativo.',
    technical_lead: 'Pablo Encina',
    validator: 'Ximena Cruz',
    proposed_deploy_at: 'Hoy 22:00',
    affected_systems: 'POS / Clearing / Adquirencia',
    approvals: '3/3',
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

const questions = [
  'Motivo no puede esperar al siguiente CAB',
  'Nombre de cambio',
  '¿Cuál es el problema?',
  '¿Cuál es la solución?',
  '¿Qué riesgo tiene aplicar este cambio?',
  '¿A quién afecta este cambio?',
  'Fecha/Hora propuesta para despliegue',
  'Fecha/Hora de validación post despliegue',
  'Validador',
  'Plan de validación en producción',
  'Sistemas afectados',
  'Link ticket productivo JIRA / ERFC',
];

export default function EcabPage() {
  const selected = sampleEcabs[0];

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
          <Link href="/rdc?type=ECAB">Nueva solicitud eCAB</Link>
          <button type="button">Configurar reglas</button>
        </div>
      </header>

      <section className="kpis">
        <article><span>Pendientes RM</span><b>4</b></article>
        <article><span>En autorización</span><b>2</b></article>
        <article><span>Aprobados gerencia</span><b>3</b></article>
        <article><span>Listos para PAP</span><b>1</b></article>
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

      <section className="layout">
        <aside className="queue">
          <div className="queueHead">
            <h2>Solicitudes eCAB</h2>
            <span>{sampleEcabs.length}</span>
          </div>

          {sampleEcabs.map((ecab) => (
            <button key={ecab.id} className={ecab.id === selected.id ? 'ecabItem active' : 'ecabItem'} type="button">
              <strong>{ecab.title}</strong>
              <small>{ecab.system}</small>
              <em>{statusLabel[ecab.status]}</em>
            </button>
          ))}
        </aside>

        <section className="detail">
          <article className="requestCard">
            <div className="requestTop">
              <div>
                <p className="kicker">Solicitud formal eCAB</p>
                <h2>{selected.title}</h2>
                <p>{selected.system}</p>
              </div>
              <span className="statusPill">{statusLabel[selected.status]}</span>
            </div>

            <div className="summaryGrid">
              <div><span>Líder técnico</span><b>{selected.technical_lead}</b></div>
              <div><span>Validador</span><b>{selected.validator}</b></div>
              <div><span>Fecha deploy</span><b>{selected.proposed_deploy_at}</b></div>
              <div><span>Autorización</span><b>{selected.approvals}</b></div>
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
              <span className="completeBadge">12/12 completo</span>
            </div>

            <div className="questionGrid">
              {questions.map((question, index) => (
                <div key={question}>
                  <span>{index + 1}</span>
                  <b>{question}</b>
                  <small>{index === 0 ? selected.urgency_reason : 'Respuesta registrada digitalmente.'}</small>
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

        <aside className="audit">
          <h3>Expediente digital</h3>

          <div className="auditStep done"><span>✓</span><div><b>Solicitud creada</b><small>Líder técnico registró eCAB.</small></div></div>
          <div className="auditStep done"><span>✓</span><div><b>Revisión RM</b><small>Release Manager revisa y da OK.</small></div></div>
          <div className="auditStep active"><span>◷</span><div><b>Autorización gerencial</b><small>Esperando decisión de autorizadores.</small></div></div>
          <div className="auditStep"><span>○</span><div><b>Plan PAP</b><small>Se habilita al aprobar eCAB.</small></div></div>
          <div className="auditStep"><span>○</span><div><b>Deploy y cierre</b><small>Ejecución y validación post deploy.</small></div></div>

          <div className="ruleBox">
            <span>Regla de aprobación</span>
            <b>2 de 3 autorizadores</b>
            <small>Configurable por criticidad del eCAB.</small>
          </div>
        </aside>
      </section>

      <style jsx>{`
        .ecabPage { width:100%; min-height:100vh; padding:32px clamp(18px, 3vw, 42px) 64px; color:#00395f; background:#eef5f8; box-sizing:border-box; }
        .hero,.flowCard,.queue,.requestCard,.questionsCard,.decisionCard,.audit,.kpis article { background:#fff; border:1px solid #dfeaf0; border-radius:24px; box-shadow:0 18px 45px rgba(7,59,93,.06); }
        .hero { display:flex; align-items:flex-start; justify-content:space-between; gap:28px; padding:30px; margin-bottom:20px; }
        .kicker { margin:0 0 8px; color:#00a86b; font-weight:950; letter-spacing:.18em; font-size:12px; text-transform:uppercase; }
        h1,h2,h3,p { margin-top:0; }
        h1 { font-size:clamp(38px, 4vw, 64px); line-height:.98; letter-spacing:-.06em; margin-bottom:14px; }
        .hero p { color:#60748a; font-size:18px; line-height:1.45; max-width:880px; margin-bottom:0; }
        .heroActions { display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
        .heroActions a,.heroActions button { min-height:44px; border-radius:999px; padding:0 18px; border:1px solid #dfeaf0; background:#fff; color:#00395f; font-weight:900; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; }
        .heroActions a { background:#00b86b; color:#fff; border-color:#00b86b; }
        .kpis { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:16px; margin-bottom:20px; }
        .kpis article { padding:20px; }
        .kpis span,.summaryGrid span,.urgencyBox span,.ruleBox span { color:#60748a; font-size:12px; font-weight:900; display:block; margin-bottom:6px; }
        .kpis b { font-size:34px; color:#00a86b; }
        .flowCard { padding:24px; margin-bottom:20px; }
        .sectionHead { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:18px; }
        .sectionHead h2,.sectionHead h3 { margin:0; letter-spacing:-.04em; }
        .digitalBadge,.completeBadge,.statusPill { border-radius:999px; padding:9px 13px; background:#e8fff3; color:#008f57; font-weight:950; white-space:nowrap; }
        .flow { display:grid; grid-template-columns:1fr 26px 1fr 26px 1fr 26px 1fr 26px 1fr 26px 1fr 26px 1fr; align-items:stretch; }
        .flowItemWrap { display:contents; }
        .flowItem { border:1px solid #dfeaf0; border-radius:18px; padding:16px; background:#f8fbfd; min-height:130px; }
        .flowItem.done { background:#f0fff7; border-color:#bbf7d0; }
        .flowItem span { width:34px; height:34px; border-radius:999px; background:#00b86b; color:#fff; display:inline-flex; align-items:center; justify-content:center; font-weight:950; margin-bottom:12px; }
        .flowItem b { display:block; margin-bottom:6px; }
        .flowItem small { color:#60748a; font-weight:700; line-height:1.35; }
        .flowConnector { height:2px; align-self:center; border-top:2px dotted #9fb8cc; }
        .layout { display:grid; grid-template-columns:minmax(270px, 320px) minmax(0, 1fr) minmax(280px, 340px); gap:20px; align-items:start; }
        .queue,.audit { padding:22px; position:sticky; top:24px; }
        .queueHead { display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:16px; }
        .queueHead h2 { margin:0; letter-spacing:-.04em; }
        .queueHead span { width:38px; height:38px; border-radius:999px; background:#e8fff3; color:#008f57; display:inline-flex; align-items:center; justify-content:center; font-weight:950; }
        .ecabItem { width:100%; border:1px solid #dfeaf0; border-radius:16px; background:#f8fbfd; text-align:left; padding:16px; margin-bottom:12px; display:flex; flex-direction:column; gap:7px; cursor:pointer; }
        .ecabItem.active { background:#f0fff7; border-color:#86efac; }
        .ecabItem strong { color:#00395f; line-height:1.25; }
        .ecabItem small { color:#60748a; font-weight:800; }
        .ecabItem em { color:#008f57; font-style:normal; font-weight:950; font-size:12px; }
        .detail { display:grid; gap:18px; min-width:0; }
        .requestCard,.questionsCard,.decisionCard { padding:24px; }
        .requestTop { display:flex; justify-content:space-between; gap:18px; margin-bottom:18px; }
        .requestTop h2 { font-size:clamp(28px, 2.5vw, 44px); line-height:1.05; letter-spacing:-.05em; margin-bottom:8px; }
        .requestTop p { color:#60748a; margin-bottom:0; }
        .summaryGrid { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:12px; margin-bottom:16px; }
        .summaryGrid div,.urgencyBox { border:1px solid #dfeaf0; border-radius:14px; background:#f8fbfd; padding:14px; min-width:0; }
        .summaryGrid b { display:block; overflow-wrap:anywhere; }
        .urgencyBox p { margin:0; color:#00395f; line-height:1.4; }
        .questionGrid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:12px; }
        .questionGrid div { border:1px solid #dfeaf0; border-radius:14px; background:#f8fbfd; padding:14px; min-width:0; }
        .questionGrid span { width:28px; height:28px; border-radius:999px; background:#e8fff3; color:#008f57; display:inline-flex; align-items:center; justify-content:center; font-weight:950; margin-bottom:8px; }
        .questionGrid b { display:block; margin-bottom:7px; line-height:1.25; }
        .questionGrid small { color:#60748a; font-weight:700; line-height:1.35; }
        .decisionGrid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; margin-bottom:12px; }
        .decisionGrid button { min-height:48px; border:0; border-radius:14px; color:#fff; font-weight:950; cursor:pointer; }
        .approve { background:#00b86b; } .observe { background:#f59e0b; } .reject { background:#dc2626; }
        textarea { width:100%; min-height:110px; border:1px solid #dfeaf0; border-radius:14px; padding:14px; font:inherit; box-sizing:border-box; resize:vertical; }
        .audit h3 { margin-bottom:18px; letter-spacing:-.04em; }
        .auditStep { display:grid; grid-template-columns:34px 1fr; gap:12px; padding:13px 0; border-bottom:1px solid #edf3f7; }
        .auditStep span { width:32px; height:32px; border-radius:999px; background:#eef5f8; display:inline-flex; align-items:center; justify-content:center; font-weight:950; }
        .auditStep.done span,.auditStep.active span { background:#e8fff3; color:#008f57; }
        .auditStep b { display:block; }
        .auditStep small { color:#60748a; font-weight:700; line-height:1.35; }
        .ruleBox { margin-top:18px; border:1px solid #bbf7d0; border-radius:16px; background:#f0fff7; padding:16px; }
        .ruleBox b { display:block; margin-bottom:6px; }
        .ruleBox small { color:#60748a; font-weight:700; }
        @media(max-width:1350px){ .layout { grid-template-columns:1fr; } .queue,.audit { position:relative; top:auto; } .flow { grid-template-columns:repeat(4, minmax(0, 1fr)); gap:12px; } .flowItemWrap { display:block; } .flowConnector { display:none; } }
        @media(max-width:960px){ .hero,.requestTop,.sectionHead { flex-direction:column; } .kpis,.summaryGrid,.questionGrid,.decisionGrid { grid-template-columns:1fr; } .flow { grid-template-columns:1fr; } .heroActions { width:100%; justify-content:flex-start; } }
      `}</style>
    </main>
  );
}

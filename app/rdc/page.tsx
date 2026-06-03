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
const sistemaOptions = ['POS', 'Anticipo', 'Abono Ya', 'Bridge', 'H2H', 'BO', 'SmartVista', 'API', 'Middleware', 'Portal', 'Otro'];
const celulaOptions = ['SmartVista', 'POS', 'Adquirencia', 'Adquirencia Clearing', 'Core', 'Boleta Electrónica y Multiservicios', 'Operaciones', 'QA', 'Infraestructura', 'Otro'];
const impactOptions = ['Bajo', 'Medio', 'Alto', 'Crítico'];
const priorityOptions = ['Baja', 'Media', 'Alta', 'Urgente'];

const STEPS = [
  { title: 'General y origen', help: 'Qué cambio es, en qué sistema y de dónde viene.' },
  { title: 'Responsables y aprobadores', help: 'Quiénes participan, qué áreas aprueban y cuándo se propone subir.' },
  { title: 'Descripción y riesgo', help: 'Detalle del cambio, validación, impacto y prioridad.' },
  { title: 'Dependencias y despliegue', help: 'De qué depende y cómo se ejecuta / revierte.' },
];

const APPROVER_ROLES = ['Dueño Cambio', 'QA', 'DBA', 'Deployment', 'Release Management', 'Redes', 'Seguridad', 'Infraestructura', 'Arquitectura'];

export default function RdcPage() {
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);
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
    selectedApprovalRoles: ['Dueño Cambio', 'QA', 'DBA', 'Deployment'] as string[],
    requirementDescription: '',
    implementedSolution: '',
    affectedServices: '',
    affectedUsers: '',
    consequenceNotImplementing: '',
    validationPlan: '',
    deploymentPlan: '',
    rollbackPlan: '',
    impact: 'Medio',
    priority: 'Media',
    requiresDba: false,
    requiresNetworks: false,
    requiresInfra: false,
    requiresMonitoring: false,
    dependentRdc: '',
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
      if (!form.proposedDeployDate) return 'Indica la fecha propuesta de paso a producción.';
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
        // No se envían deploymentResult ni validationDate: son post-deploy (cierre RM).
        body: JSON.stringify({ ...form, approvalRoleConfig: getSelectedApprovalConfig() }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'No fue posible crear el RDC');
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
          <p>Tu cambio quedó guardado y se generaron las aprobaciones por área. Puedes seguir su estado desde Mis Cambios.</p>
          <div className="doneActions">
            <a className="primary" href="/mis-cambios">Ver en Mis Cambios →</a>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setCreated(false);
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
            <p className="kicker">REGISTRO DE CAMBIO</p>
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
                    <textarea value={form.description} onChange={(e) => update('description', e.target.value)} rows={4} placeholder="Resumen breve del cambio." />
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
                </Block>

                <Block title="2. Origen del cambio">
                  <Field label="Jira Origen">
                    <input value={form.jiraOrigin} onChange={(e) => update('jiraOrigin', e.target.value)} placeholder="Ej: BEMS-1692 / TRX-931" />
                  </Field>
                  <Field label="RFC">
                    <input value={form.rfc} onChange={(e) => update('rfc', e.target.value)} placeholder="Ej: RFC-1234 / No aplica" />
                  </Field>
                </Block>
              </>
            )}

            {step === 1 && (
              <>
                <Block title="3. Responsables">
                  <Field label="Presentador"><UserAutocomplete value={form.presenter} placeholder="Buscar presentador en Jira" onChange={(v) => update('presenter', v)} /></Field>
                  <Field label="Líder Técnico"><UserAutocomplete value={form.technicalLead} placeholder="Buscar líder técnico en Jira" onChange={(v) => update('technicalLead', v)} /></Field>
                  <Field label="Analista QA"><UserAutocomplete value={form.qaAnalyst} placeholder="Buscar analista QA en Jira" onChange={(v) => update('qaAnalyst', v)} /></Field>
                  <Field label="Validador Negocio"><UserAutocomplete value={form.businessValidator} placeholder="Buscar validador en Jira" onChange={(v) => update('businessValidator', v)} /></Field>
                </Block>

                <Block title="4. Aprobadores requeridos">
                  <div className="approvalIntro">
                    <p>Selecciona las áreas que deben aprobar este cambio. Al crear el RDC se generan las aprobaciones pendientes.</p>
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

                <Block title="5. Fecha propuesta">
                  <Field label="Fecha propuesta paso a producción *">
                    <input type="date" value={form.proposedDeployDate} onChange={(e) => update('proposedDeployDate', e.target.value)} />
                  </Field>
                </Block>
              </>
            )}

            {step === 2 && (
              <>
                <Block title="6. Descripción del cambio">
                  <Field label="Descripción del requerimiento"><textarea value={form.requirementDescription} onChange={(e) => update('requirementDescription', e.target.value)} rows={5} placeholder="Qué necesidad o problema resuelve." /></Field>
                  <Field label="Solución implementada"><textarea value={form.implementedSolution} onChange={(e) => update('implementedSolution', e.target.value)} rows={4} placeholder="Qué se modificó o implementó." /></Field>
                  <Field label="Servicios afectados"><textarea value={form.affectedServices} onChange={(e) => update('affectedServices', e.target.value)} rows={3} placeholder="APIs, módulos o componentes impactados." /></Field>
                  <Field label="Usuarios afectados"><textarea value={form.affectedUsers} onChange={(e) => update('affectedUsers', e.target.value)} rows={3} placeholder="Clientes, comercios, operaciones, etc." /></Field>
                  <Field label="Consecuencia si no se implementa"><textarea value={form.consequenceNotImplementing} onChange={(e) => update('consequenceNotImplementing', e.target.value)} rows={3} placeholder="Riesgo de posponer / no aprobar." /></Field>
                </Block>

                <Block title="7. Validación">
                  <Field label="Plan de validación post implantación"><textarea value={form.validationPlan} onChange={(e) => update('validationPlan', e.target.value)} rows={4} placeholder="Cómo se validará luego del PAP." /></Field>
                </Block>

                <Block title="8. Riesgo y prioridad">
                  <Field label="Impacto"><select value={form.impact} onChange={(e) => update('impact', e.target.value)}>{impactOptions.map((o) => <option key={o}>{o}</option>)}</select></Field>
                  <Field label="Prioridad"><select value={form.priority} onChange={(e) => update('priority', e.target.value)}>{priorityOptions.map((o) => <option key={o}>{o}</option>)}</select></Field>
                </Block>
              </>
            )}

            {step === 3 && (
              <>
                <Block title="9. Dependencias">
                  <div className="checks">
                    <label><input type="checkbox" checked={form.requiresDba} onChange={(e) => update('requiresDba', e.target.checked)} /> Requiere DBA</label>
                    <label><input type="checkbox" checked={form.requiresNetworks} onChange={(e) => update('requiresNetworks', e.target.checked)} /> Requiere Redes</label>
                    <label><input type="checkbox" checked={form.requiresInfra} onChange={(e) => update('requiresInfra', e.target.checked)} /> Requiere Infraestructura</label>
                    <label><input type="checkbox" checked={form.requiresMonitoring} onChange={(e) => update('requiresMonitoring', e.target.checked)} /> Requiere Monitoreo</label>
                  </div>
                  <Field label="RDC dependiente"><input value={form.dependentRdc} onChange={(e) => update('dependentRdc', e.target.value)} placeholder="Ej: RDC-2026-001 / No aplica" /></Field>
                </Block>

                <Block title="10. Despliegue">
                  <Field label="Plan Deploy"><textarea value={form.deploymentPlan} onChange={(e) => update('deploymentPlan', e.target.value)} rows={5} placeholder="Pasos, pipelines, repos, PRs, responsables." /></Field>
                  <Field label="Plan Rollback"><textarea value={form.rollbackPlan} onChange={(e) => update('rollbackPlan', e.target.value)} rows={5} placeholder="Pasos para volver a la última versión estable." /></Field>
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
        .rdc { max-width: 920px; margin: 0 auto; padding: 32px 6vw 64px; }
        .rdc .head { margin-bottom: 18px; }
        .rdc .kicker { color: var(--green-d); font-size: 13px; font-weight: 800; letter-spacing: .16em; margin: 0 0 8px; }
        .rdc h1 { font-size: clamp(30px, 4vw, 44px); line-height: 1.05; letter-spacing: -.03em; color: var(--navy-d); margin: 0; }
        .rdc .sub { color: var(--ink-soft); margin: 10px 0 0; font-size: 16px; }

        .rdc .stepper { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 22px 0 24px; }
        .rdc .stp { display: flex; align-items: center; gap: 10px; text-align: left; background: #fff; border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; cursor: default; font: inherit; }
        .rdc .stp b { width: 26px; height: 26px; flex: none; display: flex; align-items: center; justify-content: center; border-radius: 999px; background: #eef4f8; color: var(--ink-soft); font-size: 13px; }
        .rdc .stp span { font-size: 13px; font-weight: 700; color: var(--ink-soft); }
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

        .rdc .err { background: #fff1f0; border: 1px solid #ffd0cb; color: #c0392b; padding: 12px 14px; border-radius: 12px; font-weight: 700; font-size: 14px; }
        .rdc .wizNav { display: flex; align-items: center; gap: 14px; }
        .rdc .count { color: var(--ink-soft); font-size: 13px; font-weight: 700; margin-right: auto; }
        .rdc button { border: 0; background: var(--green); color: #fff; border-radius: 999px; padding: 13px 20px; font-weight: 800; cursor: pointer; }
        .rdc button:disabled { opacity: .55; cursor: not-allowed; }
        .rdc button.ghost { background: #fff; color: var(--navy); border: 1px solid var(--line); }

        .rdc .autocomplete { position: relative; }
        .rdc .suggestions { position: absolute; z-index: 20; top: calc(100% + 6px); left: 0; right: 0; background: #fff; border: 1px solid #d9e7ef; border-radius: 14px; box-shadow: 0 18px 45px rgba(7,59,93,.14); overflow: hidden; }
        .rdc .suggestion { width: 100%; border: 0; border-radius: 0; background: #fff; color: var(--ink); display: flex; align-items: center; gap: 10px; padding: 11px 12px; text-align: left; cursor: pointer; font-weight: 700; }
        .rdc .suggestion:hover { background: var(--bg); }
        .rdc .suggestion img { width: 26px; height: 26px; border-radius: 999px; }
        .rdc .suggestion small { display: block; color: var(--ink-soft); font-weight: 600; }
        .rdc .suggestionEmpty { padding: 12px; color: var(--ink-soft); font-size: 13px; }

        .rdc .done { background: #fff; border: 1px solid var(--line); border-radius: 20px; padding: 44px; text-align: center; max-width: 560px; margin: 40px auto; }
        .rdc .done .check { display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 999px; background: var(--green-soft); color: var(--green-d); font-size: 28px; font-weight: 800; }
        .rdc .done h1 { margin: 18px 0 8px; }
        .rdc .done p { color: var(--ink-soft); line-height: 1.5; margin: 0 0 24px; }
        .rdc .doneActions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .rdc .doneActions .primary { background: var(--green); color: #fff; padding: 13px 20px; border-radius: 999px; font-weight: 800; }
        .rdc .doneActions .ghost { background: #fff; color: var(--navy); border: 1px solid var(--line); padding: 13px 20px; border-radius: 999px; font-weight: 800; }

        @media (max-width: 760px) {
          .rdc .stepper { grid-template-columns: 1fr 1fr; }
          .rdc .fields, .rdc .checks, .rdc .approvalRoles { grid-template-columns: 1fr; }
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
  const wide = ['Resumen', 'Descripción', 'Plan', 'Solución', 'Servicios', 'Usuarios', 'Consecuencia'].some((w) => label.includes(w));
  return (
    <div className={wide ? 'field wide' : 'field'}>
      <label>{label}</label>
      {children}
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';

type DeploymentRun = {
  id: string;
  job_name: string;
  status: string;
  result?: string | null;
  build_url?: string | null;
  queue_url?: string | null;
  triggered_by?: string | null;
  triggered_at?: string | null;
};

type Closure = {
  id: string;
  result: string;
  real_start_at?: string | null;
  real_end_at?: string | null;
  had_rollback: boolean;
  had_incident: boolean;
  incident_jira?: string | null;
  qa_validation?: string | null;
  business_validation?: string | null;
  technical_validation?: string | null;
  service_impact?: string | null;
  observations?: string | null;
  closed_by?: string | null;
  closed_at?: string | null;
  deployment_run_id?: string | null;
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
  change_closures?: Closure[];
};

const resultOptions = ['Exitoso', 'Fallido', 'Rollback', 'Con incidente'];

const STATUS_LABEL: Record<string, string> = {
  EN_IMPLEMENTACION: 'En implementación',
  IMPLEMENTADO_EXITOSO: 'Implementado exitoso',
  IMPLEMENTADO_CON_INCIDENTE: 'Implementado con incidente',
  ROLLBACK: 'Rollback',
  CERRADO: 'Cerrado',
  PAP_CREADO: 'Plan PAP creado',
};

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  try {
    return new Date(value).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return value;
  }
}

function dateTimeLocal(value?: string | null) {
  if (!value) return '';
  try {
    const d = new Date(value);
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  } catch {
    return '';
  }
}

function lastRun(change?: Change | null) {
  const runs = [...(change?.deployment_runs || [])];
  return runs.sort((a, b) => new Date(b.triggered_at || 0).getTime() - new Date(a.triggered_at || 0).getTime())[0];
}

function lastClosure(change?: Change | null) {
  const closures = [...(change?.change_closures || [])];
  return closures.sort((a, b) => new Date(b.closed_at || 0).getTime() - new Date(a.closed_at || 0).getTime())[0];
}

function statusHuman(status?: string) {
  if (!status) return 'Sin estado';
  return STATUS_LABEL[status] || status.replaceAll('_', ' ');
}

function durationText(start?: string | null, end?: string | null) {
  if (!start || !end) return 'No calculado';
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(diff) || diff < 0) return 'No calculado';
  const min = Math.round(diff / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return `${h}h ${r}m`;
}

export default function CierrePage() {
  const [changes, setChanges] = useState<Change[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const selected = useMemo(() => changes.find((c) => c.id === selectedId) || null, [changes, selectedId]);
  const run = lastRun(selected);
  const closure = lastClosure(selected);

  const [form, setForm] = useState({
    result: 'Exitoso',
    realStartAt: '',
    realEndAt: '',
    hadRollback: false,
    hadIncident: false,
    incidentJira: '',
    qaValidation: '',
    businessValidation: '',
    technicalValidation: '',
    serviceImpact: '',
    observations: '',
    deploymentRunId: '',
  });

  async function load() {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/cierre/list', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'No se pudo cargar cierre');

      const list: Change[] = data.changes || [];
      setChanges(list);

      if (list.length && !selectedId) {
        setSelectedId(list[0].id);
        hydrateForm(list[0]);
      }
    } catch (err: any) {
      setError(err?.message || 'Error cargando cierre');
    } finally {
      setLoading(false);
    }
  }

  function hydrateForm(change: Change) {
    const c = lastClosure(change);
    const r = lastRun(change);

    setForm({
      result: c?.result || (r?.result === 'FAILURE' ? 'Fallido' : 'Exitoso'),
      realStartAt: dateTimeLocal(c?.real_start_at || r?.triggered_at || new Date().toISOString()),
      realEndAt: dateTimeLocal(c?.real_end_at || new Date().toISOString()),
      hadRollback: Boolean(c?.had_rollback),
      hadIncident: Boolean(c?.had_incident),
      incidentJira: c?.incident_jira || '',
      qaValidation: c?.qa_validation || '',
      businessValidation: c?.business_validation || '',
      technicalValidation: c?.technical_validation || '',
      serviceImpact: c?.service_impact || '',
      observations: c?.observations || '',
      deploymentRunId: c?.deployment_run_id || r?.id || '',
    });
  }

  useEffect(() => {
    load();
  }, []);

  function selectChange(change: Change) {
    setSelectedId(change.id);
    setMsg('');
    setError('');
    hydrateForm(change);
  }

  function update(name: string, value: string | boolean) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function validate() {
    if (!selected) return 'Selecciona un cambio.';
    if (!form.result) return 'Selecciona resultado.';
    if (!form.realStartAt) return 'Indica hora real de inicio.';
    if (!form.realEndAt) return 'Indica hora real de término.';
    if (form.hadIncident && !form.incidentJira.trim()) return 'Si hubo incidente, indica el Jira del incidente.';
    if (!form.qaValidation.trim()) return 'Registra validación QA o justificación.';
    if (!form.technicalValidation.trim()) return 'Registra validación técnica.';
    return '';
  }

  async function saveClosure() {
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }

    if (!selected) return;

    const confirmed = window.confirm(
      `Vas a cerrar el cambio:\n\n${selected.title}\n\nResultado: ${form.result}\nRollback: ${form.hadRollback ? 'Sí' : 'No'}\nIncidente: ${form.hadIncident ? 'Sí' : 'No'}\n\n¿Continuar?`,
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError('');
      setMsg('');

      const response = await fetch('/api/cierre/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rdcId: selected.id,
          closureId: closure?.id || '',
          deploymentRunId: form.deploymentRunId || null,
          result: form.result,
          realStartAt: form.realStartAt ? new Date(form.realStartAt).toISOString() : null,
          realEndAt: form.realEndAt ? new Date(form.realEndAt).toISOString() : null,
          hadRollback: form.hadRollback || form.result === 'Rollback',
          hadIncident: form.hadIncident || form.result === 'Con incidente' || form.result === 'Fallido',
          incidentJira: form.incidentJira,
          qaValidation: form.qaValidation,
          businessValidation: form.businessValidation,
          technicalValidation: form.technicalValidation,
          serviceImpact: form.serviceImpact,
          observations: form.observations,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'No se pudo guardar cierre');

      setMsg(`Cierre guardado. Estado del RDC: ${statusHuman(data.rdcStatus)}`);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Error guardando cierre');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="cierre">
      <header className="head">
        <div>
          <p className="kicker">CIERRE Y EVIDENCIA</p>
          <h1>Cierre del cambio</h1>
          <p className="sub">
            Registra el resultado real del despliegue, rollback, incidente, validaciones y evidencia para alimentar DORA.
          </p>
        </div>
        <button className="ghostBtn" type="button" onClick={load}>Actualizar</button>
      </header>

      {loading ? <div className="state">Cargando cambios para cierre…</div> : null}
      {error ? <div className="state error">{error}</div> : null}

      {!loading && !error ? (
        <section className="layout">
          <aside className="queue">
            <div className="queueHead">
              <h2>Para cierre</h2>
              <span>{changes.length}</span>
            </div>

            {changes.length === 0 ? (
              <p className="empty">No hay cambios pendientes de cierre.</p>
            ) : (
              <div className="queueList">
                {changes.map((change) => {
                  const c = lastClosure(change);
                  const r = lastRun(change);

                  return (
                    <button
                      key={change.id}
                      type="button"
                      className={change.id === selectedId ? 'queueItem active' : 'queueItem'}
                      onClick={() => selectChange(change)}
                    >
                      <strong>{change.title}</strong>
                      <small>{change.system || 'Sin sistema'} · {statusHuman(change.status)}</small>
                      <em>{c ? `Cierre: ${c.result}` : r ? `Run: ${r.status}` : 'Sin cierre'}</em>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="content">
            {selected ? (
              <>
                <div className="heroCard">
                  <div>
                    <p className="kicker">Cambio seleccionado</p>
                    <h2>{selected.title}</h2>
                    <p>{selected.system || 'Sin sistema'} · {selected.cell || 'Sin célula'} · {selected.category || 'Sin categoría'}</p>
                  </div>
                  <span className="statusPill">{statusHuman(selected.status)}</span>
                </div>

                <div className="summaryGrid">
                  <div><span>Pipeline</span><b>{run?.job_name || 'Sin ejecución'}</b></div>
                  <div><span>Run Jenkins</span><b>{run?.status || 'Sin run'}</b></div>
                  <div><span>Duración real</span><b>{durationText(form.realStartAt, form.realEndAt)}</b></div>
                  <div><span>Cierre</span><b>{closure ? closure.result : 'Pendiente'}</b></div>
                </div>

                <section className="closureCard">
                  <div className="closureHead">
                    <div>
                      <p className="kicker">Resultado del paso</p>
                      <h3>Registrar cierre operativo</h3>
                      <p>Esta información queda como evidencia y alimenta métricas DORA.</p>
                    </div>
                    {run?.build_url ? <a className="ghostLink" href={run.build_url} target="_blank" rel="noreferrer">Ver Jenkins ↗</a> : null}
                  </div>

                  <div className="formGrid">
                    <label>
                      Resultado *
                      <select value={form.result} onChange={(e) => update('result', e.target.value)}>
                        {resultOptions.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    </label>

                    <label>
                      Ejecución Jenkins asociada
                      <select value={form.deploymentRunId} onChange={(e) => update('deploymentRunId', e.target.value)}>
                        <option value="">Sin asociar</option>
                        {(selected.deployment_runs || []).map((r) => (
                          <option key={r.id} value={r.id}>{r.job_name} · {formatDate(r.triggered_at)}</option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Hora real inicio *
                      <input type="datetime-local" value={form.realStartAt} onChange={(e) => update('realStartAt', e.target.value)} />
                    </label>

                    <label>
                      Hora real término *
                      <input type="datetime-local" value={form.realEndAt} onChange={(e) => update('realEndAt', e.target.value)} />
                    </label>

                    <label className="check">
                      <input type="checkbox" checked={form.hadRollback} onChange={(e) => update('hadRollback', e.target.checked)} />
                      ¿Hubo rollback?
                    </label>

                    <label className="check">
                      <input type="checkbox" checked={form.hadIncident} onChange={(e) => update('hadIncident', e.target.checked)} />
                      ¿Hubo incidente?
                    </label>

                    <label>
                      Jira incidente
                      <input value={form.incidentJira} onChange={(e) => update('incidentJira', e.target.value)} placeholder="Ej: INC-1234 / PA-1234" />
                    </label>

                    <label>
                      Impacto en servicio
                      <input value={form.serviceImpact} onChange={(e) => update('serviceImpact', e.target.value)} placeholder="Sin impacto / Intermitencia / Degradación" />
                    </label>

                    <label className="wide">
                      Validación QA *
                      <textarea value={form.qaValidation} onChange={(e) => update('qaValidation', e.target.value)} rows={3} placeholder="Qué validó QA o por qué no aplica." />
                    </label>

                    <label className="wide">
                      Validación técnica *
                      <textarea value={form.technicalValidation} onChange={(e) => update('technicalValidation', e.target.value)} rows={3} placeholder="Validaciones técnicas post deploy." />
                    </label>

                    <label className="wide">
                      Validación negocio
                      <textarea value={form.businessValidation} onChange={(e) => update('businessValidation', e.target.value)} rows={3} placeholder="Validación funcional/negocio si aplica." />
                    </label>

                    <label className="wide">
                      Observaciones finales
                      <textarea value={form.observations} onChange={(e) => update('observations', e.target.value)} rows={4} placeholder="Observaciones, evidencias, acuerdos o comentarios de cierre." />
                    </label>
                  </div>

                  <div className="actions">
                    <button className="ghostBtn" type="button" onClick={() => hydrateForm(selected)}>Restaurar</button>
                    <button type="button" onClick={saveClosure} disabled={saving}>{saving ? 'Guardando cierre…' : 'Guardar cierre'}</button>
                  </div>
                </section>

                {msg ? <div className="msg">{msg}</div> : null}
              </>
            ) : (
              <div className="state">Selecciona un cambio para cerrar.</div>
            )}
          </section>
        </section>
      ) : null}

      <style jsx>{`
        .cierre { max-width: 1360px; margin: 0 auto; padding: 32px 5vw 64px; }
        .head { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:24px; }
        .kicker { color:var(--green-d); font-size:13px; font-weight:900; letter-spacing:.16em; margin:0 0 8px; }
        h1 { font-size:clamp(36px,5vw,58px); line-height:.98; letter-spacing:-.06em; margin:0; color:var(--navy-d); }
        .sub { color:var(--ink-soft); line-height:1.5; max-width:760px; margin:12px 0 0; }
        .layout { display:grid; grid-template-columns:360px minmax(0,1fr); gap:18px; }
        .queue, .content > section, .heroCard, .state { background:#fff; border:1px solid var(--line); border-radius:22px; box-shadow:0 18px 45px rgba(7,59,93,.06); }
        .queue { padding:20px; }
        .queueHead { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
        .queueHead h2, .closureCard h3 { margin:0; color:var(--navy-d); letter-spacing:-.03em; }
        .queueHead span { background:var(--green-soft); color:var(--green-d); font-weight:900; border-radius:999px; padding:8px 12px; }
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
        .statusPill { background:#ecf7ff; color:#02568c; border-radius:999px; padding:10px 13px; font-weight:900; white-space:nowrap; }
        .summaryGrid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
        .summaryGrid div { background:#fff; border:1px solid var(--line); border-radius:18px; padding:16px; }
        .summaryGrid span { display:block; color:var(--ink-soft); font-weight:800; font-size:12px; margin-bottom:6px; }
        .summaryGrid b { color:var(--navy-d); font-size:17px; word-break:break-word; }
        .closureCard { padding:20px; }
        .closureHead { display:flex; justify-content:space-between; gap:18px; margin-bottom:18px; }
        .closureHead p { color:var(--ink-soft); margin:8px 0 0; }
        .formGrid { display:grid; grid-template-columns:repeat(2,1fr); gap:14px; }
        label { display:grid; gap:7px; color:#315873; font-weight:900; font-size:13px; }
        label.wide { grid-column:1 / -1; }
        label.check { display:flex; align-items:center; gap:10px; background:var(--bg); border:1px solid #dfeaf0; border-radius:14px; padding:13px; }
        label.check input { width:auto; min-height:auto; }
        input, select, textarea { width:100%; border:1px solid #d9e7ef; background:#fff; border-radius:12px; padding:12px 13px; font:inherit; color:var(--ink); outline:none; min-height:48px; }
        textarea { resize:vertical; }
        input:focus, select:focus, textarea:focus { border-color:var(--green); box-shadow:0 0 0 3px rgba(0,193,110,.12); }
        button, .ghostBtn, .ghostLink { border:0; background:var(--green); color:#fff; border-radius:999px; padding:13px 18px; font-weight:900; cursor:pointer; }
        button:disabled { opacity:.55; cursor:not-allowed; }
        .ghostBtn, .ghostLink { background:#fff; color:var(--navy); border:1px solid var(--line); }
        .actions { display:flex; justify-content:flex-end; gap:10px; margin-top:18px; }
        .state { padding:28px; color:var(--ink-soft); }
        .state.error { background:#fff1f0; color:#b42318; }
        .empty { color:var(--ink-soft); }
        .msg { background:#e8fff3; color:#008f57; border:1px solid #bbf7d0; border-radius:14px; padding:12px 14px; font-weight:900; }
        @media(max-width:1120px){ .layout{grid-template-columns:1fr;} }
        @media(max-width:760px){ .head,.heroCard,.closureHead{flex-direction:column;} .summaryGrid,.formGrid{grid-template-columns:1fr;} label.wide{grid-column:auto;} .actions{flex-direction:column;} }
      `}</style>
    </main>
  );
}

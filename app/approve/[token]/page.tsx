'use client';

import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type Approval = {
  id: string;
  rdc_id: string;
  approver_role: string;
  approver_name: string;
  approver_email?: string | null;
  status: string;
  comment?: string | null;
  approved_at?: string | null;
  approval_token?: string | null;
  approval_verified_at?: string | null;
  approved_by_email?: string | null;
  approved_ip?: string | null;
  rdc?: {
    id: string;
    title: string;
    description?: string | null;
    category?: string | null;
    system?: string | null;
    cell?: string | null;
    status?: string | null;
    presenter?: string | null;
    technical_lead?: string | null;
    qa_analyst?: string | null;
    business_validator?: string | null;
    proposed_deploy_date?: string | null;
    validation_date?: string | null;
    jira_origin?: string | null;
    rfc?: string | null;
    deployment_result?: string | null;
  } | null;
};

const tone: Record<string, string> = {
  PENDIENTE: 'pending',
  APROBADO: 'ok',
  OBSERVADO: 'watch',
  RECHAZADO: 'bad',
};

const statusText: Record<string, string> = {
  PENDIENTE_APROBACIONES: 'En aprobación CAB Digital',
  APROBADO_PARA_EJECUCION: 'Listo para PAP',
  OBSERVADO: 'Observado',
  RECHAZADO: 'Rechazado',
};

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  try {
    return new Date(value).toLocaleDateString('es-CL');
  } catch {
    return value;
  }
}

function approvalLabel(status: string) {
  if (status === 'APROBADO') return '✓ Aprobado';
  if (status === 'OBSERVADO') return '● Observado';
  if (status === 'RECHAZADO') return '✕ Rechazado';
  return '⏳ Pendiente';
}

export default function ApproveTokenPage() {
  const params = useParams();
  const token = useMemo(() => String(params?.token || ''), [params]);

  const [approval, setApproval] = useState<Approval | null>(null);
  const [allApprovals, setAllApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpMessage, setOtpMessage] = useState('');
  const [code, setCode] = useState('');
  const [verified, setVerified] = useState(false);

  async function load() {
    if (!token) return;

    try {
      setLoading(true);
      setError('');

      const response = await fetch(`/api/approvals/token?token=${encodeURIComponent(token)}`, {
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'No fue posible cargar aprobación');
      }

      const loadedApproval = data.approval as Approval;
      setApproval(loadedApproval);
      setVerified(Boolean(loadedApproval?.approval_verified_at));

      if (loadedApproval?.rdc_id) {
        const listResponse = await fetch('/api/approvals/list', { cache: 'no-store' });
        const listData = await listResponse.json();

        if (listResponse.ok && listData.ok) {
          const change = (listData.changes || []).find((item: any) => item.id === loadedApproval.rdc_id);
          setAllApprovals(change?.approval_requests || []);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Error cargando aprobación');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function sendCode() {
    try {
      setBusy(true);
      setOtpMessage('');

      const response = await fetch('/api/approvals/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'No fue posible enviar código');
      }

      setOtpSent(true);
      setOtpMessage(data.debugCode ? `${data.message} Código debug: ${data.debugCode}` : data.message);
    } catch (err: any) {
      alert(err?.message || 'Error enviando código');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    try {
      setBusy(true);

      const response = await fetch('/api/approvals/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Código inválido');
      }

      setVerified(true);
      await load();
    } catch (err: any) {
      alert(err?.message || 'Error validando código');
    } finally {
      setBusy(false);
    }
  }

  async function submit(action: 'APROBADO' | 'OBSERVADO' | 'RECHAZADO') {
    const comment = action === 'APROBADO' ? '' : window.prompt('Comentario u observación') || '';

    try {
      setBusy(true);

      const response = await fetch('/api/approvals/token-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action, comment }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'No fue posible procesar aprobación');
      }

      await load();
      alert(`Aprobación registrada: ${action}`);
    } catch (err: any) {
      alert(err?.message || 'Error procesando aprobación');
    } finally {
      setBusy(false);
    }
  }

  const alreadyProcessed = approval && approval.status !== 'PENDIENTE';
  const total = allApprovals.length || 1;
  const approved = allApprovals.filter((item) => item.status === 'APROBADO').length;
  const observed = allApprovals.filter((item) => item.status === 'OBSERVADO').length;
  const rejected = allApprovals.filter((item) => item.status === 'RECHAZADO').length;
  const pending = allApprovals.filter((item) => item.status === 'PENDIENTE').length;
  const progress = Math.round((approved / total) * 100);
  const cabState = rejected > 0 ? 'CAB RECHAZADO' : observed > 0 ? 'CAB OBSERVADO' : pending === 0 ? 'LISTO PARA PAP' : 'CAB EN APROBACIÓN';
  const cabTone = rejected > 0 ? 'bad' : observed > 0 ? 'watch' : pending === 0 ? 'ok' : 'pending';

  return (
    <main className="page">
      <section className="shell">
        <header className="topbar">
          <div>
            <div className="brand">klap</div>
            <p className="kicker">CAB Digital · Release Management</p>
          </div>
          <div className={`cabState ${cabTone}`}>{cabState}</div>
        </header>

        {loading ? <div className="state">Cargando aprobación…</div> : null}
        {error ? <div className="error">{error}</div> : null}

        {approval ? (
          <div className="contentGrid">
            <section className="mainCard">
              <div className="hero">
                <div>
                  <p className="sectionLabel">Solicitud formal de aprobación</p>
                  <h1>{approval.rdc?.title || 'Cambio sin título'}</h1>
                  <p className="lead">
                    Estás aprobando como <b>{approval.approver_role}</b>. Tu decisión quedará registrada como evidencia digital con validación por correo.
                  </p>
                </div>
                <span className={`status ${tone[approval.status] || 'pending'}`}>{approvalLabel(approval.status)}</span>
              </div>

              <div className="executiveBox">
                <h2>Resumen ejecutivo</h2>
                <div className="summaryGrid">
                  <div><span>Sistema</span><b>{approval.rdc?.system || 'Sin sistema'}</b></div>
                  <div><span>Célula</span><b>{approval.rdc?.cell || 'Sin célula'}</b></div>
                  <div><span>Categoría</span><b>{approval.rdc?.category || 'Sin categoría'}</b></div>
                  <div><span>Fecha deploy</span><b>{formatDate(approval.rdc?.proposed_deploy_date)}</b></div>
                  <div><span>Presentador</span><b>{approval.rdc?.presenter || 'Portal Release'}</b></div>
                  <div><span>Líder técnico</span><b>{approval.rdc?.technical_lead || 'No informado'}</b></div>
                  <div><span>Jira origen</span><b>{approval.rdc?.jira_origin || 'No informado'}</b></div>
                  <div><span>RFC</span><b>{approval.rdc?.rfc || 'No aplica'}</b></div>
                </div>
              </div>

              <div className="decisionContext">
                <h2>Qué estás aprobando</h2>
                <p>{approval.rdc?.description || 'No se registró descripción del cambio.'}</p>
              </div>

              <div className="yourRole">
                <div>
                  <span>Tu área</span>
                  <b>{approval.approver_role}</b>
                </div>
                <div>
                  <span>Aprobador asignado</span>
                  <b>{approval.approver_name}</b>
                </div>
                <div>
                  <span>Correo de validación</span>
                  <b>{approval.approver_email || 'Sin correo configurado'}</b>
                </div>
              </div>

              {alreadyProcessed ? (
                <div className={`processed ${tone[approval.status] || 'pending'}`}>
                  <h2>Decisión registrada</h2>
                  <p>Esta aprobación ya fue procesada con estado <b>{approval.status}</b>.</p>
                  {approval.approved_at ? <small>Fecha: {new Date(approval.approved_at).toLocaleString('es-CL')}</small> : null}
                  {approval.approved_by_email ? <small>Correo registrado: {approval.approved_by_email}</small> : null}
                  {approval.approved_ip ? <small>IP: {approval.approved_ip}</small> : null}
                </div>
              ) : (
                <>
                  <div className="otpBox">
                    <div>
                      <h2>Verificación de identidad</h2>
                      <p>Envía un código OTP al correo del aprobador y valídalo antes de registrar la decisión.</p>
                    </div>

                    {!verified ? (
                      <div className="otpActions">
                        <button disabled={busy || !approval.approver_email} onClick={sendCode}>
                          {otpSent ? 'Reenviar código' : 'Enviar código'}
                        </button>

                        {otpMessage ? <div className="notice">{otpMessage}</div> : null}

                        {otpSent ? (
                          <div className="codeRow">
                            <input
                              value={code}
                              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                              placeholder="Código de 6 dígitos"
                              maxLength={6}
                            />
                            <button disabled={busy || code.length < 6} onClick={verifyCode}>Validar código</button>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="verified">Código validado correctamente. Ya puedes registrar tu decisión.</div>
                    )}
                  </div>

                  <div className="decisionBox">
                    <h2>Decisión requerida</h2>
                    <p>Si observas o rechazas, el sistema solicitará un comentario para dejar evidencia.</p>
                    <div className="actions">
                      <button disabled={busy || !verified} onClick={() => submit('APROBADO')}>Aprobar</button>
                      <button disabled={busy || !verified} className="secondary" onClick={() => submit('OBSERVADO')}>Observar</button>
                      <button disabled={busy || !verified} className="danger" onClick={() => submit('RECHAZADO')}>Rechazar</button>
                    </div>
                  </div>
                </>
              )}
            </section>

            <aside className="sideCard">
              <section className="progressPanel">
                <div className="progressHead">
                  <span>Avance CAB Digital</span>
                  <strong>{approved} / {total}</strong>
                </div>
                <div className="percentRow">
                  <b>{progress}%</b>
                  <span>{statusText[approval.rdc?.status || ''] || approval.rdc?.status || 'Estado no informado'}</span>
                </div>
                <div className="progressBar"><i style={{ width: `${progress}%` }} /></div>
              </section>

              <section className="miniStats">
                <div><b>{approved}</b><span>Aprobados</span></div>
                <div><b>{pending}</b><span>Pendientes</span></div>
                <div><b>{observed}</b><span>Observados</span></div>
                <div><b>{rejected}</b><span>Rechazados</span></div>
              </section>

              <section className="timeline">
                <h2>Flujo del cambio</h2>
                <div className="step done"><i /> <span>RDC creado</span></div>
                <div className="step done"><i /> <span>CAB Digital</span></div>
                <div className={pending === 0 && rejected === 0 && observed === 0 ? 'step done' : 'step'}><i /> <span>PAP Jira</span></div>
                <div className="step"><i /> <span>Implementación</span></div>
                <div className="step"><i /> <span>Cierre</span></div>
              </section>

              <section className="approvalList">
                <h2>Aprobadores</h2>
                {(allApprovals.length ? allApprovals : [approval]).map((item) => (
                  <div className="approvalItem" key={item.id}>
                    <div>
                      <b>{item.approver_role}</b>
                      <span>{item.approver_name}</span>
                      {item.approved_at ? <small>{new Date(item.approved_at).toLocaleString('es-CL')}</small> : null}
                    </div>
                    <em className={tone[item.status] || 'pending'}>{approvalLabel(item.status)}</em>
                  </div>
                ))}
              </section>
            </aside>
          </div>
        ) : null}
      </section>

      <style jsx global>{`
        *{box-sizing:border-box}html,body{margin:0}body{background:#edf5f9}
        .page{min-height:100vh;padding:28px 5vw 42px;border-top:6px solid #00c16e;background:radial-gradient(circle at top right,rgba(0,193,110,.13),transparent 32%),#edf5f9;color:#073b5d;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        .shell{max-width:1280px;margin:0 auto}.topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.brand{color:#00c16e;font-size:42px;font-weight:950;letter-spacing:-.08em}.kicker{margin:4px 0 0;color:#5d7890;font-weight:950;letter-spacing:.13em;text-transform:uppercase;font-size:12px}
        .cabState,.status{border-radius:999px;padding:9px 13px;font-size:12px;font-weight:950}.ok{background:#e8fff3;color:#008f57}.pending{background:#ecf7ff;color:#02568c}.watch{background:#fff7e6;color:#9a6700}.bad{background:#fff1f0;color:#b42318}
        .contentGrid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(330px,.8fr);gap:20px}.mainCard,.sideCard,.state,.error{background:white;border:1px solid #dfeaf0;border-radius:28px;box-shadow:0 24px 70px rgba(7,59,93,.10)}.mainCard,.sideCard{padding:28px}.hero{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.sectionLabel{color:#00a967;font-weight:950;letter-spacing:.15em;text-transform:uppercase;font-size:12px;margin:0 0 12px}
        h1{margin:0;font-size:46px;line-height:1;letter-spacing:-.06em}h2{margin:0 0 10px;font-size:20px;letter-spacing:-.03em}.lead{color:#5d7890;font-size:17px;line-height:1.45;margin:16px 0 22px}
        .executiveBox,.decisionContext,.otpBox,.decisionBox,.processed{margin-top:18px;background:#f8fbfd;border:1px solid #e5eef3;border-radius:18px;padding:16px}.summaryGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.summaryGrid div,.yourRole div{background:white;border:1px solid #e5eef3;border-radius:16px;padding:13px}.summaryGrid span,.yourRole span{display:block;color:#5d7890;font-size:12px;font-weight:900;margin-bottom:6px}.summaryGrid b,.yourRole b{display:block;font-size:15px}.decisionContext p,.otpBox p,.decisionBox p{margin:0;color:#315873;line-height:1.45}
        .yourRole{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:18px}.otpActions{display:grid;gap:10px;margin-top:12px}.notice{background:#ecf7ff;color:#02568c;font-weight:900;border-radius:16px;padding:12px}.verified{background:#e8fff3;color:#008f57;font-weight:900;border-radius:16px;padding:12px}.codeRow{display:grid;grid-template-columns:1fr auto;gap:10px}input{border:1px solid #d9e7ef;border-radius:999px;padding:13px 16px;font:inherit;color:#073b5d}
        .actions{display:flex;gap:12px;margin-top:14px}button{border:0;background:#00c16e;color:white;border-radius:999px;padding:13px 18px;font-weight:950;cursor:pointer;min-width:140px}button:disabled{opacity:.45;cursor:not-allowed}.secondary{background:#fff7e6;color:#9a6700}.danger{background:#fff1f0;color:#b42318}.processed small{display:block;margin-top:8px;color:#315873}.state,.error{padding:20px;margin-bottom:16px}.error{color:#b42318;background:#fff1f0;border-color:#ffd6d2}
        .progressPanel{margin-bottom:16px}.progressHead,.percentRow{display:flex;justify-content:space-between;align-items:center;gap:12px}.progressHead span,.percentRow span{color:#5d7890;font-weight:900}.progressHead strong{font-size:24px}.percentRow b{font-size:42px;color:#00a967;letter-spacing:-.05em}.progressBar{height:13px;border-radius:999px;background:#e9f2f7;overflow:hidden;margin:14px 0}.progressBar i{display:block;height:100%;background:#00c16e;border-radius:inherit}
        .miniStats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:20px}.miniStats div{background:#f8fbfd;border:1px solid #e5eef3;border-radius:16px;padding:12px}.miniStats b{display:block;font-size:24px}.miniStats span{color:#5d7890;font-size:12px;font-weight:900}
        .timeline{display:grid;gap:12px;margin:18px 0 22px}.step{display:flex;gap:10px;align-items:center;color:#8aa0b2;font-weight:900}.step i{width:14px;height:14px;border-radius:50%;border:3px solid #c9d9e3;background:white}.step.done{color:#073b5d}.step.done i{border-color:#00c16e;background:#00c16e}
        .approvalList{display:grid;gap:10px}.approvalItem{display:flex;justify-content:space-between;gap:12px;align-items:center;background:#f8fbfd;border:1px solid #e5eef3;border-radius:16px;padding:12px}.approvalItem b{display:block}.approvalItem span,.approvalItem small{display:block;color:#5d7890;font-size:12px}.approvalItem em{font-style:normal;border-radius:999px;padding:7px 10px;font-weight:950;font-size:11px;white-space:nowrap}
        @media(max-width:1000px){.contentGrid{grid-template-columns:1fr}.summaryGrid{grid-template-columns:repeat(2,1fr)}}@media(max-width:700px){.page{padding:22px 16px}.topbar,.hero{align-items:flex-start;gap:12px}.contentGrid,.summaryGrid,.yourRole,.codeRow{grid-template-columns:1fr}.actions{flex-direction:column}button{width:100%}h1{font-size:34px}}
      `}</style>
    </main>
  );
}

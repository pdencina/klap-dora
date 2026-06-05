'use client';

import { useEffect, useMemo, useState } from 'react';

type Approval = {
  id: string;
  approver_role: string;
  approver_name: string;
  approver_email?: string | null;
  approval_token?: string | null;
  status: string;
  approved_at?: string | null;
  comment?: string | null;
  rdc?: {
    id: string;
    title: string;
    system?: string | null;
    cell?: string | null;
    category?: string | null;
    status?: string | null;
    proposed_deploy_date?: string | null;
  } | null;
};

const tone: Record<string, string> = {
  APROBADO: 'ok',
  PENDIENTE: 'pending',
  OBSERVADO: 'watch',
  RECHAZADO: 'bad',
};

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  try {
    return new Date(value).toLocaleDateString('es-CL');
  } catch {
    return String(value);
  }
}

export default function MisAprobacionesPage() {
  const [items, setItems] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const response = await fetch('/api/approvals/mine', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || 'No se pudieron cargar tus aprobaciones');
        setItems(data.approvals || []);
      } catch (err: any) {
        setError(err?.message || 'Error cargando aprobaciones');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const pending = useMemo(() => items.filter((i) => i.status === 'PENDIENTE'), [items]);
  const history = useMemo(() => items.filter((i) => i.status !== 'PENDIENTE'), [items]);

  return (
    <main className="approverInbox">
      <header className="head">
        <p className="kicker">BANDEJA DEL APROBADOR</p>
        <h1>Mis Aprobaciones</h1>
        <p>Revisa tus solicitudes CAB asignadas. Para aprobar, observar o rechazar, entra al link y valida tu identidad con OTP.</p>
      </header>

      <section className="stats">
        <div><span>Pendientes</span><b>{pending.length}</b></div>
        <div><span>Historial</span><b>{history.length}</b></div>
        <div><span>Total asignadas</span><b>{items.length}</b></div>
      </section>

      {loading ? <div className="state">Cargando aprobaciones…</div> : null}
      {error ? <div className="state error">{error}</div> : null}

      {!loading && !error ? (
        <>
          <section className="section">
            <h2>Pendientes de decisión</h2>
            {pending.length === 0 ? <div className="empty">No tienes aprobaciones pendientes.</div> : null}
            <div className="list">
              {pending.map((approval) => (
                <article className="card" key={approval.id}>
                  <div>
                    <span className={`badge ${tone[approval.status] || 'pending'}`}>{approval.status}</span>
                    <h3>{approval.rdc?.title || 'RDC sin título'}</h3>
                    <p>{approval.rdc?.system || 'Sin sistema'} · {approval.rdc?.cell || 'Sin célula'} · {approval.rdc?.category || 'Sin categoría'}</p>
                    <small>Fecha deploy: {formatDate(approval.rdc?.proposed_deploy_date)}</small>
                  </div>
                  <a href={`/approve/${approval.approval_token || approval.id}`}>Revisar aprobación →</a>
                </article>
              ))}
            </div>
          </section>

          <section className="section">
            <h2>Historial</h2>
            {history.length === 0 ? <div className="empty">Aún no tienes decisiones registradas.</div> : null}
            <div className="list">
              {history.map((approval) => (
                <article className="card compact" key={approval.id}>
                  <div>
                    <span className={`badge ${tone[approval.status] || 'pending'}`}>{approval.status}</span>
                    <h3>{approval.rdc?.title || 'RDC sin título'}</h3>
                    <small>{approval.comment || 'Sin comentario'}</small>
                  </div>
                  <a href={`/approve/${approval.approval_token || approval.id}`}>Ver evidencia →</a>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}

      <style jsx>{`
        .approverInbox { max-width: 1100px; margin: 0 auto; padding: 36px 6vw 64px; }
        .kicker { color: var(--green-d); font-size: 13px; font-weight: 800; letter-spacing: .16em; margin: 0 0 10px; }
        h1 { font-size: clamp(34px, 5vw, 56px); line-height: 1; letter-spacing: -.05em; margin: 0; color: var(--navy-d); }
        .head p:last-child { color: var(--ink-soft); max-width: 760px; line-height: 1.5; margin-top: 12px; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 26px 0; }
        .stats div, .state, .section { background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 20px; }
        .stats span { color: var(--ink-soft); font-weight: 700; font-size: 13px; }
        .stats b { display: block; font-size: 34px; color: var(--green-d); margin-top: 6px; }
        .section { margin-top: 16px; }
        .section h2 { margin: 0 0 14px; color: var(--navy-d); font-size: 22px; letter-spacing: -.03em; }
        .list { display: grid; gap: 12px; }
        .card { display: flex; justify-content: space-between; gap: 18px; align-items: center; background: var(--bg); border: 1px solid #dfeaf0; border-radius: 16px; padding: 16px; }
        .card h3 { margin: 8px 0 4px; color: var(--navy-d); font-size: 18px; }
        .card p { margin: 0 0 6px; color: var(--ink-soft); }
        .card small { color: var(--ink-soft); font-weight: 700; }
        .card a { flex: none; background: var(--green); color: white; padding: 11px 14px; border-radius: 999px; font-weight: 800; }
        .card.compact a { background: #fff; color: var(--navy); border: 1px solid var(--line); }
        .badge { display: inline-flex; border-radius: 999px; padding: 6px 10px; font-size: 11px; font-weight: 900; }
        .ok { background:#e8fff3;color:#008f57 }.pending { background:#ecf7ff;color:#02568c }.watch { background:#fff7e6;color:#9a6700 }.bad { background:#fff1f0;color:#b42318 }
        .empty { color: var(--ink-soft); padding: 16px; background: var(--bg); border-radius: 14px; }
        .error { color: #b42318; background: #fff1f0; }
        @media(max-width:760px){ .stats { grid-template-columns: 1fr; } .card { flex-direction: column; align-items: flex-start; } }
      `}</style>
    </main>
  );
}

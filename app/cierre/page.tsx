'use client';

import { useEffect, useState } from 'react';

type Change = {
  id: string;
  title: string;
  system?: string | null;
  cell?: string | null;
  category?: string | null;
  status: string;
  jira_key?: string | null;
  deployment_result?: string | null;
  proposed_deploy_date?: string | null;
};

const RESULTS = ['Exitoso', 'Completado con errores', 'Rollback', 'Fallido', 'Cancelado', 'Rechazado'];
const JIRA_BROWSE = 'https://multicaja-cloud.atlassian.net/browse/';

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function CierrePage() {
  const [items, setItems] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    try {
      setLoading(true);
      const r = await fetch('/api/approvals/list', { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || 'No se pudo cargar');
      const all: Change[] = Array.isArray(d.changes) ? d.changes : [];
      // PAP ya creados y aún sin resultado de deploy = pendientes de cierre.
      setItems(all.filter((c) => c.jira_key && (!c.deployment_result || c.deployment_result === 'PENDIENTE')));
    } catch (e: any) {
      setError(e?.message || 'Error cargando cambios por cerrar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="cierre">
      <header className="head">
        <p className="kicker">ÁREA RELEASE MANAGEMENT</p>
        <h1>Cierre de cambio</h1>
        <p className="sub">Registra la fecha de deploy real y el resultado de cada PAP. Esto alimenta el Dashboard DORA.</p>
      </header>

      {loading ? (
        <div className="state">Cargando cambios por cerrar…</div>
      ) : error ? (
        <div className="state err">{error}</div>
      ) : items.length === 0 ? (
        <div className="state">No hay PAP pendientes de cierre. 🎉</div>
      ) : (
        <div className="list">
          {items.map((c) => (
            <CloseRow key={c.id} change={c} onClosed={() => setItems((prev) => prev.filter((x) => x.id !== c.id))} />
          ))}
        </div>
      )}

      <style jsx global>{`
        .cierre { max-width: 980px; margin: 0 auto; padding: 32px 6vw 64px; }
        .cierre .kicker { color: var(--green-d); font-size: 13px; font-weight: 800; letter-spacing: .16em; margin: 0 0 8px; }
        .cierre h1 { font-size: clamp(30px, 4vw, 44px); line-height: 1.05; letter-spacing: -.03em; color: var(--navy-d); margin: 0; }
        .cierre .sub { color: var(--ink-soft); margin: 10px 0 0; font-size: 16px; }
        .cierre .state { background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 40px; text-align: center; color: var(--ink-soft); margin-top: 22px; }
        .cierre .state.err { color: #c0392b; }
        .cierre .list { display: grid; gap: 12px; margin-top: 22px; }
        .cierre .row { background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 18px 20px; display: grid; grid-template-columns: 1fr 1.3fr; gap: 20px; align-items: start; }
        .cierre .info .key { font-size: 13px; font-weight: 800; color: var(--navy); }
        .cierre .info h3 { margin: 6px 0 8px; font-size: 17px; color: var(--navy-d); letter-spacing: -.01em; }
        .cierre .info .meta { display: flex; gap: 6px; flex-wrap: wrap; }
        .cierre .info .meta span { font-size: 11px; font-weight: 700; color: var(--ink-soft); background: var(--bg); border-radius: 999px; padding: 3px 9px; }
        .cierre .form { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .cierre .form label { display: grid; gap: 5px; font-size: 12px; font-weight: 700; color: #315873; }
        .cierre .form label.wide { grid-column: 1 / -1; }
        .cierre .form input, .cierre .form select { width: 100%; border: 1px solid #d9e7ef; border-radius: 10px; padding: 10px 11px; font: inherit; color: var(--ink); outline: none; min-height: 42px; }
        .cierre .form input:focus, .cierre .form select:focus { border-color: var(--green); box-shadow: 0 0 0 3px rgba(0,193,110,.12); }
        .cierre .form .err { grid-column: 1 / -1; background: #fff1f0; border: 1px solid #ffd0cb; color: #c0392b; padding: 9px 11px; border-radius: 10px; font-weight: 700; font-size: 12px; }
        .cierre .form button { grid-column: 1 / -1; border: 0; background: var(--green); color: #fff; border-radius: 999px; padding: 12px 18px; font-weight: 800; cursor: pointer; }
        .cierre .form button:disabled { opacity: .55; cursor: not-allowed; }
        @media (max-width: 760px) {
          .cierre .row { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}

function CloseRow({ change, onClosed }: { change: Change; onClosed: () => void }) {
  const [date, setDate] = useState(today());
  const [result, setResult] = useState('Exitoso');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function close() {
    setErr('');
    if (!date) {
      setErr('Indica la fecha de deploy.');
      return;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/jira/close-pap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rdcId: change.id, deployDate: date, result, note }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        const detail = d.details ? `\n${JSON.stringify(d.details)}` : '';
        throw new Error((d.error || 'No se pudo cerrar el cambio') + detail);
      }
      onClosed();
    } catch (e: any) {
      setErr(e?.message || 'Error al cerrar');
      setSaving(false);
    }
  }

  return (
    <article className="row">
      <div className="info">
        <a className="key" href={`${JIRA_BROWSE}${change.jira_key}`} target="_blank" rel="noreferrer">{change.jira_key} ↗</a>
        <h3>{change.title}</h3>
        <div className="meta">
          {change.system ? <span>{change.system}</span> : null}
          {change.cell ? <span>{change.cell}</span> : null}
          {change.category ? <span>{change.category}</span> : null}
        </div>
      </div>
      <div className="form">
        <label>
          Fecha deploy real
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Resultado
          <select value={result} onChange={(e) => setResult(e.target.value)}>
            {RESULTS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label className="wide">
          Nota de cierre (opcional)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Incidencias, observaciones del deploy…" />
        </label>
        {err ? <div className="err">{err}</div> : null}
        <button onClick={close} disabled={saving}>{saving ? 'Cerrando…' : 'Cerrar cambio'}</button>
      </div>
    </article>
  );
}

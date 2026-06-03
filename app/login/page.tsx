'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '../../lib/supabase-browser';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setError('Credenciales inválidas. Revisa tu correo y contraseña.');
        setLoading(false);
        return;
      }
      const next = new URLSearchParams(window.location.search).get('next') || '/';
      router.push(next.startsWith('/') ? next : '/');
      router.refresh();
    } catch {
      setError('No se pudo iniciar sesión. Intenta de nuevo.');
      setLoading(false);
    }
  }

  return (
    <main className="login">
      <form className="card" onSubmit={submit}>
        <div className="brand"><span className="k">k</span>lap <em>Release</em></div>
        <h1>Inicia sesión</h1>
        <p className="sub">Portal de gestión de cambios de KLAP.</p>

        <label>
          Correo
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu-correo@klap.cl" autoComplete="email" required />
        </label>
        <label>
          Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
        </label>

        {error ? <div className="err">{error}</div> : null}

        <button type="submit" disabled={loading}>{loading ? 'Ingresando…' : 'Ingresar'}</button>
      </form>

      <style jsx global>{`
        body { background: var(--bg); }
        .login { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .login .card { width: 100%; max-width: 400px; background: #fff; border: 1px solid var(--line); border-radius: 20px; padding: 34px; box-shadow: 0 24px 60px -28px rgba(7,59,93,.3); display: grid; gap: 14px; }
        .login .brand { font-weight: 800; font-size: 24px; letter-spacing: -.04em; color: var(--navy); }
        .login .brand .k { color: var(--green); }
        .login .brand em { font-style: normal; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-soft); margin-left: 6px; }
        .login h1 { margin: 6px 0 0; font-size: 28px; letter-spacing: -.02em; color: var(--navy-d); }
        .login .sub { margin: 0 0 8px; color: var(--ink-soft); }
        .login label { display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #315873; }
        .login input { border: 1px solid #d9e7ef; border-radius: 12px; padding: 12px 13px; font: inherit; color: var(--ink); outline: none; min-height: 48px; }
        .login input:focus { border-color: var(--green); box-shadow: 0 0 0 3px rgba(0,193,110,.12); }
        .login .err { background: #fff1f0; border: 1px solid #ffd0cb; color: #c0392b; padding: 11px 13px; border-radius: 12px; font-weight: 700; font-size: 13px; }
        .login button { margin-top: 4px; border: 0; background: var(--green); color: #fff; border-radius: 999px; padding: 13px 18px; font-weight: 800; cursor: pointer; }
        .login button:disabled { opacity: .55; cursor: not-allowed; }
      `}</style>
    </main>
  );
}

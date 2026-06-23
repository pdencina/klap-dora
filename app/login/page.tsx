'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowser } from '@/lib/supabase-browser';

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
      <div className="login-bg" aria-hidden="true" />
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
        <p className="footer-text">Release Management Portal v2.0</p>
      </form>

      <style jsx global>{`
        body { background: var(--bg); }
        .login { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; position: relative; overflow: hidden; }
        .login-bg { position: absolute; inset: 0; background: linear-gradient(135deg, #013356 0%, #02568c 40%, #007a5e 100%); opacity: 0.03; pointer-events: none; }
        .login-bg::before { content: ''; position: absolute; top: -50%; right: -30%; width: 80vw; height: 80vw; border-radius: 50%; background: radial-gradient(circle, rgba(0,193,110,0.08) 0%, transparent 70%); }
        .login .card { position: relative; width: 100%; max-width: 420px; background: #fff; border: 1px solid var(--line); border-radius: 24px; padding: 40px 36px; box-shadow: 0 24px 80px -20px rgba(7,59,93,.15), 0 8px 20px rgba(7,59,93,.06); display: grid; gap: 16px; }
        .login .brand { font-weight: 800; font-size: 26px; letter-spacing: -.04em; color: var(--navy); }
        .login .brand .k { color: var(--green); }
        .login .brand em { font-style: normal; font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-soft); margin-left: 8px; background: var(--bg); padding: 4px 8px; border-radius: 6px; }
        .login h1 { margin: 8px 0 0; font-size: 30px; letter-spacing: -.03em; color: var(--navy-d); }
        .login .sub { margin: 0 0 8px; color: var(--ink-soft); font-size: 15px; line-height: 1.4; }
        .login label { display: grid; gap: 7px; font-size: 13px; font-weight: 700; color: #315873; }
        .login input { border: 1.5px solid #d9e7ef; border-radius: 12px; padding: 13px 14px; font: inherit; font-size: 15px; color: var(--ink); outline: none; min-height: 50px; transition: border-color 0.2s, box-shadow 0.2s; }
        .login input:focus { border-color: var(--green); box-shadow: 0 0 0 4px rgba(0,193,110,.1); }
        .login .err { background: #fff1f0; border: 1px solid #ffd0cb; color: #c0392b; padding: 12px 14px; border-radius: 12px; font-weight: 700; font-size: 13px; }
        .login button { margin-top: 6px; border: 0; background: linear-gradient(135deg, var(--green) 0%, var(--green-d) 100%); color: #fff; border-radius: 999px; padding: 14px 20px; font-weight: 800; font-size: 15px; cursor: pointer; box-shadow: 0 4px 16px rgba(0,193,110,.35); transition: transform 0.15s, box-shadow 0.15s; }
        .login button:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(0,193,110,.45); }
        .login button:disabled { opacity: .55; cursor: not-allowed; transform: none; box-shadow: none; }
        .login .footer-text { text-align: center; color: var(--ink-soft); font-size: 12px; margin: 4px 0 0; opacity: 0.7; }
      `}</style>
    </main>
  );
}

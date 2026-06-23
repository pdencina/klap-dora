'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ width: 64, height: 64, margin: '0 auto 20px', borderRadius: '50%', background: '#fff5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
          ⚠️
        </div>
        <h1 style={{ fontSize: 28, marginBottom: 12, color: '#013356', letterSpacing: '-0.03em' }}>Algo salió mal</h1>
        <p style={{ color: '#5d7890', marginBottom: 24, lineHeight: 1.6, fontSize: 15 }}>
          Ocurrió un error inesperado. Puedes intentar de nuevo o volver al inicio.
        </p>
        {error.digest ? (
          <p style={{ fontSize: 12, color: '#91a4b6', marginBottom: 16, background: '#f4f8fb', padding: '8px 12px', borderRadius: 8, display: 'inline-block' }}>
            Ref: {error.digest}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8 }}>
          <button
            onClick={reset}
            style={{
              background: 'linear-gradient(135deg, #00c16e, #00a85f)',
              color: '#fff',
              border: 0,
              borderRadius: 999,
              padding: '13px 22px',
              fontWeight: 800,
              fontSize: 14,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,193,110,.3)',
            }}
          >
            Reintentar
          </button>
          <a
            href="/"
            style={{
              background: '#fff',
              color: '#02568c',
              border: '1px solid #e2ecf1',
              borderRadius: 999,
              padding: '13px 22px',
              fontWeight: 800,
              fontSize: 14,
              textDecoration: 'none',
            }}
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </main>
  );
}

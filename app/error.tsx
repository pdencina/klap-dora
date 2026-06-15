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
        <h1 style={{ fontSize: 32, marginBottom: 12, color: '#073b5d' }}>Algo salió mal</h1>
        <p style={{ color: '#5d7890', marginBottom: 24, lineHeight: 1.5 }}>
          Ocurrió un error inesperado. Puedes intentar de nuevo o volver al inicio.
        </p>
        {error.digest ? (
          <p style={{ fontSize: 12, color: '#91a4b6', marginBottom: 16 }}>
            Referencia: {error.digest}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{
              background: '#00c16e',
              color: '#fff',
              border: 0,
              borderRadius: 999,
              padding: '12px 20px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
          <a
            href="/"
            style={{
              background: '#fff',
              color: '#02568c',
              border: '1px solid #dfeaf0',
              borderRadius: 999,
              padding: '12px 20px',
              fontWeight: 700,
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

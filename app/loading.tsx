export default function Loading() {
  return (
    <div
      style={{
        minHeight: '50vh',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        color: '#5d7890',
        fontSize: 14,
        fontWeight: 700,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          border: '3px solid #e2ecf1',
          borderTopColor: '#00c16e',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <span>Cargando…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

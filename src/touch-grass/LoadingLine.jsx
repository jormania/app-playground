export default function LoadingLine() {
  return (
    <>
      <style>{`
        @keyframes tg-sweep {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(500%); }
        }
      `}</style>
      <div style={{
        position: 'relative', overflow: 'hidden',
        width: '100%', height: '1px',
        background: 'rgba(0,0,0,0.08)',
        margin: '6px 0',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: '20%', height: '100%',
          background: 'rgba(0,0,0,0.3)',
          animation: 'tg-sweep 1.4s ease-in-out infinite',
        }} />
      </div>
    </>
  )
}

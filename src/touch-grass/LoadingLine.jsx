export default function LoadingLine() {
  return (
    <>
      <style>{`
        @keyframes tg-sweep {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(520%); }
        }
      `}</style>
      <div style={{
        position: 'relative', overflow: 'hidden',
        width: '100%', height: '3px', borderRadius: '3px',
        background: 'rgba(243,234,212,0.18)',
        margin: '8px 0',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: '22%', height: '100%', borderRadius: '3px',
          background: 'linear-gradient(90deg, transparent, #f3ead4, transparent)',
          boxShadow: '0 0 6px rgba(243,234,212,0.5)',
          animation: 'tg-sweep 1.3s ease-in-out infinite',
        }} />
      </div>
    </>
  )
}

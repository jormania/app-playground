export default function SkeletonState({ activeTab }) {
  if (activeTab === 'transactions') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', marginTop: 'var(--space-xl)' }}>
        <div className="shimmer-bg" style={{ height: '40px', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)' }} />
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="shimmer-bg" style={{ height: '60px', borderRadius: 'var(--radius-sm)' }} />
        ))}
      </div>
    );
  }

  if (activeTab === 'insights') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-xl)', marginTop: 'var(--space-xl)' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="shimmer-bg" style={{ height: '250px', borderRadius: 'var(--radius-lg)' }} />
        ))}
      </div>
    );
  }

  if (activeTab === 'settings') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginTop: 'var(--space-xl)' }}>
        <div className="shimmer-bg" style={{ height: '150px', borderRadius: 'var(--radius-lg)' }} />
        <div className="shimmer-bg" style={{ height: '250px', borderRadius: 'var(--radius-lg)' }} />
        <div className="shimmer-bg" style={{ height: '200px', borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  // Dashboard (default)
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }} className="skeleton-kpi-grid">
        {[1, 2, 3].map(i => (
          <div key={i} className="shimmer-bg" style={{ height: '90px', borderRadius: 'var(--radius-lg)' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-xl)' }}>
        <div className="shimmer-bg" style={{ height: '400px', borderRadius: 'var(--radius-lg)' }} />
        <div className="shimmer-bg" style={{ height: '400px', borderRadius: 'var(--radius-lg)' }} />
      </div>
    </div>
  );
}

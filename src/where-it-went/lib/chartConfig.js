import { formatCurrency, formatCurrencyCompact } from './currency';

export const getChartColors = () => {
  const inkColor = getComputedStyle(document.documentElement).getPropertyValue('--color-ink').trim() || '#1b1f24';
  const surfaceColor = getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim() || '#ffffff';
  const mutedColor = getComputedStyle(document.documentElement).getPropertyValue('--color-muted').trim() || '#5a636e';
  const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim() || '#e1e4e8';
  return { inkColor, surfaceColor, mutedColor, borderColor };
};

export const getDoughnutOptions = (totalAmount) => {
  const { inkColor } = getChartColors();
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    layout: { padding: 10 },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { 
          color: inkColor, 
          font: { size: 13, weight: '500' }, 
          padding: 20, 
          usePointStyle: true 
        }
      },
      title: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: { size: 14, weight: 'bold' },
        bodyFont: { size: 13 },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (context) => {
            const value = context.parsed;
            const percentage = totalAmount > 0 ? ((value / totalAmount) * 100).toFixed(1) : '0.0';
            return ` ${context.label}: ${formatCurrency(value)} (${percentage}%)`;
          }
        }
      }
    }
  };
};

export const getBarOptions = () => {
  const { inkColor, borderColor } = getChartColors();
  return {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 10 } },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: inkColor, 
          autoSkip: true, 
          maxTicksLimit: 8,
          maxRotation: 0, 
          minRotation: 0,
          font: { size: window.innerWidth < 600 ? 11 : 13, weight: '500' }
        }
      },
      y: {
        border: { display: false },
        grid: { color: borderColor, drawTicks: false },
        ticks: { 
          color: inkColor,
          padding: 8,
          font: { size: 12, weight: '500' },
          callback: (value) => formatCurrencyCompact(value) 
        }
      }
    },
    plugins: {
      legend: { 
        position: 'bottom', 
        labels: { 
          color: inkColor, 
          font: { size: 13, weight: '500' }, 
          padding: 20, 
          usePointStyle: true,
          filter: (item) => !item.text.includes('Trend')
        } 
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: { size: 14, weight: 'bold' },
        bodyFont: { size: 13 },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: (context) => ` ${context.dataset.label}: ${formatCurrency(context.parsed.y)}`
        }
      }
    }
  };
};

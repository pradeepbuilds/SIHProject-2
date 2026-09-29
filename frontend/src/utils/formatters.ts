export function formatVariableLabel(variable: string): string {
  const norm = variable.toLowerCase();
  if (norm.includes('rain')) return 'Rainfall';
  if (norm.includes('max')) return 'Max Temperature';
  if (norm.includes('min')) return 'Min Temperature';
  return variable;
}

export function formatUnit(variable: string): string {
  const norm = variable.toLowerCase();
  if (norm.includes('rain')) return 'mm';
  if (norm.includes('temp') || norm.includes('max') || norm.includes('min')) return '°C';
  if (norm.includes('humid')) return '%';
  return '';
}

export function getUncertaintyColor(label: string): { bg: string; text: string; border: string } {
  switch (label.toLowerCase()) {
    case 'low':
      return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: '#10b981' };
    case 'high':
      return { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: '#ef4444' };
    case 'medium':
    default:
      return { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: '#f59e0b' };
  }
}

export const Colors = {
  primary: '#6D28D9',
  primaryLight: '#EDE9FE',
  primaryDark: '#4C1D95',
  secondary: '#7C3AED',
  accent: '#4F46E5',

  vert: '#059669',
  vertLight: '#D1FAE5',
  orange: '#D97706',
  orangeLight: '#FEF3C7',
  rouge: '#DC2626',
  rougeLight: '#FEE2E2',

  renal: '#2563EB',
  renalLight: '#DBEAFE',
  glycemic: '#D97706',
  glycemicLight: '#FEF3C7',
  dietetic: '#059669',
  dieteticLight: '#D1FAE5',

  background: '#F5F0FF',
  card: '#FFFFFF',
  cardSoft: '#FAF8FF',
  border: '#E4DCFF',
  inputBg: '#FAF8FF',

  text: '#1E1B4B',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textInverse: '#FFFFFF',

  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#2563EB',
} as const;

export const alertColor = (level: 'vert' | 'orange' | 'rouge') => ({
  vert: { bg: Colors.vertLight, text: Colors.vert, border: Colors.vert },
  orange: { bg: Colors.orangeLight, text: Colors.orange, border: Colors.orange },
  rouge: { bg: Colors.rougeLight, text: Colors.rouge, border: Colors.rouge },
}[level]);

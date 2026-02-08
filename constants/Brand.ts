// Primary brand colors
export const brand = {
  primary: '#168a7e',
  primaryDark: '#0d665d',
  primaryLight: '#e6f7f5',
  textOnBrand: '#FFFFFF',
  // Legacy aliases for backward compatibility
  start: '#168a7e',
  end: '#0d665d',
};

// Warm accent colors (gold)
export const accent = {
  primary: '#F59E0B',
  light: '#FEF3C7',
  dark: '#D97706',
};

// Error and semantic colors
export const semantic = {
  error: '#DC2626', // Sharper red (Red 600)
  errorLight: '#FEE2E2',
  success: '#059669',
  warning: '#D97706',
};

// Light mode neutral colors
export const neutrals = {
  white: '#FFFFFF',
  background: '#F9FAFB',
  backgroundAlt: '#F3F4F6',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  textPrimary: '#111827',
  textSecondary: '#374151', // Darker for sharpness
  textMuted: '#4B5563',      // Darker for sharpness
  textDisabled: '#9CA3AF',
  overlay: 'rgba(0, 0, 0, 0.35)',
  shadow: '#000000',
};

// Night sky theme (Moonlit dark mode)
export const nightSky = {
  background: '#0F172A',
  backgroundAlt: '#1E293B',
  surface: '#1E293B',        // Adjusted surface
  border: '#334155',
  borderLight: '#3B4A5E',
  textPrimary: '#F8FAFC',    // Brighter white
  textSecondary: '#E2E8F0',  // Sharper grey
  textMuted: '#CBD5E1',      // Sharper grey
  textDisabled: '#94A3B8',
  overlay: 'rgba(0, 0, 0, 0.6)',
  shadow: '#000000',
  starlight: '#E2E8F0',
  glow: 'rgba(22, 138, 126, 0.3)',
};

// Star rating colors
export const ratings = {
  star: '#FBBF24',
  starEmpty: '#D1D5DB',
  starEmptyDark: '#475569',
};

// Gradient definitions
export const gradients = {
  brand: ['#168a7e', '#0d665d'] as const,
  nightSky: ['#0F172A', '#1E293B'] as const,
  nightSkyHeader: ['#1E293B', '#334155'] as const,
  warmSunrise: ['#168a7e', '#F59E0B'] as const,
};

// Legacy export for backward compatibility
export const brandGradient = gradients.brand;

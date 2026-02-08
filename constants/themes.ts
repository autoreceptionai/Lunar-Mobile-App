import { brand, neutrals, nightSky, accent, ratings, gradients, semantic } from './Brand';

export type ThemeColors = {
  // Backgrounds
  background: string;
  backgroundAlt: string;
  surface: string;
  
  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;
  
  // Borders
  border: string;
  borderLight: string;
  
  // Brand
  primary: string;
  primaryDark: string;
  primaryLight: string;
  
  // Accent
  accent: string;
  accentLight: string;
  
  // Semantic
  error: string;
  errorLight: string;
  
  // Ratings
  star: string;
  starEmpty: string;
  
  // Utilities
  overlay: string;
  shadow: string;
  white: string;
  
  // Special (dark mode only)
  glow?: string;
  starlight?: string;
};

export type Theme = {
  dark: boolean;
  colors: ThemeColors;
  gradients: {
    header: readonly string[];
    brand: readonly string[];
  };
};

export const lightTheme: Theme = {
  dark: false,
  colors: {
    // Backgrounds
    background: neutrals.background,
    backgroundAlt: neutrals.backgroundAlt,
    surface: neutrals.white,
    
    // Text
    textPrimary: neutrals.textPrimary,
    textSecondary: neutrals.textSecondary,
    textMuted: neutrals.textMuted,
    textDisabled: neutrals.textDisabled,
    
    // Borders
    border: neutrals.border,
    borderLight: neutrals.borderLight,
    
    // Brand
    primary: brand.primary,
    primaryDark: brand.primaryDark,
    primaryLight: brand.primaryLight,
    
    // Accent
    accent: accent.primary,
    accentLight: accent.light,
    
    // Semantic
    error: semantic.error,
    errorLight: semantic.errorLight,
    
    // Ratings
    star: ratings.star,
    starEmpty: ratings.starEmpty,
    
    // Utilities
    overlay: neutrals.overlay,
    shadow: neutrals.shadow,
    white: neutrals.white,
  },
  gradients: {
    header: gradients.brand,
    brand: gradients.brand,
  },
};

export const darkTheme: Theme = {
  dark: true,
  colors: {
    // Backgrounds
    background: nightSky.background,
    backgroundAlt: nightSky.backgroundAlt,
    surface: nightSky.surface,
    
    // Text
    textPrimary: nightSky.textPrimary,
    textSecondary: nightSky.textSecondary,
    textMuted: nightSky.textMuted,
    textDisabled: nightSky.textDisabled,
    
    // Borders
    border: nightSky.border,
    borderLight: nightSky.borderLight,
    
    // Brand (teal pops on dark)
    primary: brand.primary,
    primaryDark: brand.primaryDark,
    primaryLight: nightSky.surface,
    
    // Accent
    accent: accent.primary,
    accentLight: accent.dark,
    
    // Semantic
    error: semantic.error,
    errorLight: nightSky.backgroundAlt, // Darker background for error light in dark mode
    
    // Ratings
    star: ratings.star,
    starEmpty: ratings.starEmptyDark,
    
    // Utilities
    overlay: nightSky.overlay,
    shadow: nightSky.shadow,
    white: neutrals.white,
    
    // Special dark mode colors
    glow: nightSky.glow,
    starlight: nightSky.starlight,
  },
  gradients: {
    header: gradients.nightSkyHeader,
    brand: gradients.brand,
  },
};

import type { CSSProperties } from 'react';
import type { PresentationTheme } from '@/types/presentation';

const fontFamilies = {
  sans: 'system-ui, sans-serif',
  serif: 'Georgia, serif',
  monospace: 'ui-monospace, monospace',
};

export function presentationThemeStyle(theme?: PresentationTheme | null): CSSProperties & Record<string, string> {
  return {
    '--presentation-primary': theme?.primaryColor ?? '#C5A059',
    '--presentation-background': theme?.backgroundColor ?? '#0D0D0E',
    '--presentation-control-background': theme?.backgroundColor ?? '#161617',
    '--presentation-text': theme?.textColor ?? '#F4F4F5',
    '--presentation-accent': theme?.accentColor ?? '#C5A059',
    '--presentation-font': fontFamilies[theme?.fontFamily ?? 'sans'],
  };
}

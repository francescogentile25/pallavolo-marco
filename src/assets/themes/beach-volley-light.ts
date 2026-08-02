import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

export const BeachVolleyLight = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#fdf5f1',
      100: '#fbeae5',
      200: '#f6cec0',
      300: '#f0ab92',
      400: '#e5805e',
      500: '#d4562a',
      600: '#b3402a',
      700: '#943425',
      800: '#792e25',
      900: '#642a23',
      950: '#36120f',
    },
    colorScheme: {
      light: {
        formField: {
          background: '{surface.50}',
          borderColor: '{surface.200}',
          hoverBorderColor: '{primary.600}',
          focusBorderColor: '{primary.600}',
          borderRadius: '14px',
          paddingX: '0.8125rem',
          paddingY: '0.875rem',
        },
        surface: {
          0: '#ffffff',
          50: '#faf8f3',
          100: '#f4f0e6',
          200: '#e4ddcd',
          300: '#cec4b0',
          400: '#a49a86',
          500: '#7a7062',
          600: '#625a50',
          700: '#4d4841',
          800: '#35383a',
          900: '#1f2427',
          950: '#14181a',
        },
        focusRing: {
          width: '3px',
          style: 'solid',
          color: '{primary.400}',
          offset: '2px',
        },
      },
    },
  },
});

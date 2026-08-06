import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

export const BeachVolleyLight = definePreset(Aura, {
  primitive: {
    // superfici morbide: i pulsanti tornano arrotondati
    borderRadius: { none: '0', xs: '8px', sm: '10px', md: '14px', lg: '20px', xl: '26px' },
  },
  semantic: {
    primary: {
      50: '#f1f5fb',
      100: '#e4ebf7',
      200: '#c6d5ec',
      300: '#9db7dc',
      400: '#5c85c2',
      500: '#2b60b3',
      600: '#1e4fa3',
      700: '#173d80',
      800: '#143163',
      900: '#132a4e',
      950: '#132430',
    },
    colorScheme: {
      light: {
        formField: {
          background: '{surface.50}',
          borderColor: '{surface.200}',
          hoverBorderColor: '{primary.600}',
          focusBorderColor: '{primary.600}',
          borderRadius: '12px',
          paddingX: '0.8125rem',
          paddingY: '0.875rem',
        },
        surface: {
          0: '#ffffff',
          50: '#faf7f0',
          100: '#f5f0e6',
          200: '#e9e1d2',
          300: '#d5c9b4',
          400: '#b9a98c',
          500: '#8d7f66',
          600: '#6d6353',
          700: '#4f4941',
          800: '#33302c',
          900: '#1d1f21',
          950: '#0f1b23',
        },
        focusRing: {
          width: '3px',
          style: 'solid',
          color: '{primary.600}',
          offset: '2px',
        },
      },
    },
  },
});

import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

export const BeachVolleyLight = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#eef2ff',
      100: '#e3e8ff',
      200: '#c7d2ff',
      300: '#a3b3fb',
      400: '#6f87ef',
      500: '#3f61e4',
      600: '#1b4fd8',
      700: '#1740b0',
      800: '#14348c',
      900: '#122c70',
      950: '#0f1b23',
    },
    colorScheme: {
      light: {
        formField: {
          background: '{surface.50}',
          borderColor: '{surface.200}',
          hoverBorderColor: '{primary.600}',
          focusBorderColor: '{primary.600}',
          borderRadius: '4px',
          paddingX: '0.8125rem',
          paddingY: '0.875rem',
        },
        surface: {
          0: '#ffffff',
          50: '#faf7f0',
          100: '#f4efe4',
          200: '#e7decb',
          300: '#d9cdb4',
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

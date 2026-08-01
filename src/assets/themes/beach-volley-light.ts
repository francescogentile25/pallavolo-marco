import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

export const BeachVolleyLight = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#e8fbf8',
      100: '#c5f5ef',
      200: '#8de9df',
      300: '#55dccf',
      400: '#27cbbb',
      500: '#12af9f',
      600: '#0b8d82',
      700: '#0b7069',
      800: '#0c5954',
      900: '#20322f',
      950: '#0b1e25',
    },
    colorScheme: {
      light: {
        surface: {
          0: '#ffffff',
          50: '#f7faf9',
          100: '#eef4f2',
          200: '#dce7e4',
          300: '#bdcfca',
          400: '#93ada7',
          500: '#6f8d87',
          600: '#55716c',
          700: '#435a57',
          800: '#334744',
          900: '#20322f',
          950: '#0b1e25',
        },
        focusRing: {
          width: '3px',
          style: 'solid',
          color: '{primary.300}',
          offset: '2px',
        },
      },
    },
  },
});

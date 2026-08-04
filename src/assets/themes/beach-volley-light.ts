import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

export const BeachVolleyLight = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9',
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
      950: '#082f49',
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
          50: '#f8fcfe',
          100: '#eff7fb',
          200: '#d9e7ef',
          300: '#bdd2dd',
          400: '#8eabb9',
          500: '#627d8d',
          600: '#496777',
          700: '#35505f',
          800: '#203c4d',
          900: '#122e42',
          950: '#082f49',
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

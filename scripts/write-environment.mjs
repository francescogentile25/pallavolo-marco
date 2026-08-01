import { writeFileSync } from 'node:fs';

const allowPlaceholder = process.argv.includes('--allow-placeholder');
const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if ((!supabaseUrl || !supabasePublishableKey) && !allowPlaceholder) {
  throw new Error(
    'Configura SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY nelle Environment Variables di Vercel.',
  );
}

const config = {
  production: true,
  supabaseUrl: supabaseUrl ?? 'https://YOUR_PROJECT_REF.supabase.co',
  supabasePublishableKey: supabasePublishableKey ?? 'YOUR_SUPABASE_PUBLISHABLE_KEY',
};

writeFileSync(
  'src/environments/environment.production.ts',
  `export const environment = ${JSON.stringify(config, null, 2)} as const;\n`,
  'utf8',
);

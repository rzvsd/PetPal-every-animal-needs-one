import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const isProductionBuild = process.env.REACT_APP_BUILD_PROFILE === 'production';
export const allowLocalDemo = !isProductionBuild && process.env.REACT_APP_ALLOW_LOCAL_DEMO === 'true';

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export const demoSupabaseCredentials = {
  email: process.env.REACT_APP_SUPABASE_DEMO_EMAIL,
  password: process.env.REACT_APP_SUPABASE_DEMO_PASSWORD,
};

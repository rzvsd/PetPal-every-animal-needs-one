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
        // PKCE: email links carry a one-time code instead of session tokens.
        // The code is useless without the verifier kept on the device that
        // asked for the link, so an app that intercepts the link gets nothing.
        flowType: 'pkce',
      },
    })
  : null;

// Host of the https App Link that brings password reset emails back into the
// Android app, e.g. "petpal.example.com". The same host must serve
// /.well-known/assetlinks.json and be on Supabase's redirect allow-list.
export const authLinkHost = (process.env.REACT_APP_AUTH_LINK_HOST || '').trim().toLowerCase();

export const demoSupabaseCredentials = {
  email: process.env.REACT_APP_SUPABASE_DEMO_EMAIL,
  password: process.env.REACT_APP_SUPABASE_DEMO_PASSWORD,
};

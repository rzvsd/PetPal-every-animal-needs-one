const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const localUrlPattern = /(localhost|127\.0\.0\.1|10\.0\.2\.2|0\.0\.0\.0|192\.168\.|172\.1[6-9]\.|172\.2\d\.|172\.3[0-1]\.|10\.)/i;
const allowOfflineRelease = process.env.PETPAL_ALLOW_OFFLINE_RELEASE === 'true'
  || process.argv.includes('--offline');
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
const authLinkHost = (process.env.REACT_APP_AUTH_LINK_HOST || '').trim().toLowerCase();

function fail(message) {
  console.error(`Production build blocked: ${message}`);
  process.exit(1);
}

if (!allowOfflineRelease) {
  if (!supabaseUrl || !supabaseAnonKey) {
    fail('set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY, or use PETPAL_ALLOW_OFFLINE_RELEASE=true for a local unsigned verification build.');
  }
  if (!authLinkHost) {
    fail('set REACT_APP_AUTH_LINK_HOST to the https host that serves the password reset App Link (see docs/auth-app-links.md).');
  }
}

if (authLinkHost && !/^[a-z0-9.-]+$/.test(authLinkHost)) {
  fail(`REACT_APP_AUTH_LINK_HOST must be a bare host name such as petpal.example.com, got: ${authLinkHost}`);
}

if (supabaseUrl && localUrlPattern.test(supabaseUrl)) {
  fail(`local Supabase URL is not allowed in production assets: ${supabaseUrl}`);
}

const env = {
  ...process.env,
  NODE_ENV: 'production',
  GENERATE_SOURCEMAP: process.env.GENERATE_SOURCEMAP || 'false',
  REACT_APP_BUILD_PROFILE: 'production',
  REACT_APP_ALLOW_LOCAL_DEMO: 'false',
  REACT_APP_VERSION: process.env.REACT_APP_VERSION || process.env.npm_package_version || '0.1.0',
  REACT_APP_SUPABASE_URL: supabaseUrl,
  REACT_APP_SUPABASE_ANON_KEY: supabaseAnonKey,
  REACT_APP_AUTH_LINK_HOST: authLinkHost,
  REACT_APP_SUPABASE_DEMO_EMAIL: '',
  REACT_APP_SUPABASE_DEMO_PASSWORD: '',
};

if (allowOfflineRelease && !supabaseUrl) {
  env.REACT_APP_SUPABASE_URL = '';
  env.REACT_APP_SUPABASE_ANON_KEY = '';
}

const reactScripts = path.join(
  process.cwd(),
  'node_modules',
  'react-scripts',
  'bin',
  'react-scripts.js',
);

const result = spawnSync(process.execPath, [reactScripts, 'build'], {
  stdio: 'inherit',
  env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.status === 0) {
  fs.writeFileSync(path.join(process.cwd(), 'build', 'petpal-build.json'), JSON.stringify({
    profile: 'production', allowLocalDemo: false, backendConfigured: Boolean(supabaseUrl && supabaseAnonKey),
  }));
}
process.exit(result.status || 0);

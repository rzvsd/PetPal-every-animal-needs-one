const { spawnSync } = require('child_process');
const path = require('path');

const localUrlPattern = /(localhost|127\.0\.0\.1|10\.0\.2\.2|0\.0\.0\.0|192\.168\.|172\.1[6-9]\.|172\.2\d\.|172\.3[0-1]\.|10\.)/i;
const allowOfflineRelease = process.env.PETPAL_ALLOW_OFFLINE_RELEASE === 'true'
  || process.argv.includes('--offline');
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

function fail(message) {
  console.error(`Production build blocked: ${message}`);
  process.exit(1);
}

if (!allowOfflineRelease) {
  if (!supabaseUrl || !supabaseAnonKey) {
    fail('set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY, or use PETPAL_ALLOW_OFFLINE_RELEASE=true for a local unsigned verification build.');
  }
}

if (supabaseUrl && localUrlPattern.test(supabaseUrl)) {
  fail(`local Supabase URL is not allowed in production assets: ${supabaseUrl}`);
}

const env = {
  ...process.env,
  NODE_ENV: 'production',
  GENERATE_SOURCEMAP: process.env.GENERATE_SOURCEMAP || 'false',
  REACT_APP_BUILD_PROFILE: 'production',
  REACT_APP_VERSION: process.env.REACT_APP_VERSION || process.env.npm_package_version || '0.1.0',
  REACT_APP_SUPABASE_URL: supabaseUrl,
  REACT_APP_SUPABASE_ANON_KEY: supabaseAnonKey,
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

process.exit(result.status || 0);

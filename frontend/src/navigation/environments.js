export const MATCH_ENVIRONMENT = 'match';
export const FOSTER_ENVIRONMENT = 'foster';

// The pilot opens Foster only. Production builds hide Match unless
// REACT_APP_ENABLE_MATCH=true; development builds show it unless it is 'false'.
export function isMatchEnabled(env = process.env) {
  if (env.REACT_APP_ENABLE_MATCH === 'true') return true;
  if (env.REACT_APP_ENABLE_MATCH === 'false') return false;
  return env.REACT_APP_BUILD_PROFILE !== 'production';
}
export const MATCH_ENABLED = isMatchEnabled();

export function getEnvironmentHomeTab(environment) {
  return environment === FOSTER_ENVIRONMENT ? 'foster' : 'matches';
}

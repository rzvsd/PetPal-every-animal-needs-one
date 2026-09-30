export const MATCH_ENVIRONMENT = 'match';
export const FOSTER_ENVIRONMENT = 'foster';

export function getEnvironmentHomeTab(environment) {
  return environment === FOSTER_ENVIRONMENT ? 'foster' : 'matches';
}

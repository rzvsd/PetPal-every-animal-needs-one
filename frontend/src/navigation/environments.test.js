import {
  FOSTER_ENVIRONMENT,
  MATCH_ENVIRONMENT,
  getEnvironmentHomeTab,
} from './environments';

test('maps each environment to its own home tab', () => {
  expect(getEnvironmentHomeTab(MATCH_ENVIRONMENT)).toBe('matches');
  expect(getEnvironmentHomeTab(FOSTER_ENVIRONMENT)).toBe('foster');
});

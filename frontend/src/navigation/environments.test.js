import {
  FOSTER_ENVIRONMENT,
  MATCH_ENVIRONMENT,
  getEnvironmentHomeTab,
  isMatchEnabled,
} from './environments';

test('maps each environment to its own home tab', () => {
  expect(getEnvironmentHomeTab(MATCH_ENVIRONMENT)).toBe('matches');
  expect(getEnvironmentHomeTab(FOSTER_ENVIRONMENT)).toBe('foster');
});

test('the pilot hides Match in production builds unless it is turned on', () => {
  expect(isMatchEnabled({ REACT_APP_BUILD_PROFILE: 'production' })).toBe(false);
  expect(isMatchEnabled({ REACT_APP_BUILD_PROFILE: 'production', REACT_APP_ENABLE_MATCH: 'true' })).toBe(true);
  expect(isMatchEnabled({})).toBe(true);
  expect(isMatchEnabled({ REACT_APP_ENABLE_MATCH: 'false' })).toBe(false);
});

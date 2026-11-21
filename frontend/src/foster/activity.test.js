import { activityTime } from './Activity';

jest.mock('../context/AppContext', () => ({ useApp: () => ({}) }));
jest.mock('../services/fosterApi', () => ({}));

const now = Date.parse('2026-11-21T15:00:00Z');
const ago = seconds => new Date(now - seconds * 1000).toISOString();

test('recent notices read as relative times', () => {
  expect(activityTime(ago(20), 'en', now)).toBe('this minute');
  expect(activityTime(ago(5 * 60), 'en', now)).toBe('5 min ago');
  expect(activityTime(ago(3 * 3600), 'en', now)).toBe('3 hr ago');
  expect(activityTime(ago(30 * 3600), 'en', now)).toBe('yesterday');
});

test('older notices show a short date in the app language', () => {
  expect(activityTime('2026-11-02T10:00:00Z', 'en', now)).toBe('2 Nov');
  expect(activityTime('2026-11-02T10:00:00Z', 'ro', now)).toMatch(/^2 nov/);
});

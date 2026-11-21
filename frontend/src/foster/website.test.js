import { safeWebsite } from './Find';

test('only plain web pages become links', () => {
  expect(safeWebsite('https://casalabute.ro/adoptii')).toBe('https://casalabute.ro/adoptii');
  expect(safeWebsite('http://example.org')).toBe('http://example.org/');
  expect(safeWebsite('javascript:alert(1)')).toBeNull();
  expect(safeWebsite('data:text/html,hi')).toBeNull();
  expect(safeWebsite('casalabute.ro')).toBeNull();
  expect(safeWebsite(null)).toBeNull();
});

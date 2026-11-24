import { allPages } from './useFosterData';

const pages = (total, size = 25) => page => Promise.resolve({
  rows: Array.from({ length: Math.max(0, Math.min(size, total - page * size)) }, (_, index) => page * size + index),
  count: total,
});

test('reads every page past the first 25 rows', async () => {
  const result = await allPages(pages(60));
  expect(result.rows).toHaveLength(60);
  expect(result.rows[59]).toBe(59);
});

test('one page is read once', async () => {
  const load = jest.fn(pages(10));
  const result = await allPages(load);
  expect(result.rows).toHaveLength(10);
  expect(load).toHaveBeenCalledTimes(1);
});

test('stops at the page cap', async () => {
  const result = await allPages(pages(1000), 3);
  expect(result.rows).toHaveLength(75);
});

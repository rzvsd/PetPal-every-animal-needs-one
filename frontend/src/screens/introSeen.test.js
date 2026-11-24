import { introSeen, markIntroSeen } from './introSeen';

test('the intro counts as seen once it has played', () => {
  window.localStorage.clear();
  expect(introSeen()).toBe(false);
  markIntroSeen();
  expect(introSeen()).toBe(true);
});

test('without storage the intro just plays again', () => {
  const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  expect(introSeen()).toBe(false);
  spy.mockRestore();
});

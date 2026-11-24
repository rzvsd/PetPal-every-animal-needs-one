// The opening film plays on the first start only. Later starts open straight
// into the app. Storage can be unavailable (private mode, cleared data): then
// the film simply plays again, which is harmless.
const KEY = 'petpal.introSeen.v1';

export function introSeen() {
  try { return window.localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function markIntroSeen() {
  try { window.localStorage.setItem(KEY, '1'); } catch { /* The film plays again next time. */ }
}

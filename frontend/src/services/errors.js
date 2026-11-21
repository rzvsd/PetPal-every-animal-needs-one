import { serverErrorsRo } from '../i18n/serverErrors';

// The database and Auth speak English; Romanian users get the Romanian wording.
export function translateServerMessage(message) {
  if (typeof document !== 'undefined' && document.documentElement.lang === 'ro') return serverErrorsRo[message] || message;
  return message;
}

// Messages PetPal's database raises on purpose (P0001) and Supabase Auth
// messages are written for people; anything else (constraint, permission or
// internal errors) could expose implementation details, so it is replaced.
export function friendlyError(error, t, fallback) {
  if (error?.code === 'P0001' && error.message) return translateServerMessage(error.message);
  if (error?.name === 'AuthApiError' && error.message) return translateServerMessage(error.message);
  console.error(error);
  if (/failed to fetch|network ?error|load failed/i.test(error?.message || '')) return t('errors.network');
  return fallback || t('errors.generic');
}

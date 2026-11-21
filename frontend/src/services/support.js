// Where people reach a human at PetPal. Set REACT_APP_SUPPORT_EMAIL at build
// time; until then the app points to in-app reports, which every moderator sees.
export const SUPPORT_EMAIL = (process.env.REACT_APP_SUPPORT_EMAIL || '').trim();

// "Support PetPal" (card payments) stays hidden until a legal entity and
// purpose are stated. Set REACT_APP_ENABLE_SUPPORT_PETPAL=true to show it.
export const SUPPORT_PETPAL_ENABLED = process.env.REACT_APP_ENABLE_SUPPORT_PETPAL === 'true';

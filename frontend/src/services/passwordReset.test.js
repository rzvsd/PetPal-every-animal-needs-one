import { supabase } from './supabaseClient';
import { isPasswordResetLink, openSupabaseRecoveryLink, passwordResetLink, requestSupabasePasswordReset } from './supabaseApi';

jest.mock('./supabaseClient', () => ({
  authLinkHost: 'petpal.example.com',
  isSupabaseConfigured: true,
  demoSupabaseCredentials: {},
  supabase: { auth: { exchangeCodeForSession: jest.fn(), setSession: jest.fn(), resetPasswordForEmail: jest.fn() } },
}));

beforeEach(() => jest.clearAllMocks());

test('the phone reset link is the https App Link', () => {
  expect(passwordResetLink()).toBe('https://petpal.example.com/reset');
  expect(passwordResetLink('')).toBe('');
});

test('only the https App Link on the configured host counts as a reset link', () => {
  expect(isPasswordResetLink('https://petpal.example.com/reset?code=abc')).toBe(true);
  expect(isPasswordResetLink('https://PetPal.Example.com/reset/?code=abc')).toBe(true);
  expect(isPasswordResetLink('petpal://reset#access_token=a&refresh_token=b')).toBe(false);
  expect(isPasswordResetLink('http://petpal.example.com/reset?code=abc')).toBe(false);
  expect(isPasswordResetLink('https://evil.example.com/reset?code=abc')).toBe(false);
  expect(isPasswordResetLink('https://petpal.example.com.evil.com/reset?code=abc')).toBe(false);
  expect(isPasswordResetLink('https://petpal.example.com/other?code=abc')).toBe(false);
  expect(isPasswordResetLink('not a url')).toBe(false);
  expect(isPasswordResetLink('https://petpal.example.com/reset', '')).toBe(false);
});

test('native reset requests redirect to the App Link', async () => {
  supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  await requestSupabasePasswordReset('a@b.c', true);
  expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('a@b.c', { redirectTo: 'https://petpal.example.com/reset' });
});

test('the PKCE code is exchanged for a session', async () => {
  supabase.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  await expect(openSupabaseRecoveryLink('https://petpal.example.com/reset?code=one-time')).resolves.toBe(true);
  expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('one-time');
});

test('tokens carried in the link are never used to sign in', async () => {
  await expect(openSupabaseRecoveryLink('https://petpal.example.com/reset#access_token=a&refresh_token=b&type=recovery')).resolves.toBe(false);
  expect(supabase.auth.setSession).not.toHaveBeenCalled();
  expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
});

test('errors in the link are reported', async () => {
  await expect(openSupabaseRecoveryLink('https://petpal.example.com/reset?error=access_denied&error_description=Link+expired')).rejects.toThrow('Link expired');
  await expect(openSupabaseRecoveryLink('https://petpal.example.com/reset#error_description=Link+expired')).rejects.toThrow('Link expired');
});

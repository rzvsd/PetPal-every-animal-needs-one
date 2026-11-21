import { supabase } from './supabaseClient';
import { loadSupabaseConversationTyping } from './supabaseApi';

jest.mock('./supabaseClient', () => ({
  isSupabaseConfigured: true,
  demoSupabaseCredentials: {},
  supabase: { rpc: jest.fn() },
}));

const answer = data => supabase.rpc.mockResolvedValueOnce({ data, error: null });

test('nobody is typing when the server returns no row', async () => {
  answer([]);
  await expect(loadSupabaseConversationTyping('c1')).resolves.toEqual({ isTyping: false, updatedAt: null });
  answer(null);
  await expect(loadSupabaseConversationTyping('c1')).resolves.toEqual({ isTyping: false, updatedAt: null });
});

test('a typing row is read as typing', async () => {
  answer([{ is_typing: true, updated_at: '2026-11-21T10:00:00Z' }]);
  await expect(loadSupabaseConversationTyping('c1')).resolves.toEqual({ isTyping: true, updatedAt: '2026-11-21T10:00:00Z' });
  answer([{ is_typing: false, updated_at: '2026-11-21T10:00:00Z' }]);
  await expect(loadSupabaseConversationTyping('c1')).resolves.toMatchObject({ isTyping: false });
});

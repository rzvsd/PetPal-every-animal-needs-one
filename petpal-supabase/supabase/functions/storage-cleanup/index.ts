import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.1';
import { processStorageCleanupQueue } from '../_shared/storage-cleanup.ts';

// Retries files left in public.storage_cleanup_queue (migration 0032), for
// example ID documents whose removal failed during account deletion. Run it
// on a schedule (see petpal-supabase/README.md); each run drains up to 500
// entries, oldest attempt first.

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function getEnv(name: string) {
  return Deno.env.get(name) || '';
}

async function sameSecret(given: string, expected: string) {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(given)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left[index] ^ right[index];
  return diff === 0;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  // Fail closed: only the scheduler that knows the secret may run cleanup.
  const expectedSecret = getEnv('STORAGE_CLEANUP_SECRET');
  if (!expectedSecret) {
    return jsonResponse({ error: 'Storage cleanup is not configured' }, 500);
  }
  if (!(await sameSecret(request.headers.get('x-petpal-cleanup-secret') || '', expectedSecret))) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = getEnv('SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Supabase service credentials are not configured' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  try {
    const result = await processStorageCleanupQueue(admin);
    return jsonResponse(result, result.failed > 0 ? 207 : 200);
  } catch (error) {
    console.error('storage cleanup queue read failed', error);
    return jsonResponse({ error: 'Storage cleanup failed' }, 500);
  }
});

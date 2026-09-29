import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

function getEnv(name: string) {
  return Deno.env.get(name) || '';
}

// Every step is idempotent, so a failed request can simply be retried.
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = getEnv('SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Account deletion is not configured' }, 500);
  }

  const authorization = request.headers.get('authorization') || '';
  const accessToken = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
  if (userError || !userData.user) {
    console.error('session check failed', userError);
    return jsonResponse({ error: 'Invalid session' }, 401);
  }
  const userId = userData.user.id;

  // Document paths must be read before delete_account_data removes the rows.
  const { data: documents, error: documentsError } = await admin
    .from('verification_documents')
    .select('storage_path')
    .eq('profile_id', userId);
  if (documentsError) {
    console.error('verification document lookup failed', documentsError);
    return jsonResponse({ error: 'Account deletion failed. Please try again.' }, 500);
  }

  const { data: result, error: deleteError } = await admin.rpc('delete_account_data', { profile_id_input: userId });
  if (deleteError) {
    console.error('delete_account_data failed', deleteError);
    return jsonResponse({ error: 'Account deletion failed. Please try again.' }, 500);
  }
  if (!result?.deleted) {
    return jsonResponse({ deleted: false, blockers: result?.blockers || {} }, 409);
  }

  try {
    // Animal photos live under <userId>/<animalId>/<file>.
    const photos = admin.storage.from('animal-photos');
    const { data: folders, error: listError } = await photos.list(userId, { limit: 1000 });
    if (listError) throw listError;
    const paths: string[] = [];
    for (const entry of folders || []) {
      if (entry.id) {
        paths.push(`${userId}/${entry.name}`);
        continue;
      }
      const { data: files, error } = await photos.list(`${userId}/${entry.name}`, { limit: 1000 });
      if (error) throw error;
      for (const file of files || []) paths.push(`${userId}/${entry.name}/${file.name}`);
    }
    if (paths.length) {
      const { error } = await photos.remove(paths);
      if (error) throw error;
    }

    const documentPaths = (documents || []).map((row) => row.storage_path).filter(Boolean);
    if (documentPaths.length) {
      const { error } = await admin.storage.from('verification-documents').remove(documentPaths);
      if (error) throw error;
    }
  } catch (error) {
    console.error('storage cleanup failed', error);
    return jsonResponse({ error: 'Account deletion failed. Please try again.' }, 500);
  }

  // Soft delete keeps the auth row so anonymised records stay linked, while
  // the email is scrubbed and the account can no longer sign in.
  const { error: authError } = await admin.auth.admin.deleteUser(userId, true);
  if (authError) {
    console.error('auth user deletion failed', authError);
    return jsonResponse({ error: 'Account deletion failed. Please try again.' }, 500);
  }

  return jsonResponse({ deleted: true });
});

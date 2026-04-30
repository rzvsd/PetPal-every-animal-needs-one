import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.1';

type PushJob = {
  event_id: string;
  profile_id: string;
  token_id: string;
  token: string;
  platform: string;
  provider: string;
  event_type: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  attempt: number;
};

type SendResult = {
  eventId: string;
  tokenId: string;
  ok: boolean;
  error?: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-petpal-push-secret',
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

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function encodeJson(input: unknown) {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(input)));
}

function pemToArrayBuffer(pem: string) {
  const base64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replaceAll('\n', '')
    .trim();
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function payloadToData(payload: Record<string, unknown>, eventType: string) {
  const data: Record<string, string> = { eventType };

  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    data[key] = typeof value === 'string' ? value : JSON.stringify(value);
  });

  return data;
}

async function createGoogleAccessToken() {
  const serviceAccountRaw = getEnv('FCM_SERVICE_ACCOUNT_JSON');
  if (!serviceAccountRaw) return '';

  const serviceAccount = JSON.parse(serviceAccountRaw);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const unsignedJwt = `${encodeJson(header)}.${encodeJson(claim)}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsignedJwt),
  );
  const assertion = `${unsignedJwt}.${toBase64Url(new Uint8Array(signature))}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Google token request failed: ${response.status} ${errorBody}`);
  }

  const tokenResponse = await response.json();
  return tokenResponse.access_token as string;
}

async function sendWithFcmV1(job: PushJob, accessToken: string, projectId: string) {
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: job.token,
        notification: {
          title: job.title,
          body: job.body,
        },
        data: payloadToData(job.payload, job.event_type),
        android: {
          priority: 'HIGH',
          notification: {
            channel_id: 'petpal_updates',
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`FCM v1 send failed: ${response.status} ${errorBody}`);
  }
}

async function sendWithLegacyFcm(job: PushJob, serverKey: string) {
  const response = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      authorization: `key=${serverKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      to: job.token,
      notification: {
        title: job.title,
        body: job.body,
      },
      data: payloadToData(job.payload, job.event_type),
      priority: 'high',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`FCM legacy send failed: ${response.status} ${errorBody}`);
  }

  const result = await response.json();
  if (result.failure && result.failure > 0) {
    throw new Error(`FCM legacy send failed: ${JSON.stringify(result.results || result)}`);
  }
}

async function sendPush(job: PushJob, accessToken: string, projectId: string, legacyServerKey: string) {
  if (getEnv('FCM_DRY_RUN') === 'true') return;
  if (accessToken && projectId) {
    await sendWithFcmV1(job, accessToken, projectId);
    return;
  }
  if (legacyServerKey) {
    await sendWithLegacyFcm(job, legacyServerKey);
    return;
  }
  throw new Error('FCM credentials are not configured. Set FCM_SERVICE_ACCOUNT_JSON + FCM_PROJECT_ID, or FCM_SERVER_KEY.');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const expectedSecret = getEnv('PUSH_FUNCTION_SECRET');
  if (expectedSecret && request.headers.get('x-petpal-push-secret') !== expectedSecret) {
    return jsonResponse({ error: 'Unauthorized push sender' }, 401);
  }

  const supabaseUrl = getEnv('SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Supabase service credentials are not configured' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const requestBody = request.method === 'POST'
    ? await request.json().catch(() => ({}))
    : {};

  if (requestBody?.mode === 'test' && requestBody.profileId) {
    const { error } = await supabase.rpc('enqueue_push_notification', {
      profile_id_input: requestBody.profileId,
      event_type_input: 'TEST_NOTIFICATION',
      payload_input: { source: 'edge-function-test' },
      title_input: requestBody.title || 'PetPal test notification',
      body_input: requestBody.body || 'Push notifications are connected.',
    });

    if (error) return jsonResponse({ error: error.message }, 500);
  }

  const batchSize = Number.isFinite(Number(requestBody?.batchSize))
    ? Number(requestBody.batchSize)
    : 25;
  const { data: jobs, error: claimError } = await supabase.rpc('claim_pending_push_notifications', {
    batch_size_input: batchSize,
  });

  if (claimError) {
    return jsonResponse({ error: claimError.message }, 500);
  }

  const projectId = getEnv('FCM_PROJECT_ID');
  const legacyServerKey = getEnv('FCM_SERVER_KEY');
  const accessToken = projectId ? await createGoogleAccessToken().catch((error) => {
    console.error(error);
    return '';
  }) : '';

  const results: SendResult[] = [];
  const eventResults = new Map<string, { success: number; errors: string[] }>();

  for (const job of (jobs || []) as PushJob[]) {
    try {
      await sendPush(job, accessToken, projectId, legacyServerKey);
      results.push({ eventId: job.event_id, tokenId: job.token_id, ok: true });
      const aggregate = eventResults.get(job.event_id) || { success: 0, errors: [] };
      aggregate.success += 1;
      eventResults.set(job.event_id, aggregate);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ eventId: job.event_id, tokenId: job.token_id, ok: false, error: message });
      const aggregate = eventResults.get(job.event_id) || { success: 0, errors: [] };
      aggregate.errors.push(message);
      eventResults.set(job.event_id, aggregate);

      if (/UNREGISTERED|registration-token-not-registered|invalid registration/i.test(message)) {
        await supabase
          .from('push_tokens')
          .update({ enabled: false, disabled_at: new Date().toISOString() })
          .eq('id', job.token_id);
      }
    }
  }

  for (const [eventId, aggregate] of eventResults.entries()) {
    if (aggregate.success > 0) {
      await supabase.rpc('mark_push_notification_sent', { event_id_input: eventId });
    } else {
      await supabase.rpc('mark_push_notification_failed', {
        event_id_input: eventId,
        error_message_input: aggregate.errors.join('\n').slice(0, 1000),
      });
    }
  }

  return jsonResponse({
    ok: true,
    claimed: jobs?.length || 0,
    sent: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    dryRun: getEnv('FCM_DRY_RUN') === 'true',
    results,
  });
});

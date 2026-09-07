import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'stripe-signature, content-type',
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

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;

  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function parseStripeSignature(header: string) {
  const parts = header.split(',').reduce<Record<string, string[]>>((acc, part) => {
    const [key, value] = part.split('=');
    if (!key || !value) return acc;
    acc[key] = [...(acc[key] || []), value];
    return acc;
  }, {});

  return {
    timestamp: parts.t?.[0] || '',
    signatures: parts.v1 || [],
  };
}

async function verifyStripeSignature(rawBody: string, signatureHeader: string, webhookSecret: string) {
  const { timestamp, signatures } = parseStripeSignature(signatureHeader);
  if (!timestamp || signatures.length === 0) return false;
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expected = toHex(digest);

  return signatures.some((signature) => timingSafeEqual(signature, expected));
}

function mapStripeStatus(eventType: string, paymentStatus?: string) {
  if (eventType === 'checkout.session.async_payment_succeeded' || paymentStatus === 'paid') return 'PAID';
  if (eventType === 'checkout.session.expired') return 'CANCELED';
  if (eventType === 'checkout.session.async_payment_failed') return 'FAILED';
  return null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = getEnv('SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const webhookSecret = getEnv('STRIPE_WEBHOOK_SECRET');

  if (!supabaseUrl || !serviceRoleKey || !webhookSecret) {
    return jsonResponse({ error: 'Stripe webhook is not configured' }, 500);
  }

  const signatureHeader = request.headers.get('stripe-signature') || '';
  const rawBody = await request.text();
  const verified = await verifyStripeSignature(rawBody, signatureHeader, webhookSecret);
  if (!verified) {
    return jsonResponse({ error: 'Invalid Stripe signature' }, 400);
  }

  const event = JSON.parse(rawBody);
  const session = event?.data?.object || {};
  const providerSessionId = session.id as string | undefined;
  const paymentSessionId = session.metadata?.payment_session_id as string | undefined;
  const mappedStatus = mapStripeStatus(event.type, session.payment_status);

  if (!providerSessionId || !mappedStatus) {
    return jsonResponse({ ok: true, ignored: true });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const updatePayload: Record<string, unknown> = {
    status: mappedStatus,
    provider_session_id: providerSessionId,
    updated_at: new Date().toISOString(),
    metadata: {
      ...(session.metadata || {}),
      stripe_event_id: event.id,
      stripe_event_type: event.type,
      payment_status: session.payment_status,
    },
  };

  let query = supabase
    .from('payment_sessions')
    .update(updatePayload)
    .eq('provider', 'STRIPE');

  query = paymentSessionId
    ? query.eq('id', paymentSessionId)
    : query.eq('provider_session_id', providerSessionId);

  const { data, error } = await query.select('id, status').maybeSingle();
  if (error) {
    return jsonResponse({ error: error.message }, 500);
  }

  return jsonResponse({
    ok: true,
    paymentSessionId: data?.id || paymentSessionId || null,
    status: data?.status || mappedStatus,
  });
});

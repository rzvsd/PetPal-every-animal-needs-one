import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.105.1';

type PaymentRequest = {
  provider?: 'STRIPE' | 'NETOPIA';
  purpose?: 'DONATION' | 'SPONSORSHIP' | 'PREMIUM';
  amountCents?: number;
  currency?: 'RON' | 'EUR' | 'USD';
  metadata?: Record<string, unknown>;
};

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

function normalizeCurrency(currency?: string) {
  const value = String(currency || 'RON').toUpperCase();
  if (!['RON', 'EUR', 'USD'].includes(value)) {
    throw new Error('Unsupported currency');
  }
  return value as 'RON' | 'EUR' | 'USD';
}

function normalizePurpose(purpose?: string) {
  const value = String(purpose || 'DONATION').toUpperCase();
  if (!['DONATION', 'SPONSORSHIP', 'PREMIUM'].includes(value)) {
    throw new Error('Unsupported payment purpose');
  }
  if (value === 'PREMIUM') {
    throw new Error('Premium payments are not enabled yet');
  }
  return value as 'DONATION' | 'SPONSORSHIP';
}

function normalizeAmount(amount?: number) {
  const value = Number(amount);
  if (!Number.isInteger(value) || value < 100 || value > 100000000) {
    throw new Error('Invalid payment amount');
  }
  return value;
}

// Only known, short string metadata is stored and forwarded to Stripe.
function pickClientMetadata(input: unknown) {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const picked: Record<string, string> = {};
  for (const key of ['app', 'source']) {
    const value = source[key];
    if (typeof value === 'string' && value.length > 0 && value.length <= 64) picked[key] = value;
  }
  return picked;
}

function createStripeFormBody(input: {
  paymentSessionId: string;
  profileId: string;
  purpose: string;
  amountCents: number;
  currency: string;
  metadata: Record<string, unknown>;
}) {
  const successUrl = getEnv('PAYMENT_SUCCESS_URL') || 'petpal://payments/success?session_id={CHECKOUT_SESSION_ID}';
  const cancelUrl = getEnv('PAYMENT_CANCEL_URL') || 'petpal://payments/cancel?session_id={CHECKOUT_SESSION_ID}';
  const productName = input.purpose === 'SPONSORSHIP'
    ? 'PetPal animal sponsorship'
    : 'PetPal donation';

  const body = new URLSearchParams();
  body.set('mode', 'payment');
  body.set('success_url', successUrl);
  body.set('cancel_url', cancelUrl);
  body.set('client_reference_id', input.paymentSessionId);
  body.set('line_items[0][price_data][currency]', input.currency.toLowerCase());
  body.set('line_items[0][price_data][product_data][name]', productName);
  body.set('line_items[0][price_data][unit_amount]', String(input.amountCents));
  body.set('line_items[0][quantity]', '1');
  body.set('metadata[payment_session_id]', input.paymentSessionId);
  body.set('metadata[profile_id]', input.profileId);
  body.set('metadata[purpose]', input.purpose);

  Object.entries(input.metadata || {}).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    body.set(`metadata[petpal_${key}]`, typeof value === 'string' ? value : JSON.stringify(value));
  });

  return body;
}

async function createStripeCheckoutSession(input: {
  paymentSessionId: string;
  profileId: string;
  purpose: string;
  amountCents: number;
  currency: string;
  metadata: Record<string, unknown>;
}) {
  const stripeSecretKey = getEnv('STRIPE_SECRET_KEY');
  if (!stripeSecretKey) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in Supabase Edge Function secrets.');
  }

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${stripeSecretKey}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: createStripeFormBody(input),
  });

  const responseBody = await response.json().catch(async () => ({ raw: await response.text() }));

  if (!response.ok) {
    throw new Error(`Stripe Checkout session failed: ${response.status} ${JSON.stringify(responseBody)}`);
  }

  return responseBody as { id: string; url: string };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = getEnv('SUPABASE_URL');
  const anonKey = getEnv('SUPABASE_ANON_KEY');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Supabase Edge Function credentials are not configured' }, 500);
  }

  const authorization = request.headers.get('authorization') || '';
  const accessToken = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!accessToken) {
    return jsonResponse({ error: 'Authentication required' }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { authorization } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return jsonResponse({ error: userError?.message || 'Invalid session' }, 401);
  }

  let body: PaymentRequest;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  let provider: 'STRIPE' | 'NETOPIA';
  let purpose: 'DONATION' | 'SPONSORSHIP';
  let amountCents: number;
  let currency: 'RON' | 'EUR' | 'USD';

  try {
    provider = String(body.provider || 'STRIPE').toUpperCase() as 'STRIPE' | 'NETOPIA';
    if (!['STRIPE', 'NETOPIA'].includes(provider)) throw new Error('Unsupported payment provider');
    purpose = normalizePurpose(body.purpose);
    amountCents = normalizeAmount(body.amountCents);
    currency = normalizeCurrency(body.currency);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 400);
  }

  if (provider === 'NETOPIA') {
    return jsonResponse({
      error: 'NETOPIA provider is planned but not configured yet.',
      requiresConfiguration: true,
    }, 501);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const clientMetadata = pickClientMetadata(body.metadata);
  const metadata = {
    ...clientMetadata,
    source: clientMetadata.source || 'mobile',
    checkoutProvider: provider,
  };

  const { data: paymentSession, error: insertError } = await adminClient
    .from('payment_sessions')
    .insert({
      profile_id: userData.user.id,
      provider,
      purpose,
      amount_cents: amountCents,
      currency,
      status: 'PENDING',
      metadata,
    })
    .select('*')
    .single();

  if (insertError || !paymentSession) {
    console.error('payment_sessions insert failed', insertError);
    return jsonResponse({ error: 'Payment session could not be created' }, 500);
  }

  try {
    const stripeSession = await createStripeCheckoutSession({
      paymentSessionId: paymentSession.id,
      profileId: userData.user.id,
      purpose,
      amountCents,
      currency,
      metadata,
    });

    const { data: updatedPaymentSession, error: updateError } = await adminClient
      .from('payment_sessions')
      .update({
        provider_session_id: stripeSession.id,
        checkout_url: stripeSession.url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentSession.id)
      .select('*')
      .single();

    if (updateError || !updatedPaymentSession) {
      console.error('payment_sessions update failed', updateError);
      return jsonResponse({ error: 'Payment checkout URL could not be saved' }, 500);
    }

    return jsonResponse({ ok: true, paymentSession: updatedPaymentSession });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const requiresConfiguration = /not configured/i.test(detail);
    // Provider details stay in server logs; the session row is readable by the user.
    console.error('Stripe checkout failed', detail);
    await adminClient
      .from('payment_sessions')
      .update({
        status: 'FAILED',
        metadata: {
          ...metadata,
          error: requiresConfiguration ? 'provider_not_configured' : 'checkout_failed',
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentSession.id);

    return jsonResponse({
      error: 'Payment checkout could not be started',
      requiresConfiguration,
    }, 502);
  }
});

import { createClient } from 'npm:@supabase/supabase-js@2';

const env = (name: string) => Deno.env.get(name) ?? '';
const SUPABASE_URL = env('SUPABASE_URL');
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const BOT_TOKEN = env('TELEGRAM_BOT_TOKEN');
const WEBHOOK_SECRET = env('TELEGRAM_WEBHOOK_SECRET');
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/telegram-support`;
const ALLOWED_ORIGINS = new Set((env('ALLOWED_ORIGINS') || 'https://muslimabaya.com,https://www.muslimabaya.com')
  .split(',').map((x) => x.trim()).filter(Boolean));
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase runtime configuration');
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

function cors(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  return {
    'access-control-allow-origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://muslimabaya.com',
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-max-age': '86400',
    'cache-control': 'no-store',
    'vary': 'Origin',
  };
}
const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors(req), 'content-type': 'application/json; charset=utf-8' },
});

async function requireAgent(req: Request) {
  const header = req.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user?.email) return null;
  const { data: agent, error: agentError } = await db.from('support_agents')
    .select('email,active').eq('email', data.user.email.toLowerCase()).maybeSingle();
  if (agentError || !agent?.active) return null;
  return data.user;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') ?? '';
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(req, { error: 'Origin not allowed' }, 403);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);
  const user = await requireAgent(req);
  if (!user) return json(req, { error: 'Unauthorized support agent' }, 401);
  if (!BOT_TOKEN || !WEBHOOK_SECRET) return json(req, { error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_WEBHOOK_SECRET is not configured' }, 503);

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        secret_token: WEBHOOK_SECRET,
        allowed_updates: ['message'],
        drop_pending_updates: false,
      }),
      signal: AbortSignal.timeout(12000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      return json(req, { error: 'Telegram rejected the webhook configuration', detail: result.description ?? 'Unknown Telegram API error' }, 502);
    }
    const infoResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`, {
      signal: AbortSignal.timeout(9000),
    });
    const info = await infoResponse.json().catch(() => ({}));
    const webhookMatches = Boolean(info?.ok && info.result?.url === WEBHOOK_URL);
    return json(req, {
      ok: true,
      webhookMatches,
      description: result.description ?? 'Webhook configured',
      pendingUpdateCount: info?.result?.pending_update_count ?? null,
      lastErrorDate: info?.result?.last_error_date ?? null,
      lastErrorMessage: info?.result?.last_error_message ?? null,
    }, webhookMatches ? 200 : 502);
  } catch (e) {
    console.error('Webhook setup failed:', e instanceof Error ? e.message : 'unknown');
    return json(req, { error: 'Could not reach Telegram Bot API' }, 502);
  }
});

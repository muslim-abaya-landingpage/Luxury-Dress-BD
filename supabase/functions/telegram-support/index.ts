import { createClient } from 'npm:@supabase/supabase-js@2';

const env = (key: string) => Deno.env.get(key) ?? '';
const SUPABASE_URL = env('SUPABASE_URL');
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const BOT_TOKEN = env('TELEGRAM_BOT_TOKEN');
const BOT_SECRET = env('TELEGRAM_WEBHOOK_SECRET');
// Optional: Telegram chat ID (number) of the team member/group that should be alerted about new website chats.
const ADMIN_CHAT_ID = env('TELEGRAM_ADMIN_CHAT_ID');
const INBOX_URL = 'https://muslimabaya.com/admin-support-inbox.html';
const ALLOWED_ORIGINS = new Set(
  (env('ALLOWED_ORIGINS') || 'https://muslimabaya.com,https://www.muslimabaya.com')
    .split(',').map((v) => v.trim()).filter(Boolean),
);
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Missing Supabase runtime configuration');

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function cors(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  return {
    'access-control-allow-origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://muslimabaya.com',
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, x-telegram-bot-api-secret-token',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-max-age': '86400',
    'cache-control': 'no-store',
    'vary': 'Origin',
  };
}
const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors(req), 'content-type': 'application/json; charset=utf-8' },
});
const plain = (body: string, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

function safeEqual(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

async function telegramSend(chatId: number, body: string) {
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: body.slice(0, 4000) }),
    signal: AbortSignal.timeout(9000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(`Telegram send failed (${response.status})`);
}

async function saveMessage(
  conversationId: string, body: string, role: 'customer' | 'agent',
  senderId: string | null, externalId: string | null = null,
) {
  const { data, error } = await db.from('support_messages').insert({
    conversation_id: conversationId,
    sender_id: senderId,
    sender_external_id: externalId,
    sender_role: role,
    body: body.slice(0, 2000),
  }).select('id,conversation_id,body,sender_role,sender_id,created_at').single();
  if (error) throw error;
  return data;
}

const isMissingColumn = (e: { code?: string } | null) => !!e && (e.code === '42703' || e.code === 'PGRST204');

function telegramName(from: any) {
  const full = [from?.first_name, from?.last_name].filter(Boolean).join(' ').trim();
  return (full || (from?.username ? `@${from.username}` : '')).slice(0, 80) || null;
}

async function getTelegramConversation(chatId: number, from: any = null) {
  const { data: existing, error } = await db.from('support_conversations')
    .select('id,status').eq('telegram_chat_id', chatId).maybeSingle();
  if (error) throw error;
  if (existing) {
    // A customer writing again reopens a closed chat so it shows up in the inbox.
    if (existing.status === 'closed') {
      await db.from('support_conversations').update({ status: 'open' }).eq('id', existing.id);
      existing.status = 'open';
    }
    return existing;
  }
  const row: Record<string, unknown> = {
    visitor_id: null,
    channel: 'telegram',
    telegram_chat_id: chatId,
    status: 'open',
    subject: 'Telegram support',
    page_path: '/',
    customer_name: telegramName(from),
  };
  let created = await db.from('support_conversations').insert(row).select('id,status').single();
  if (isMissingColumn(created.error)) {
    // Contact-details migration not applied yet: create the chat without the name.
    delete row.customer_name;
    created = await db.from('support_conversations').insert(row).select('id,status').single();
  }
  if (created.error) throw created.error;
  return created.data;
}

async function botReply(chatId: number, conversationId: string, message: string) {
  await telegramSend(chatId, message);
  await saveMessage(conversationId, message, 'agent', null, 'telegram-bot');
}

async function getSession(chatId: number) {
  const { data, error } = await db.from('telegram_support_sessions')
    .select('stage,order_id').eq('telegram_chat_id', chatId).maybeSingle();
  if (error) throw error;
  return data;
}
async function setSession(chatId: number, stage: string, orderId: string | null = null) {
  const { error } = await db.from('telegram_support_sessions').upsert({
    telegram_chat_id: chatId, stage, order_id: orderId, updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

async function productsReply(chatId: number, conversationId: string, term = '') {
  let query = db.from('products').select('name,category,price_from,price_full_set,fabric,in_stock')
    .order('name').limit(6);
  if (term) query = query.ilike('name', `%${term.replace(/[%_]/g, '')}%`);
  const { data, error } = await query;
  if (error) throw error;
  if (!data?.length) return botReply(chatId, conversationId, 'এখন পণ্যের তালিকা পাওয়া যাচ্ছে না। সাপোর্ট টিমকে /human লিখে জানান।');
  const output = data.map((p) => {
    const price = p.price_full_set ? `৳${p.price_from} থেকে · ফুল সেট ৳${p.price_full_set}` : `৳${p.price_from}`;
    return `• ${p.name}${p.category ? ` (${p.category})` : ''}\n${price}${p.in_stock === false ? ' · স্টক নেই' : ''}${p.fabric ? `\nকাপড়: ${p.fabric}` : ''}`;
  });
  return botReply(chatId, conversationId, `পণ্যের তথ্য:\n\n${output.join('\n\n')}`);
}

async function orderReply(chatId: number, conversationId: string, orderId: string, last4: string) {
  const { data, error } = await db.from('orders').select('id,status,phone,created_at')
    .eq('id', orderId).maybeSingle();
  if (error) throw error;
  const phone = String(data?.phone ?? '').replace(/\D/g, '');
  if (!data || !phone.endsWith(last4)) {
    return botReply(chatId, conversationId, 'অর্ডার তথ্য মেলেনি। অর্ডার নম্বর ও ফোনের শেষ ৪ সংখ্যা যাচাই করুন, অথবা /human লিখুন।');
  }
  const labels: Record<string, string> = {
    pending: 'অপেক্ষমাণ', confirmed: 'নিশ্চিত', processing: 'প্রস্তুত হচ্ছে',
    shipped: 'কুরিয়ারে পাঠানো হয়েছে', delivered: 'ডেলিভারি সম্পন্ন',
    cancelled: 'বাতিল', returned: 'ফেরত',
  };
  const updated = data.created_at ? new Date(data.created_at).toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' }) : '';
  return botReply(chatId, conversationId,
    `অর্ডার: ${data.id}\nস্ট্যাটাস: ${labels[data.status] ?? data.status}${updated ? `\nঅর্ডারের তারিখ: ${updated}` : ''}`);
}

async function handleUpdate(update: any) {
  const msg = update?.message;
  if (!msg?.chat?.id || msg.chat.type !== 'private') return;
  const chatId = Number(msg.chat.id);
  const input = String(msg.text ?? '').trim();
  if (!input) return;
  const conversation = await getTelegramConversation(chatId, msg.from);
  await saveMessage(conversation.id, input, 'customer', null, String(chatId));
  const lower = input.toLowerCase();

  if (lower === '/start') {
    await setSession(chatId, 'idle');
    return botReply(chatId, conversation.id,
      'আসসালামু আলাইকুম! Muslim Abaya সাপোর্টে স্বাগতম।\n\n/products — পণ্য দেখুন\n/product নাম — পণ্য খুঁজুন\n/order — অর্ডার স্ট্যাটাস\n/human — সাপোর্ট টিমের সঙ্গে কথা বলুন\n\nOTP, পাসওয়ার্ড বা কার্ডের তথ্য পাঠাবেন না।');
  }
  if (lower === '/products') return productsReply(chatId, conversation.id);
  if (lower.startsWith('/product ')) return productsReply(chatId, conversation.id, input.slice(9).trim());
  if (lower === '/order') {
    await setSession(chatId, 'awaiting_order');
    return botReply(chatId, conversation.id, 'অর্ডার নম্বরটি পাঠান। বাতিল করতে /cancel লিখুন।');
  }
  if (lower === '/cancel') {
    await setSession(chatId, 'idle');
    return botReply(chatId, conversation.id, 'যাচাই বাতিল হয়েছে। অপশন দেখতে /start লিখুন।');
  }
  if (lower === '/human') return botReply(chatId, conversation.id, 'আপনার কথোপকথন সাপোর্ট ইনবক্সে এসেছে। এজেন্ট এই বটে উত্তর দেবেন।');

  const session = await getSession(chatId);
  if (session?.stage === 'awaiting_order') {
    if (!/^[A-Za-z0-9-]{4,80}$/.test(input)) return botReply(chatId, conversation.id, 'অর্ডার নম্বরটি ঠিকভাবে দিন, অথবা /cancel লিখুন।');
    await setSession(chatId, 'awaiting_phone', input);
    return botReply(chatId, conversation.id, 'অর্ডারে ব্যবহৃত ফোন নম্বরের শেষ ৪ সংখ্যা পাঠান। পুরো নম্বর পাঠাবেন না।');
  }
  if (session?.stage === 'awaiting_phone') {
    if (!/^\d{4}$/.test(input)) return botReply(chatId, conversation.id, 'শুধু ফোনের শেষ ৪ সংখ্যা দিন, অথবা /cancel লিখুন।');
    await setSession(chatId, 'idle');
    return orderReply(chatId, conversation.id, session.order_id, input);
  }
  return botReply(chatId, conversation.id, 'অপশন দেখতে /start লিখুন। পণ্য: /products · অর্ডার: /order · কর্মী: /human');
}

async function telegramWebhook(req: Request) {
  if (!BOT_TOKEN || !BOT_SECRET) return plain('Telegram bot secrets are not configured', 503);
  if (!safeEqual(req.headers.get('x-telegram-bot-api-secret-token') ?? '', BOT_SECRET)) return plain('Unauthorized', 401);
  const update = await req.json().catch(() => null);
  if (!Number.isSafeInteger(update?.update_id)) return plain('Bad update', 400);
  const { error } = await db.from('telegram_support_updates').insert({ update_id: update.update_id, status: 'processing' });
  if (error?.code === '23505') return plain('OK');
  if (error) return plain('Retry', 500);
  try {
    await handleUpdate(update);
    await db.from('telegram_support_updates').update({ status: 'done' }).eq('update_id', update.update_id);
    return plain('OK');
  } catch (e) {
    console.error('Telegram update failed:', e instanceof Error ? e.message : 'unknown');
    await db.from('telegram_support_updates').delete().eq('update_id', update.update_id);
    return plain('Retry', 500);
  }
}

async function signedInUser(req: Request) {
  const header = req.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  return error || !data.user ? null : data.user;
}

// Website customer message -> alert the team on Telegram (deduplicated, at most one alert per chat per 2 minutes).
async function notifyTeam(req: Request) {
  const user = await signedInUser(req);
  if (!user) return json(req, { error: 'Unauthorized' }, 401);
  if (!BOT_TOKEN || !/^-?\d+$/.test(ADMIN_CHAT_ID)) return json(req, { ok: false, skipped: 'not_configured' });
  const payload = await req.json().catch(() => null);
  const messageId = String(payload?.message_id ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) return json(req, { error: 'Invalid message' }, 400);
  const { data: message, error } = await db.from('support_messages')
    .select('id,conversation_id,sender_id,sender_role,body,created_at').eq('id', messageId).maybeSingle();
  if (error || !message || message.sender_role !== 'customer' || message.sender_id !== user.id) {
    return json(req, { error: 'Message not found' }, 404);
  }
  if (Date.now() - new Date(message.created_at).getTime() > 10 * 60 * 1000) return json(req, { ok: false, skipped: 'too_old' });
  const { data: conv } = await db.from('support_conversations').select('*').eq('id', message.conversation_id).maybeSingle();
  if (!conv || conv.channel !== 'website') return json(req, { ok: false, skipped: 'not_website' });

  const { error: ledgerError } = await db.from('telegram_support_notification_deliveries')
    .insert({ message_id: message.id, status: 'sending' });
  if (ledgerError?.code === '23505') return json(req, { ok: true, skipped: 'duplicate' });
  if (ledgerError) return json(req, { error: 'Could not record notification' }, 500);

  const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: recent } = await db.from('support_messages').select('id')
    .eq('conversation_id', message.conversation_id).eq('sender_role', 'customer').gte('created_at', since).neq('id', message.id);
  const recentIds = (recent ?? []).map((r: { id: string }) => r.id);
  if (recentIds.length) {
    const { data: sent } = await db.from('telegram_support_notification_deliveries').select('message_id')
      .in('message_id', recentIds).eq('status', 'sent').limit(1);
    if (sent?.length) {
      await db.from('telegram_support_notification_deliveries').update({ status: 'sent', delivered_at: new Date().toISOString() }).eq('message_id', message.id);
      return json(req, { ok: true, skipped: 'throttled' });
    }
  }

  const who = [conv.customer_name, conv.customer_phone].filter(Boolean).join(' · ') || `ভিজিটর ${String(conv.id).slice(0, 6)}`;
  const text = `🛍 নতুন ওয়েবসাইট মেসেজ\n${who}\nপেজ: ${conv.page_path || '/'}\n\n${String(message.body).slice(0, 500)}\n\nউত্তর দিন: ${INBOX_URL}`;
  try {
    await telegramSend(Number(ADMIN_CHAT_ID), text);
  } catch (e) {
    console.error('Team notification failed:', e instanceof Error ? e.message : 'unknown');
    await db.from('telegram_support_notification_deliveries').delete().eq('message_id', message.id);
    return json(req, { error: 'Notification failed' }, 502);
  }
  await db.from('telegram_support_notification_deliveries').update({ status: 'sent', delivered_at: new Date().toISOString() }).eq('message_id', message.id);
  return json(req, { ok: true });
}

async function authorizedAgent(req: Request) {
  const header = req.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user?.email) return null;
  const { data: agent, error: agentError } = await db.from('support_agents')
    .select('email,display_name,active').eq('email', data.user.email.toLowerCase()).maybeSingle();
  if (agentError || !agent?.active) return null;
  return { user: data.user, agent };
}

async function adminApi(req: Request, path: string) {
  const auth = await authorizedAgent(req);
  if (!auth) return json(req, { error: 'Unauthorized support agent' }, 401);
  const url = new URL(req.url);

  if (req.method === 'GET' && path.endsWith('/admin/conversations')) {
    const { data, error } = await db.from('support_conversations')
      .select('id,channel,status,telegram_chat_id,created_at,last_message_at,page_path,support_messages(id,body,sender_role,created_at)')
      .order('last_message_at', { ascending: false }).limit(100);
    if (error) return json(req, { error: 'Could not load inbox' }, 500);
    return json(req, { conversations: data ?? [] });
  }
  if (req.method === 'GET' && path.endsWith('/admin/messages')) {
    const id = url.searchParams.get('conversation_id');
    if (!id) return json(req, { error: 'conversation_id required' }, 400);
    const { data, error } = await db.from('support_messages').select('id,body,sender_role,created_at')
      .eq('conversation_id', id).order('created_at').limit(200);
    if (error) return json(req, { error: 'Could not load messages' }, 500);
    return json(req, { messages: data ?? [] });
  }
  if (req.method === 'POST' && path.endsWith('/admin/reply')) {
    const payload = await req.json().catch(() => null);
    const id = String(payload?.conversation_id ?? '');
    const body = String(payload?.message ?? '').trim();
    if (!id || !body || body.length > 2000) return json(req, { error: 'Invalid message' }, 400);
    const { data: conv, error } = await db.from('support_conversations')
      .select('id,channel,telegram_chat_id,status').eq('id', id).maybeSingle();
    if (error || !conv || conv.status === 'closed') return json(req, { error: 'Conversation unavailable' }, 404);
    if (conv.channel === 'telegram' && !BOT_TOKEN) return json(req, { error: 'Telegram bot token is not configured' }, 503);
    const { data: saved, error: insertError } = await db.from('support_messages').insert({
      conversation_id: id, sender_id: auth.user.id, sender_role: 'agent', body,
    }).select('id,body,sender_role,created_at').single();
    if (insertError) return json(req, { error: 'Could not save reply' }, 500);
    if (conv.channel === 'telegram' && conv.telegram_chat_id) {
      try { await telegramSend(Number(conv.telegram_chat_id), body); }
      catch (e) { console.error('Telegram delivery failed:', e instanceof Error ? e.message : 'unknown'); return json(req, { error: 'Reply saved but Telegram delivery failed; retry from the inbox' }, 502); }
    }
    return json(req, { message: saved });
  }
  return json(req, { error: 'Not found' }, 404);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') ?? '';
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(req, { error: 'Origin not allowed' }, 403);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  const path = new URL(req.url).pathname;
  try {
    if (req.method === 'POST' && path.endsWith('/telegram-support')) return await telegramWebhook(req);
    if (req.method === 'POST' && path.endsWith('/notify')) return await notifyTeam(req);
    if (path.includes('/admin/')) return await adminApi(req, path);
    return json(req, { error: 'Not found' }, 404);
  } catch (e) {
    console.error('Unhandled function error:', e instanceof Error ? e.message : 'unknown');
    return json(req, { error: 'Internal error' }, 500);
  }
});

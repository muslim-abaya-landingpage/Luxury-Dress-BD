// Supabase Edge Function: supabase/functions/order-status/index.ts
// Keep verify_jwt enabled. Never put a service-role key in this file or in the browser.

const DEFAULT_ALLOWED_ORIGIN = "https://muslimabaya.com";
const allowedOrigins = new Set(
  (Deno.env.get("ALLOWED_ORIGINS") || DEFAULT_ALLOWED_ORIGIN)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const allowedTurnstileHostnames = new Set(["muslimabaya.com"]);

function headersFor(origin: string) {
  const allowedOrigin = allowedOrigins.has(origin) ? origin : DEFAULT_ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };
}

function jsonResponse(origin: string, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: headersFor(origin),
  });
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin") || "";

  if (origin && !allowedOrigins.has(origin)) {
    return jsonResponse(origin, { ok: false, error: "ORIGIN_NOT_ALLOWED" }, 403);
  }

  if (request.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: headersFor(origin) });
  }
  if (request.method !== "POST") {
    return jsonResponse(origin, { ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  }

  // Supabase's Edge gateway verifies the JWT when verify_jwt=true. This is an
  // additional presence check, not a replacement for gateway JWT verification.
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(origin, { ok: false, error: "AUTH_REQUIRED" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(origin, { ok: false, error: "INVALID_JSON" }, 400);
  }

  const phone = String(body.phone || "").trim();
  const orderId = String(body.orderId || "").trim();
  const turnstileToken = String(body.turnstileToken || "").trim();
  const phoneDigits = phone.replace(/\D/g, "");

  // Order ID is required: phone-only lookups could disclose a customer's other orders.
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    return jsonResponse(origin, { ok: false, error: "INVALID_PHONE" }, 400);
  }
  if (!orderId || orderId.length > 80) {
    return jsonResponse(origin, { ok: false, error: "INVALID_ORDER_ID" }, 400);
  }
  if (!turnstileToken || turnstileToken.length > 4096) {
    return jsonResponse(origin, { ok: false, error: "CAPTCHA_REQUIRED" }, 400);
  }

  const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
  const orderTrackApiUrl = Deno.env.get("ORDER_TRACK_API_URL");
  if (!turnstileSecret || !orderTrackApiUrl) {
    return jsonResponse(origin, { ok: false, error: "FUNCTION_NOT_CONFIGURED" }, 500);
  }

  // Verify each lookup server-side. The secret never leaves Supabase.
  try {
    const verifyBody = new URLSearchParams({
      secret: turnstileSecret,
      response: turnstileToken,
    });
    const verifyResponse = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: verifyBody,
      },
    );
    const verification = await verifyResponse.json();
    if (
      !verifyResponse.ok || verification.success !== true ||
      verification.action !== "order_status" ||
      !allowedTurnstileHostnames.has(String(verification.hostname || ""))
    ) {
      return jsonResponse(origin, { ok: false, error: "CAPTCHA_FAILED" }, 403);
    }
  } catch {
    return jsonResponse(origin, { ok: false, error: "CAPTCHA_UNAVAILABLE" }, 502);
  }

  // Existing Apps Script route: RecordType=OrderTrack&Phone=...&OrderId=...
  // Its own rate limit and phone/order matching remain enabled.
  try {
    const upstreamUrl = new URL(orderTrackApiUrl);
    upstreamUrl.searchParams.set("RecordType", "OrderTrack");
    upstreamUrl.searchParams.set("Phone", phone);
    upstreamUrl.searchParams.set("OrderId", orderId);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    let upstreamResponse: Response;
    try {
      upstreamResponse = await fetch(upstreamUrl, {
        method: "GET",
        headers: { "Accept": "application/json" },
        signal: controller.signal,
        redirect: "follow",
      });
    } finally {
      clearTimeout(timer);
    }

    if (!upstreamResponse.ok) {
      return jsonResponse(origin, { ok: false, error: "ORDER_LOOKUP_UNAVAILABLE" }, 502);
    }

    const result = await upstreamResponse.json();
    if (result?.ok !== true || !Array.isArray(result.orders)) {
      const rateLimited = result?.error === "RATE_LIMIT";
      return jsonResponse(
        origin,
        { ok: false, error: rateLimited ? "RATE_LIMIT" : "ORDER_LOOKUP_UNAVAILABLE" },
        rateLimited ? 429 : 502,
      );
    }

    const match = result.orders.find((order: Record<string, unknown>) =>
      String(order.orderId || "").trim().toLowerCase() === orderId.toLowerCase()
    );
    if (!match) {
      return jsonResponse(origin, { ok: true, order: null });
    }

    // Return only fields needed for status. Do not expose phone, district, product,
    // quantity, order total, address, or other rows from the sheet.
    return jsonResponse(origin, {
      ok: true,
      order: {
        orderId: String(match.orderId || ""),
        date: String(match.date || ""),
        status: String(match.status || "Status unavailable"),
        tracking: String(match.tracking || ""),
        courierStatus: String(match.courierStatus || ""),
      },
    });
  } catch {
    return jsonResponse(origin, { ok: false, error: "ORDER_LOOKUP_UNAVAILABLE" }, 502);
  }
});

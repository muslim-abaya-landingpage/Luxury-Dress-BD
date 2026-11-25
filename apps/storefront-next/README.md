# Muslim Abaya — Next.js storefront (migration preview)

This app is isolated from the current production build. It is not wired to the live domain or production data.

## Stack

- Next.js 16 App Router
- React 19 + TypeScript
- Server-side Laravel API client
- Responsive CSS foundation

## Local development

```bash
cd apps/storefront-next
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Build checks

```bash
npm run typecheck
npm run build
```

Node.js 20.9 or newer is required by the current Next.js installation guide.

## Integration rules

- Laravel API URL is server-only; never expose credentials with a `NEXT_PUBLIC_` variable.
- The storefront must not connect directly to Supabase using a service-role key.
- Product and order data remain disconnected until source mapping, API contracts, and test fixtures are approved.
- Existing production HTML, Vite build, Cloudflare Pages build command, DNS and domain routing are unchanged.
- Do not use this folder as the Cloudflare production build output.

# Advanced Fraud Protection — Phase 1

## Scope delivered in this foundation

- Extracted checkout risk scoring into a pure, deterministic module.
- Preserved the existing repeat-phone and shared-IP thresholds.
- Added a signed, first-party, pseudonymous device token (180-day lifetime) using an HttpOnly, Secure cookie.
- Added D1 device-order activity aggregation and repeat-device risk scoring.
- Added optional, explainable scoring inputs for VPN/proxy intelligence and hosting-network signals.
- Added explicit actions: `allow`, `challenge`, and `manual_review`.
- Risk scoring alone never rejects an order. Existing explicit IP blacklist enforcement remains a separate control.

## Important implementation boundary

The device token is now collected only when `DEVICE_TOKEN_SECRET` is configured (at least 32 characters) and the `schema-device.sql` migration has been applied to the Worker D1 database. It is a signed, pseudonymous first-party browser identifier, not a hardware fingerprint. It will not reliably link private browsing, cleared cookies, other browsers, or other devices. VPN/proxy classification is still inactive and must come from a trusted server-side intelligence source, not a browser-supplied boolean.

## Next implementation steps

1. Configure `DEVICE_TOKEN_SECRET` in Cloudflare Worker Secrets and apply `cloudflare-worker/schema-device.sql` to D1 before enabling this feature in production.
2. Add provider-backed VPN/proxy intelligence and configurable challenge thresholds.
3. Add OTP challenge flow with a Bangladesh SMS adapter and delivery/rate-limit safeguards.
4. Add courier delivery-history scoring only where real provider history exists and sample size is adequate.
5. Add admin review/blacklist controls and separate abandoned-cart recovery from blocked orders.
6. Verify payment callbacks and Meta CAPI deduplication in staging before production activation.

## Verification

Run:

```sh
node --test tests/backend/fraud-risk.test.mjs tests/backend/device-token.test.mjs
node --test tests/backend/order-ip-guard.test.mjs
```

No production deployment or external SMS/payment charge is part of this phase.

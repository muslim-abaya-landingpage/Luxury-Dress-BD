# Advanced Fraud Protection — Phase 1

## Scope delivered in this foundation

- Extracted checkout risk scoring into a pure, deterministic module.
- Preserved the existing repeat-phone and shared-IP thresholds.
- Added optional, explainable scoring inputs for repeat-device activity, VPN/proxy intelligence and hosting-network signals.
- Added explicit actions: `allow`, `challenge`, and `manual_review`.
- Risk scoring alone never rejects an order. Existing explicit IP blacklist enforcement remains a separate control.

## Important implementation boundary

The new device and network inputs are **not yet collected or enabled**. They are extension points, not claims that device fingerprinting or VPN detection is live. Device matching must use a privacy-reviewed, rotating/pseudonymous server-side identifier and multiple signals; it cannot guarantee identity across incognito, browser resets, VPNs or device changes. VPN/proxy classification must come from a trusted server-side intelligence source, not a browser-supplied boolean.

## Next implementation steps

1. Add server-side device-token issuance and D1 event aggregation with retention limits.
2. Add provider-backed VPN/proxy intelligence and configurable challenge thresholds.
3. Add OTP challenge flow with a Bangladesh SMS adapter and delivery/rate-limit safeguards.
4. Add courier delivery-history scoring only where real provider history exists and sample size is adequate.
5. Add admin review/blacklist controls and separate abandoned-cart recovery from blocked orders.
6. Verify payment callbacks and Meta CAPI deduplication in staging before production activation.

## Verification

Run:

```sh
node --test tests/backend/fraud-risk.test.mjs
node --test tests/backend/order-ip-guard.test.mjs
```

No production deployment or external SMS/payment charge is part of this phase.

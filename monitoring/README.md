# Prometheus + Grafana starter configuration

These files provide low-volume, GET-only synthetic monitoring for the public storefront and Google Apps Script health endpoints. They do not submit orders or write to Sheets.

## What is included

- `prometheus/prometheus.yml` — Prometheus scrape jobs for itself, Blackbox Exporter, homepage, checkout, public API configuration, Apps Script root and schema.
- `prometheus/blackbox.yml` — HTTP success, root response-text and `OrderSchema` JSON-body checks.
- `prometheus/alert-rules.yml` — checkout outage, public-route availability, Apps Script/schema health, slow probes, TLS expiry and exporter availability.
- `grafana/provisioning/datasources/prometheus.yml` — the default Prometheus datasource (UID `prometheus`).
- `grafana/provisioning/dashboards/provider.yml` and `grafana/dashboards/storefront-probes.json` — file-provisioned dashboard.
- `alertmanager/alertmanager.yml.example` — P1-to-Slack + email copy, P2-to-email routes with secret-file references and placeholder destinations; follow [`docs/ALERTMANAGER-SLACK-EMAIL-GUIDE-BN.md`](../docs/ALERTMANAGER-SLACK-EMAIL-GUIDE-BN.md) before production use.

## Configure and start

1. Install Prometheus, Prometheus Blackbox Exporter, Alertmanager and Grafana on a host/container network that can resolve the service names in `prometheus.yml` (`blackbox-exporter:9115`, `alertmanager:9093`). The app does not include a monitoring server or deployment credentials.
2. In both Apps Script targets in `prometheus/prometheus.yml`, replace `REPLACE_WITH_DEPLOYMENT_ID` with the current public Web App URL from `site-api-config.js`. The Web App URL is already client-side configuration, not an auth secret. Keep the two targets as GET requests: root and `?RecordType=OrderSchema`.
3. Mount `prometheus/prometheus.yml` and `prometheus/alert-rules.yml` into Prometheus at the paths shown in the configuration. Mount `prometheus/blackbox.yml` into Blackbox Exporter as its config. Ensure all monitoring services share a private network.
4. Configure Alertmanager using the example file: replace SMTP host/sender/recipient, confirm the Slack webhook's channel, and mount the referenced secret files read-only. Until credentials, recipients and a test alert are verified, Prometheus may evaluate rules but **no person will be notified**. Store notification credentials in the monitoring host’s secret store, never in this repository.
5. Mount the Grafana provisioning datasource/provider directories and JSON dashboard into the Grafana paths shown in those files. Restart/reload the services and open the dashboard titled **Luxury Dress BD — Synthetic Probes**.
6. Validate Prometheus configuration and rules with `promtool check config` and `promtool check rules`. Check that `/probe?module=http_2xx&target=https://muslimabaya.com/checkout` succeeds from the Blackbox Exporter network and that API root/schema probes return healthy.
7. Restrict Prometheus, Blackbox Exporter, Alertmanager and Grafana to a private network or authenticated TLS reverse proxy. The example services are not a recommendation to expose monitoring ports publicly.

## Alert behavior

- `CheckoutUnavailable` — checkout GET probe fails for 90 seconds (critical).
- `StorefrontRouteUnavailable` — other storefront probes fail for 2 minutes (warning).
- `AppsScriptHealthProbeFailed` — root text or schema GET/body assertion fails for 2 minutes (critical).
- `StorefrontProbeLatencyHigh` — average probe duration is over 2 seconds across repeated 5-minute windows (warning).
- `StorefrontTlsCertificateExpiringSoon` — storefront TLS certificate has under 14 days remaining (warning).
- `BlackboxExporterScrapeFailed` — Prometheus cannot scrape the exporter (warning).

Grouping/deduplication is in the Alertmanager example. Confirm each alert with a controlled test in a non-production monitoring stack and verify both firing and resolved notifications before relying on it.

## Important limitations

These configs observe HTTP reachability, response status/body, probe duration and TLS expiry only. They do **not** measure JavaScript exceptions, checkout conversion, accepted-versus-persisted orders, Sheets reconciliation, Apps Script quotas, stock integrity, admin authorization, or courier outcomes. Those signals need a privacy-safe RUM/event pipeline and/or a protected exporter/reconciliation job. Do not export customer names, phone numbers, addresses, email addresses, payment references, session tokens or raw order payloads as Prometheus labels or alert annotations. Keep label values low-cardinality (route/class/status, never order/customer IDs).

#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';

const DEFAULT_REPOSITORY = 'muslim-abaya-landingpage/Luxury-Dress-BD';
const GRAPHQL_QUERY = `
  query DependabotAlerts($owner: String!, $name: String!, $endCursor: String) {
    repository(owner: $owner, name: $name) {
      vulnerabilityAlerts(first: 100, after: $endCursor) {
        nodes {
          number
          state
          createdAt
          dismissedAt
          securityAdvisory {
            ghsaId
            cveId
            summary
            severity
          }
          securityVulnerability {
            package { name ecosystem }
            vulnerableVersionRange
            firstPatchedVersion { identifier }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

function repositoryFromRemote() {
  try {
    const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim();
    const match = remote.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/i);
    if (match) return match[1];
  } catch (_) {}
  return DEFAULT_REPOSITORY;
}

function fail(message, detail = '') {
  console.error(`Dependabot alert check failed: ${message}`);
  if (detail) console.error(detail.trim());
  process.exit(1);
}

const repository = process.argv[2] || process.env.GITHUB_REPOSITORY || repositoryFromRemote();
const parts = repository.replace(/\.git$/i, '').split('/');
if (parts.length !== 2 || parts.some((part) => !part)) {
  fail(`expected OWNER/REPOSITORY, received: ${repository}`);
}
const [owner, name] = parts;

// The REST alerts endpoint can return 403 for a GitHub App integration token even when
// the authenticated user can query the repository. The GraphQL connection is the
// supported alternate route; gh --paginate follows pageInfo/endCursor automatically.
const result = spawnSync('gh', [
  'api', 'graphql', '--paginate',
  '-f', `query=${GRAPHQL_QUERY}`,
  '-f', `owner=${owner}`,
  '-f', `name=${name}`,
  '--jq', '.data.repository.vulnerabilityAlerts.nodes[] | @json'
], { encoding: 'utf8' });

if (result.error) fail('could not start GitHub CLI (gh).', result.error.message);
if (result.status !== 0) {
  const detail = result.stderr || result.stdout || '';
  if (/403|FORBIDDEN|RESOURCE_NOT_ACCESSIBLE/i.test(detail)) {
    fail('GraphQL also denied alert access. Check that this gh login has repository Dependabot/security alert read permission.', detail);
  }
  fail('GitHub GraphQL request did not succeed.', detail);
}

let alerts;
try {
  alerts = result.stdout.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
} catch (error) {
  fail('GitHub returned an unreadable alert response.', error.message);
}

console.log(`Repository: ${owner}/${name}`);
console.log('Source: GitHub GraphQL vulnerabilityAlerts (paginated; not the REST alerts endpoint)');
if (!alerts.length) {
  console.log('Dependabot alerts found: 0');
  process.exit(0);
}

console.log(`Dependabot alerts found: ${alerts.length}`);
for (const alert of alerts) {
  const advisory = alert.securityAdvisory || {};
  const vulnerability = alert.securityVulnerability || {};
  const dependency = vulnerability.package || {};
  const advisoryId = advisory.cveId || advisory.ghsaId || 'No CVE/GHSA ID';
  const patched = vulnerability.firstPatchedVersion?.identifier || 'No patched version listed';
  console.log(`\n#${alert.number} — ${String(alert.state || 'unknown').toUpperCase()} — ${String(advisory.severity || 'unknown').toUpperCase()}`);
  console.log(`Package: ${dependency.name || 'unknown'} (${dependency.ecosystem || 'unknown'})`);
  console.log(`Advisory: ${advisoryId} — ${advisory.summary || 'No summary'}`);
  console.log(`Affected versions: ${vulnerability.vulnerableVersionRange || 'not specified'}`);
  console.log(`First patched version: ${patched}`);
  console.log(`Alert created: ${alert.createdAt || 'unknown'}${alert.dismissedAt ? `; dismissed: ${alert.dismissedAt}` : ''}`);
}

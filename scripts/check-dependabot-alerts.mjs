#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCKFILE_PATH = path.join(REPO_ROOT, 'package-lock.json');
const ADVISORY_API = 'https://api.github.com/advisories/';

// The three alerts observed in this repository's GitHub Security UI. Querying
// public GHSA records avoids the private /repos/{owner}/{repo}/dependabot/alerts
// endpoint, which returned 403 for the configured GitHub App integration.
const ALERTS = [
  { number: 15, ghsaId: 'GHSA-587h-7wmj-h5pm' },
  { number: 16, ghsaId: 'GHSA-r825-w8mm-5pxw' },
  { number: 14, ghsaId: 'GHSA-698v-4r3x-3vcv' },
];

function fail(message, detail = '') {
  console.error(`Security advisory check failed: ${message}`);
  if (detail) console.error(detail.trim());
  process.exit(1);
}

function loadLockfile() {
  try {
    return JSON.parse(fs.readFileSync(LOCKFILE_PATH, 'utf8'));
  } catch (error) {
    fail(`cannot read ${path.relative(REPO_ROOT, LOCKFILE_PATH)}.`, error.message);
  }
}

function packageVersions(lockfile) {
  const installed = new Map();
  for (const [lockPath, entry] of Object.entries(lockfile.packages || {})) {
    if (!lockPath.includes('node_modules/') || !entry?.version) continue;
    const packageName = entry.name || lockPath.slice(lockPath.lastIndexOf('node_modules/') + 'node_modules/'.length);
    const versions = installed.get(packageName) || [];
    versions.push(entry.version);
    installed.set(packageName, versions);
  }
  return installed;
}

function parseStableVersion(value) {
  const match = String(value).trim().replace(/^v/, '').match(/^(\d+)\.(\d+)(?:\.(\d+))?(?:\+[^-]+)?$/);
  if (!match) return null; // Prereleases and non-semver values are never treated as safe.
  return [Number(match[1]), Number(match[2]), Number(match[3] || 0)];
}

function compareVersions(left, right) {
  const a = parseStableVersion(left);
  const b = parseStableVersion(right);
  if (!a || !b) return null;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

function satisfiesComparator(version, comparator) {
  const match = comparator.trim().match(/^(<=|>=|<|>|=)?\s*(\d+\.\d+(?:\.\d+)?)(?:\s*)$/);
  if (!match) return null;
  const comparison = compareVersions(version, match[2]);
  if (comparison === null) return null;
  switch (match[1] || '=') {
    case '<=': return comparison <= 0;
    case '>=': return comparison >= 0;
    case '<': return comparison < 0;
    case '>': return comparison > 0;
    case '=': return comparison === 0;
    default: return null;
  }
}

// GitHub's current npm advisory ranges use comma-separated comparator clauses
// (e.g. "<= 6.4.3" or ">= 8.3.0, <= 8.3.2"). Unsupported syntax yields null,
// so the checker reports INDETERMINATE rather than a false pass.
function satisfiesRange(version, range) {
  if (!range || !parseStableVersion(version)) return null;
  const alternatives = String(range).split('||').map((part) => part.trim());
  let hadUnknown = false;
  for (const alternative of alternatives) {
    if (alternative === '*' || alternative.toLowerCase() === 'x') return true;
    const clauses = alternative.split(',').map((part) => part.trim()).filter(Boolean);
    if (!clauses.length) return null;
    const results = clauses.map((clause) => satisfiesComparator(version, clause));
    if (results.some((result) => result === null)) {
      hadUnknown = true;
      continue;
    }
    if (results.every(Boolean)) return true;
  }
  return hadUnknown ? null : false;
}

async function getAdvisory(ghsaId) {
  let response;
  try {
    response = await fetch(`${ADVISORY_API}${encodeURIComponent(ghsaId)}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Luxury-Dress-BD-security-advisory-checker',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    fail(`could not reach public GitHub Advisory ${ghsaId}.`, error.message);
  }
  if (!response.ok) {
    fail(`public GitHub Advisory ${ghsaId} returned HTTP ${response.status}.`, await response.text());
  }
  const advisory = await response.json();
  if (advisory.ghsa_id !== ghsaId) fail(`GitHub returned the wrong advisory for ${ghsaId}.`);
  return advisory;
}

function severityLabel(severity) {
  const value = String(severity || 'unknown').toLowerCase();
  return value === 'medium' ? 'MODERATE' : value.toUpperCase();
}

function checkAdvisory(advisory, installed) {
  const byPackage = new Map();
  for (const vulnerability of advisory.vulnerabilities || []) {
    const packageName = vulnerability.package?.name;
    if (!packageName || vulnerability.package?.ecosystem !== 'npm') continue;
    const records = byPackage.get(packageName) || [];
    records.push(vulnerability);
    byPackage.set(packageName, records);
  }

  const results = [];
  let vulnerable = false;
  let indeterminate = false;
  for (const [packageName, records] of byPackage) {
    const versions = installed.get(packageName) || [];
    if (!versions.length) {
      results.push({ packageName, status: 'not present in lockfile' });
      continue;
    }

    for (const version of versions) {
      const checks = records.map((record) => ({
        record,
        affected: satisfiesRange(version, record.vulnerable_version_range),
      }));
      const affectedRecords = checks.filter((check) => check.affected === true);
      const unknownRecords = checks.filter((check) => check.affected === null);
      if (affectedRecords.length) {
        vulnerable = true;
        results.push({ packageName, version, status: 'AFFECTED', records: affectedRecords.map((x) => x.record) });
      } else if (unknownRecords.length) {
        indeterminate = true;
        results.push({ packageName, version, status: 'INDETERMINATE', records: unknownRecords.map((x) => x.record) });
      } else {
        const major = parseStableVersion(version)?.[0];
        const relevant = records.find((record) => parseStableVersion(record.first_patched_version)?.[0] === major) || records[0];
        results.push({ packageName, version, status: 'not affected', records: relevant ? [relevant] : [] });
      }
    }
  }
  return { results, vulnerable, indeterminate };
}

async function main() {
  const lockfile = loadLockfile();
  const installed = packageVersions(lockfile);
  const repoName = lockfile.name || path.basename(REPO_ROOT);
  let vulnerableCount = 0;
  let indeterminateCount = 0;

  console.log(`Repository lockfile: ${repoName}/package-lock.json`);
  console.log('Source: public GitHub Security Advisory API; each GHSA is queried separately.');
  console.log('Scope: checks locked versions only; does not query or change Dependabot alert OPEN/CLOSED state.\n');

  for (const alert of ALERTS) {
    const advisory = await getAdvisory(alert.ghsaId);
    const check = checkAdvisory(advisory, installed);
    if (check.vulnerable) vulnerableCount += 1;
    if (check.indeterminate) indeterminateCount += 1;

    console.log(`Observed alert #${alert.number} — ${severityLabel(advisory.severity)} — ${advisory.ghsa_id} (${advisory.cve_id || 'no CVE'})`);
    console.log(`  ${advisory.summary || 'No advisory summary'}`);
    for (const result of check.results) {
      if (result.status === 'not present in lockfile') {
        console.log(`  ${result.packageName}: not present in lockfile`);
        continue;
      }
      const evidence = result.records.map((record) => {
        const range = record.vulnerable_version_range || 'range not specified';
        const patch = record.first_patched_version || 'not listed';
        return `affected ${range}; first patched ${patch}`;
      }).join(' | ');
      console.log(`  ${result.packageName}@${result.version}: ${result.status}${evidence ? ` (${evidence})` : ''}`);
    }
    const status = check.vulnerable ? 'VULNERABLE' : check.indeterminate ? 'INDETERMINATE' : 'NO AFFECTED LOCKED VERSIONS';
    console.log(`  Lockfile assessment: ${status}\n`);
  }

  console.log(`Summary: ${ALERTS.length} advisories checked individually; ${vulnerableCount} vulnerable; ${indeterminateCount} indeterminate.`);
  if (vulnerableCount) process.exitCode = 1;
  else if (indeterminateCount) process.exitCode = 2;
}

main().catch((error) => fail('unexpected error.', error.stack || error.message));

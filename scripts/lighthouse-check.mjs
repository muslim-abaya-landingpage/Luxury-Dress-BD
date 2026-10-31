#!/usr/bin/env node
// Mobile page-speed guard for pull requests (.github/workflows/lighthouse.yml).
//
// Runs Lighthouse (mobile emulation, Lighthouse's standard simulated slow-4G + 4x CPU throttling) several times
// per page against a locally served build of the site, takes the MEDIAN of each metric to cut noise, and fails
// when a page drops below its budget or when the page requests one of our own files that does not exist (404).
//
// Only first-party code is measured: third-party hosts (Apps Script API, GTM, Meta, TikTok, YouTube) are blocked,
// so the result does not swing with Google's or Facebook's servers and no production API is called.
//
// Usage:  node scripts/lighthouse-check.mjs [--base http://127.0.0.1:43147] [--runs 3]
// Env:    LIGHTHOUSE_BIN  path to a lighthouse CLI (default: npx --yes lighthouse@13.5.0)
//         CHROME_PATH     Chrome/Chromium binary for Lighthouse
// Output: lighthouse-reports/*.json (+ .html of the median run), a Markdown table on stdout and in
//         $GITHUB_STEP_SUMMARY when set. Exit code 1 when any budget is broken.

import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = arg('base', 'http://127.0.0.1:43147').replace(/\/$/, '');
const RUNS = Math.max(1, Number(arg('runs', '5')) || 5);
const OUT = path.resolve(arg('out', 'lighthouse-reports'));
const LIGHTHOUSE_VERSION = '13.5.0';

// Budgets: set with a margin below what this check measured on main (0959ee8) when it was added, median of 5 runs:
//   Home      score 96, LCP 2.72 s (single runs 90-97, LCP 2.6-3.5 s)
//   /abaya    score 78, LCP 5.88 s (single runs 75-78, LCP 5.9-7.7 s; the first card photo is added by JavaScript,
//             so the browser cannot discover it from the HTML. That is a known gap, not something this check fixes.)
//   On the GitHub runner (first PR run) /abaya LCP was 5.9 s or ~7.75 s (two modes) with a median of 7.75 s, so the
//   LCP budget sits above the upper mode. The first Lighthouse run of a job was also an outlier (home 80, TBT 430 ms),
//   so one warm-up run is made and thrown away before measuring.
// See docs/LIGHTHOUSE-SPEED-CHECK-BN.md. Raise a budget when a page gets faster; never lower one just to make a PR
// pass without a reason written in the PR.
const PAGES = [
  {name: 'Home', path: '/', minScore: 90, maxLcpMs: 3500, maxTbtMs: 600, maxCls: 0.1},
  {name: 'Category (abaya)', path: '/abaya', minScore: 70, maxLcpMs: 9000, maxTbtMs: 600, maxCls: 0.1},
];

const BLOCKED = [
  '*script.google.com*',
  '*script.googleusercontent.com*',
  '*googletagmanager.com*',
  '*google-analytics.com*',
  '*doubleclick.net*',
  '*facebook.net*',
  '*facebook.com*',
  '*tiktok.com*',
  '*tiktokcdn.com*',
  '*youtube.com*',
  '*ytimg.com*',
  '*/_ma/*',
];

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function lighthouseCommand() {
  if (process.env.LIGHTHOUSE_BIN) return [process.env.LIGHTHOUSE_BIN, []];
  return ['npx', ['--yes', `lighthouse@${LIGHTHOUSE_VERSION}`]];
}

function runLighthouse(url, outBase) {
  const [cmd, pre] = lighthouseCommand();
  const lhArgs = [
    ...pre,
    url,
    '--only-categories=performance',
    '--form-factor=mobile',
    '--throttling-method=simulate',
    '--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage',
    '--output=json',
    '--output=html',
    `--output-path=${outBase}`,
    '--quiet',
    ...BLOCKED.map((p) => `--blocked-url-patterns=${p}`),
  ];
  execFileSync(cmd, lhArgs, {stdio: ['ignore', 'inherit', 'inherit'], timeout: 180_000});
  const report = JSON.parse(fs.readFileSync(`${outBase}.report.json`, 'utf8'));
  if (report.runtimeError) throw new Error(`${report.runtimeError.code}: ${report.runtimeError.message}`);
  if (report.categories.performance.score == null) throw new Error('Lighthouse returned no performance score');
  return report;
}

function summarize(report) {
  const a = report.audits;
  const origin = new URL(BASE).origin;
  const broken = (a['network-requests']?.details?.items || [])
    .filter((item) => {
      try {
        return new URL(item.url).origin === origin && item.statusCode >= 400;
      } catch {
        return false;
      }
    })
    .map((item) => `${item.statusCode} ${item.resourceType || ''} ${new URL(item.url).pathname}`.replace(/\s+/g, ' '));
  return {
    score: Math.round(report.categories.performance.score * 100),
    lcp: a['largest-contentful-paint'].numericValue,
    fcp: a['first-contentful-paint'].numericValue,
    tbt: a['total-blocking-time'].numericValue,
    cls: a['cumulative-layout-shift'].numericValue,
    broken,
  };
}

fs.rmSync(OUT, {recursive: true, force: true});
fs.mkdirSync(OUT, {recursive: true});

const rows = [];
const failures = [];

// Warm-up: the first Chrome/Lighthouse start in a fresh job is slower and would add noise; its result is discarded.
try {
  runLighthouse(BASE + PAGES[0].path, path.join(OUT, 'warmup'));
} catch (error) {
  console.warn(`Warm-up run failed (${error.message}); continuing.`);
}
for (const f of fs.readdirSync(OUT)) if (f.startsWith('warmup')) fs.rmSync(path.join(OUT, f));

for (const page of PAGES) {
  const url = BASE + page.path;
  const slug = page.path === '/' ? 'home' : page.path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');
  const runs = [];
  for (let i = 1; i <= RUNS; i += 1) {
    const outBase = path.join(OUT, `${slug}-run${i}`);
    let report;
    try {
      report = runLighthouse(url, outBase);
    } catch (error) {
      console.warn(`Lighthouse run ${i} for ${url} failed (${error.message}); retrying once.`);
      report = runLighthouse(url, outBase);
    }
    const s = summarize(report);
    runs.push(s);
    console.log(`${page.name} run ${i}/${RUNS}: score ${s.score}, LCP ${Math.round(s.lcp)} ms, TBT ${Math.round(s.tbt)} ms, CLS ${s.cls.toFixed(3)}`);
  }

  const m = {
    score: median(runs.map((r) => r.score)),
    lcp: median(runs.map((r) => r.lcp)),
    fcp: median(runs.map((r) => r.fcp)),
    tbt: median(runs.map((r) => r.tbt)),
    cls: median(runs.map((r) => r.cls)),
  };
  // A missing file is not noise: report it if ANY run saw it.
  const broken = [...new Set(runs.flatMap((r) => r.broken))];

  const problems = [];
  if (m.score < page.minScore) problems.push(`performance ${m.score} < ${page.minScore}`);
  if (m.lcp > page.maxLcpMs) problems.push(`LCP ${Math.round(m.lcp)} ms > ${page.maxLcpMs} ms`);
  if (m.tbt > page.maxTbtMs) problems.push(`TBT ${Math.round(m.tbt)} ms > ${page.maxTbtMs} ms`);
  if (m.cls > page.maxCls) problems.push(`CLS ${m.cls.toFixed(3)} > ${page.maxCls}`);
  if (broken.length) problems.push(`missing first-party files (4xx/5xx): ${broken.join(', ')}`);
  if (problems.length) failures.push(`${page.name} (${page.path}): ${problems.join('; ')}`);

  rows.push(
    `| ${page.name} | \`${page.path}\` | ${m.score} (min ${page.minScore}) | ${(m.lcp / 1000).toFixed(2)} s (max ${(page.maxLcpMs / 1000).toFixed(1)}) | ${(m.fcp / 1000).toFixed(2)} s | ${Math.round(m.tbt)} ms (max ${page.maxTbtMs}) | ${m.cls.toFixed(3)} (max ${page.maxCls}) | ${broken.length ? broken.length + ' ❌' : '0'} | ${problems.length ? '❌' : '✅'} |`,
  );
}

const summary = [
  `## Mobile page speed (Lighthouse ${LIGHTHOUSE_VERSION}, median of ${RUNS} runs)`,
  '',
  '| Page | Path | Performance | LCP | FCP | TBT | CLS | Missing files | Result |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ...rows,
  '',
  failures.length
    ? `**Failed:**\n${failures.map((f) => `- ${f}`).join('\n')}`
    : 'All pages are within the speed budget.',
  '',
  '_Measured on a local build with simulated mobile throttling and third-party scripts blocked, so numbers are close to but not the same as PageSpeed Insights on the live site. Full reports are in the `lighthouse-reports` artifact._',
  '',
].join('\n');

console.log(`\n${summary}`);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
fs.writeFileSync(path.join(OUT, 'summary.md'), summary);

if (failures.length) {
  for (const f of failures) console.log(`::error title=Page speed budget::${f}`);
  process.exit(1);
}

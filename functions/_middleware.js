/**
 * Instant live catalog (see functions/_lib/live-catalog.js). Only the paths listed in _routes.json run
 * through Functions; every other file is served straight from the static site as before.
 */
import { LIVE_FILES, serveLiveFile, serveProductPage } from './_lib/live-catalog.js';
import { isBlockedPath } from './_lib/blocked-paths.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  // Source code, tests, notes and tool files are never part of the website (see functions/_lib/blocked-paths.js).
  if (isBlockedPath(url.pathname)) {
    return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return next();
  const path = url.pathname.replace(/^\//, '');
  if (LIVE_FILES.indexOf(path) >= 0) return serveLiveFile(request, env, path);
  const m = /^product\/([^/]+?)(?:\.html)?$/.exec(path);
  if (m) return serveProductPage(request, env, decodeURIComponent(m[1]), next);
  return next();
}

/**
 * Instant live catalog (see functions/_lib/live-catalog.js). Only the paths listed in _routes.json run
 * through Functions; every other file is served straight from the static site as before.
 */
import { LIVE_FILES, serveLiveFile, serveProductPage } from './_lib/live-catalog.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') return next();
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\//, '');
  if (LIVE_FILES.indexOf(path) >= 0) return serveLiveFile(request, env, path);
  const m = /^product\/([^/]+?)(?:\.html)?$/.exec(path);
  if (m) return serveProductPage(request, env, decodeURIComponent(m[1]), next);
  return next();
}

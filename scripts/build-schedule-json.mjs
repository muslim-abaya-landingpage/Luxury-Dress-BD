// Deploy step: writes schedule.json (sale dates and publish times only) for /api/cron-tick.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
execFileSync(process.execPath, [path.join(here, 'sale-boundary-check.mjs'), '--snapshot'], { stdio: 'inherit' });

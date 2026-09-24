import { spawnSync } from 'node:child_process';
import { detectSecretPatterns } from '../lib/security.mjs';

const baseSha = process.env.BASE_SHA;
const headSha = process.env.HEAD_SHA;
if (!baseSha || !headSha) throw new Error('BASE_SHA and HEAD_SHA are required');

const r = spawnSync('git', ['diff','--unified=0',`${baseSha}...${headSha}`], { encoding:'utf8' });
if (r.status !== 0) throw new Error(r.stderr || 'git diff failed');

const added = r.stdout
  .split('\n')
  .filter(line => line.startsWith('+') && !line.startsWith('+++'))
  .map(line => line.slice(1))
  .join('\n');

const hits = detectSecretPatterns(added);
console.log(JSON.stringify({ scannedAddedLines: added ? added.split('\n').length : 0, ruleHits: hits }, null, 2));
if (hits.length) process.exit(2);

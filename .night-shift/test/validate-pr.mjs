import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { validateScope } from '../lib/policy.mjs';

const headRef = process.env.HEAD_REF;
const baseSha = process.env.BASE_SHA;
const headSha = process.env.HEAD_SHA;
if (!headRef || !baseSha || !headSha) throw new Error('HEAD_REF, BASE_SHA and HEAD_SHA are required');

const configs = JSON.parse(fs.readFileSync(new URL('../x-test-cases.json', import.meta.url), 'utf8'));
const scope = configs[headRef];
if (!scope) throw new Error(`No X-test scope declared for ${headRef}`);

function git(args) {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || `git ${args.join(' ')} failed`);
  return r.stdout.trim();
}

const changedFiles = git(['diff','--name-only',`${baseSha}...${headSha}`]).split('\n').filter(Boolean);
const numstat = git(['diff','--numstat',`${baseSha}...${headSha}`]).split('\n').filter(Boolean);
const diffLines = numstat.reduce((sum,line)=>{
  const [a,d] = line.split('\t');
  const add = a === '-' ? 0 : Number(a);
  const del = d === '-' ? 0 : Number(d);
  return sum + add + del;
},0);

const result = validateScope({ changedFiles, diffLines, scope });
console.log(JSON.stringify({ headRef, changedFiles, diffLines, scope, result }, null, 2));
if (!result.pass) process.exit(2);

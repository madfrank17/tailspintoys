import fs from 'node:fs';
const path = new URL('../n8n/night-shift-code-v0.1.json', import.meta.url);
const wf = JSON.parse(fs.readFileSync(path, 'utf8'));
const names = new Set(wf.nodes.map(n => n.name));
const required = ['Manual Probe Input','Authority + Global Stop + Idempotency','Eligible?','Dispatch Placeholder','Stop / Needs Human','Finally Release Lock','Morning Report Placeholder','Eval Record Placeholder'];
for (const name of required) if (!names.has(name)) throw new Error(`Missing node: ${name}`);
if (wf.active !== false) throw new Error('Probe workflow must remain inactive');
if (wf.meta?.productionSafe !== false) throw new Error('Probe must explicitly declare productionSafe=false');
console.log(`workflow contract ok: ${wf.nodes.length} nodes`);

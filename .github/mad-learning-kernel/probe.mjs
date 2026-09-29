import {createHash} from 'node:crypto';
export const repo = 'madfrank17/tailspintoys';
export const marker = '<!-- mad-learning-kernel-state:v0.1\n';
const signals = ['new_empirical_evidence','failure_resolved','transfer_observed','external_outcome','material_state_transition'];
export function adapt(run, pr) {
  if (pr.user.login !== 'madfrank17' || pr.head.repo.full_name !== repo || pr.base.repo.full_name !== repo || pr.state !== 'open') throw Error('Owner/same-repository/open PR guard');
  if (run.repository.full_name !== repo || run.head_repository.full_name !== repo || run.name !== 'Run tests' || run.path !== '.github/workflows/run-tests.yml' || run.status !== 'completed' || !['success','failure'].includes(run.conclusion) || run.head_sha !== pr.head.sha || !run.pull_requests.some(p=>p.number===pr.number)) throw Error('Run identity/result/head SHA guard');
  return {project_id:`github:${repo}`,task_id:`pr:${pr.number}`,new_empirical_evidence:true,failure_resolved:false,transfer_observed:false,external_outcome:false,material_state_transition:false,evidence_refs:[run.html_url,run.head_sha],evidence_fingerprint:createHash('sha256').update(`${run.id}:${run.head_sha}:${run.conclusion}`).digest('hex')};
}
export function decide(event, state, now=Date.now()) {
  if (!signals.some(k=>event[k]===true)) return {decision:'ROUTINE'};
  const key=`${event.project_id}+${event.task_id}`;
  if(state && (state.key!==key || !Number.isFinite(Date.parse(state.last_triggered_at)) || Date.parse(state.last_triggered_at)>now)) throw Error('Invalid marker state');
  if(state?.evidence_fingerprint===event.evidence_fingerprint) return {decision:'DUPLICATE'};
  const override=event.external_outcome===true && !!event.evidence_fingerprint && event.evidence_fingerprint!==state?.evidence_fingerprint;
  if(state && now-Date.parse(state.last_triggered_at)<86400000 && !override) return {decision:'COOLDOWN'};
  // This producer never supplies transfer evidence; CI cannot establish a new ability.
  return {decision:'CANDIDATE',state:{key,last_triggered_at:new Date(now).toISOString(),evidence_fingerprint:event.evidence_fingerprint},record:{Pursuit:'CODE-domain learning probe','Reality Access':'GitHub Actions completed Run tests',Build:event.task_id,Evidence:event.evidence_refs,Capability:'UNKNOWN','New Ability':'UNVERIFIED'}};
}
export function parse(body) {
  if(!body.startsWith(marker) || !body.endsWith('\n-->')) throw Error('Malformed marker');
  return JSON.parse(body.slice(marker.length,-4)).state;
}
export function render(result) { return marker+JSON.stringify(result)+'\n-->'; }
export async function processEvent(event, store, now) {
  if(!signals.some(k=>event[k]===true)) return {decision:'ROUTINE'};
  const comments=await store.list();
  const matches=comments.filter(c=>c.body.startsWith(marker));
  if(matches.length>1) throw Error('Multiple markers: manual recovery required');
  if(matches[0] && !store.trusted(matches[0])) throw Error('Untrusted marker author');
  const result=decide(event,matches[0]?parse(matches[0].body):null,now);
  if(result.decision==='CANDIDATE') await store.write(matches[0]?.id,render(result));
  return result;
}

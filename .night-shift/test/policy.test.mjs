import test from 'node:test';
import assert from 'node:assert/strict';
import policy from '../policy.json' with { type: 'json' };
import { evaluatePreflight, decideAfterFailure, interruptionDecision, finalizeRun, buildMorningReport, toEvalRecord } from '../lib/policy.mjs';

const global = { now: '2026-09-24T23:15:00+12:00', deadlineAt: '2026-09-25T07:00:00+12:00', nightlySpentUsd: 0, circuitOpen: false };
const issue = { number: 101, labels: ['night-shift'] };

test('authorized label actor queues exactly once', () => {
  assert.deepEqual(evaluatePreflight({ issue, labelActor:'madfrank17', config:policy, existing:{}, global, lock:{held:false} }), { state:'QUEUE', reason:'AUTHORIZED' });
  assert.equal(evaluatePreflight({ issue, labelActor:'someone-else', config:policy, existing:{}, global, lock:{held:false} }).reason, 'UNAUTHORIZED_LABEL_ACTOR');
  assert.equal(evaluatePreflight({ issue, labelActor:'madfrank17', config:policy, existing:{openPr:42}, global, lock:{held:false} }).state, 'SKIP_DUPLICATE');
});

test('global hard stops block new work', () => {
  assert.equal(evaluatePreflight({ issue, labelActor:'madfrank17', config:policy, existing:{}, global:{...global, circuitOpen:true}, lock:{held:false} }).reason, 'CIRCUIT_BREAKER');
  assert.equal(evaluatePreflight({ issue, labelActor:'madfrank17', config:policy, existing:{}, global:{...global, nightlySpentUsd:15}, lock:{held:false} }).reason, 'NIGHTLY_BUDGET');
  assert.equal(evaluatePreflight({ issue, labelActor:'madfrank17', config:policy, existing:{}, global:{...global, now:'2026-09-25T07:00:00+12:00'}, lock:{held:false} }).reason, 'DEADLINE');
});

test('retry policy is bounded and single-model', () => {
  const common={ attempts:0, config:policy, spending:{taskSpentUsd:1}, global:{...global, nightlySpentUsd:1} };
  assert.equal(decideAfterFailure({...common, failure:{kind:'TRANSIENT'}}).action,'RETRY_SAME_MODEL');
  assert.equal(decideAfterFailure({...common, failure:{kind:'CAPABILITY'}}).action,'NEEDS_HUMAN');
  assert.equal(decideAfterFailure({...common, failure:{kind:'AMBIGUOUS_REQUIREMENT'}}).action,'NEEDS_HUMAN');
  assert.equal(decideAfterFailure({...common, failure:{kind:'ENVIRONMENT'}}).action,'NEEDS_HUMAN');
  assert.equal(decideAfterFailure({...common, attempts:2, failure:{kind:'TRANSIENT'}}).reason,'MAX_ATTEMPTS');
});

test('global stop gives grace then preserves safe state without forced commit', () => {
  assert.equal(interruptionDecision({globalStop:true, taskFinished:false, safeCheckpointAvailable:false, now:'2026-09-25T07:05:00+12:00', graceUntil:'2026-09-25T07:15:00+12:00'}).action,'GRACE_PERIOD');
  assert.equal(interruptionDecision({globalStop:true, taskFinished:false, safeCheckpointAvailable:false, now:'2026-09-25T07:16:00+12:00', graceUntil:'2026-09-25T07:15:00+12:00'}).action,'PRESERVE_ARTIFACTS_AND_INTERRUPT');
  assert.equal(interruptionDecision({globalStop:true, taskFinished:false, safeCheckpointAvailable:true, now:'2026-09-25T07:16:00+12:00', graceUntil:'2026-09-25T07:15:00+12:00'}).action,'SAFE_CHECKPOINT_AND_INTERRUPT');
});

test('lock release is a finally invariant', () => {
  assert.equal(finalizeRun({state:'NEEDS_HUMAN',lockReleased:false}).lockReleased,true);
  assert.equal(finalizeRun({state:'PR_OPEN',lockReleased:false}).lockReleased,true);
});

test('morning report and eval derive from execution records', () => {
  const runs=[{runId:'r1',issue:101,state:'PR_OPEN',pr:88,ci:'PASS',costUsd:null,attempts:1,model:'copilot',runtimeSeconds:300,validationResult:'PASS'}];
  const report=buildMorningReport(runs);
  assert.equal(report.totals.tasks,1);
  assert.equal(report.totals.knownCostUsd,0);
  assert.equal(report.totals.unknownCostCount,1);
  assert.equal(report.tasks[0].costUsd,null);
  const evalRecord=toEvalRecord(runs[0],{outcome:'ACCEPT',repairMinutes:0,mergeStatus:'UNMERGED'});
  assert.equal(evalRecord.humanOutcome,'ACCEPT');
  assert.equal(evalRecord.modelEscalation,false);
});

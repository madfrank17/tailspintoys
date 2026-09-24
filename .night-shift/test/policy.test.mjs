import test from 'node:test';
import assert from 'node:assert/strict';
import policy from '../policy.json' with { type: 'json' };
import { evaluatePreflight, decideAfterFailure, validateScope, decideValidation, interruptionDecision, finalizeRun, buildTaskSummary, buildMorningReport, toEvalRecord } from '../lib/policy.mjs';

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

test('retry policy is bounded and fails closed without cost telemetry', () => {
  const common={ attempts:0, config:policy, spending:{taskSpentUsd:1}, global:{...global, nightlySpentUsd:1} };
  assert.equal(decideAfterFailure({...common, failure:{kind:'TRANSIENT'}}).action,'RETRY_SAME_MODEL');
  assert.equal(decideAfterFailure({...common, failure:{kind:'CAPABILITY'}}).action,'NEEDS_HUMAN');
  assert.equal(decideAfterFailure({...common, failure:{kind:'AMBIGUOUS_REQUIREMENT'}}).action,'NEEDS_HUMAN');
  assert.equal(decideAfterFailure({...common, attempts:2, failure:{kind:'TRANSIENT'}}).reason,'MAX_ATTEMPTS');
  assert.equal(decideAfterFailure({...common, spending:{taskSpentUsd:null}, failure:{kind:'TRANSIENT'}}).reason,'TASK_COST_UNKNOWN');
});

test('scope gate enforces declared blast radius', () => {
  const scope={allowedPaths:['.night-shift/x-test/pass.md'],maxChangedFiles:1,maxDiffLines:10,dependencyChanges:false};
  assert.equal(validateScope({changedFiles:['.night-shift/x-test/pass.md'],diffLines:2,scope}).state,'PASS');
  assert.equal(validateScope({changedFiles:['src/out-of-scope.txt'],diffLines:2,scope}).state,'SCOPE_BLOCK');
  assert.equal(validateScope({changedFiles:['.night-shift/x-test/pass.md','package.json'],diffLines:3,scope}).state,'SCOPE_BLOCK');
});

test('functional security and scope gates fail early before PR', () => {
  const passScope={pass:true};
  assert.deepEqual(decideValidation({functionalPass:true,secretScanPass:true,scopeResult:passScope}),{action:'PR_ALLOWED',state:'PASS'});
  assert.equal(decideValidation({functionalPass:false,secretScanPass:true,scopeResult:passScope}).state,'FUNCTIONAL_BLOCK');
  assert.equal(decideValidation({functionalPass:true,secretScanPass:false,scopeResult:passScope}).state,'SECURITY_BLOCK');
  assert.equal(decideValidation({functionalPass:true,secretScanPass:true,scopeResult:{pass:false}}).state,'SCOPE_BLOCK');
});

test('global stop gives grace then preserves safe state without forced commit', () => {
  assert.equal(interruptionDecision({globalStop:true, taskFinished:false, safeCheckpointAvailable:false, now:'2026-09-25T07:05:00+12:00', graceUntil:'2026-09-25T07:15:00+12:00'}).action,'GRACE_PERIOD');
  assert.equal(interruptionDecision({globalStop:true, taskFinished:false, safeCheckpointAvailable:false, now:'2026-09-25T07:16:00+12:00', graceUntil:'2026-09-25T07:15:00+12:00'}).action,'PRESERVE_ARTIFACTS_AND_INTERRUPT');
});

test('lock release is a finally invariant', () => {
  assert.equal(finalizeRun({state:'NEEDS_HUMAN',lockReleased:false}).lockReleased,true);
  assert.equal(finalizeRun({state:'PR_OPEN',lockReleased:false}).lockReleased,true);
});

test('task and morning summaries preserve evidence gaps', () => {
  const run={runId:'r1',issue:101,state:'PR_OPEN',pr:88,baseSha:'abc',costUsd:null,attempts:1,model:'copilot',runtimeSeconds:300,validationResult:'PASS',validation:{scope:'PASS'},changedFiles:['a.ts']};
  assert.equal(buildTaskSummary(run).costUsd,null);
  const report=buildMorningReport([run]);
  assert.equal(report.totals.tasks,1);
  assert.equal(report.totals.unknownCostCount,1);
  const evalRecord=toEvalRecord(run,{outcome:'ACCEPT',repairMinutes:0,mergeStatus:'UNMERGED'});
  assert.equal(evalRecord.humanOutcome,'ACCEPT');
  assert.equal(evalRecord.modelEscalation,false);
});

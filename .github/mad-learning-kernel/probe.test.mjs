import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decide,processEvent,parse,render,adapt,repo} from './probe.mjs';
const event={project_id:`github:${repo}`,task_id:'pr:23',new_empirical_evidence:true,evidence_fingerprint:'a',evidence_refs:['run','sha']};
const now=Date.parse('2026-09-30T00:00:00Z');
test('routine never accesses marker store',async()=>assert.equal((await processEvent({}, {list(){throw Error('unexpected');}},now)).decision,'ROUTINE'));
test('candidate hard guard and serialized cross-run cooldown',()=>{const r=decide(event,null,now);assert.equal(r.record.Capability,'UNKNOWN');assert.equal(r.record['New Ability'],'UNVERIFIED');const state=parse(render(r));assert.equal(decide({...event,evidence_fingerprint:'b'},state,now+1).decision,'COOLDOWN');assert.equal(decide(event,state,now+1).decision,'DUPLICATE');assert.equal(decide({...event,evidence_fingerprint:'b',external_outcome:true},state,now+1).decision,'CANDIDATE');assert.equal(decide({...event,evidence_fingerprint:'b'},state,now+86400000).decision,'CANDIDATE');});
test('single marker creation and update',async()=>{let comments=[];const store={list:async()=>comments,trusted:()=>true,write:async(id,body)=>{comments=[{id:id??1,body}];}};await processEvent(event,store,now);assert.equal((await processEvent({...event,evidence_fingerprint:'b'},store,now+1)).decision,'COOLDOWN');await processEvent({...event,evidence_fingerprint:'b',external_outcome:true},store,now+1);assert.equal(comments.length,1);assert.equal(comments[0].id,1);});
test('reject duplicate or untrusted markers',async()=>{const body=render(decide(event,null,now));await assert.rejects(processEvent(event,{list:async()=>[{body},{body}]},now));await assert.rejects(processEvent(event,{list:async()=>[{body}],trusted:()=>false},now));});
test('owner, run and SHA validation',()=>{const pr={number:23,user:{login:'madfrank17'},state:'open',head:{sha:'a',repo:{full_name:repo}},base:{repo:{full_name:repo}}};const run={id:1,name:'Run tests',path:'.github/workflows/run-tests.yml',status:'completed',conclusion:'success',head_sha:'a',repository:{full_name:repo},head_repository:{full_name:repo},pull_requests:[{number:23}],html_url:'run'};assert.equal(adapt(run,pr).new_empirical_evidence,true);assert.throws(()=>adapt({...run,head_sha:'b'},pr));assert.throws(()=>adapt(run,{...pr,user:{login:'other'}}));assert.throws(()=>adapt({...run,conclusion:'cancelled'},pr));});

// Exercise the runner boundary: ineligible events must never access PRs or markers.
import runPreview from './run.mjs';
test('workflow_run without exactly one PR succeeds without PR or marker access',async()=>{
  for(const pull_requests of [[],[{number:23},{number:24}]]) {
    const logs=[];let summary;
    const core={info:message=>logs.push(JSON.parse(message)),summary:{addCodeBlock:body=>{summary=JSON.parse(body);return {write:async()=>{}};}}};
    const github={rest:{actions:{getWorkflowRun:async()=>({data:{pull_requests}})},pulls:{get:()=>{throw Error('Unexpected PR access');}}},paginate:()=>{throw Error('Unexpected marker access');}};
    await runPreview({github,context:{repo:{owner:'madfrank17',repo:'tailspintoys'},eventName:'workflow_run',payload:{workflow_run:{id:1}}},core});
    assert.equal(logs[0].decision,'INELIGIBLE');
    assert.equal(logs[0].marker_written,false);
    assert.deepEqual(summary,logs[0]);
  }
});
test('PR-linked runner preserves candidate and SHA guard',async()=>{
  const pr={number:23,user:{login:'madfrank17'},state:'open',head:{sha:'a',repo:{full_name:repo}},base:{repo:{full_name:repo}}};
  const producer={id:1,name:'Run tests',path:'.github/workflows/run-tests.yml',status:'completed',conclusion:'success',head_sha:'a',repository:{full_name:repo},head_repository:{full_name:repo},pull_requests:[{number:23}],html_url:'run'};
  const logs=[];
  const github={rest:{actions:{getWorkflowRun:async()=>({data:producer})},pulls:{get:async()=>({data:pr})},issues:{listComments(){}}},paginate:async()=>[]};
  const core={info:message=>logs.push(JSON.parse(message)),warning(){},summary:{addCodeBlock:()=>({write:async()=>{}})}};
  const context={repo:{owner:'madfrank17',repo:'tailspintoys'},eventName:'workflow_run',payload:{workflow_run:{id:1}}};
  await runPreview({github,context,core});
  assert.equal(logs[0].decision,'CANDIDATE');
  assert.equal(logs[0].record.Capability,'UNKNOWN');
  assert.equal(logs[0].record['New Ability'],'UNVERIFIED');
  assert.equal(logs[0].marker_written,false);
  producer.head_sha='b';
  await assert.rejects(runPreview({github,context,core}),/Run identity\/result\/head SHA guard/);
});

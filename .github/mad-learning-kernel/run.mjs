import {adapt,processEvent} from './probe.mjs';
export default async function run({github,context,core}) {
  const owner='madfrank17',repo='tailspintoys';
  if(context.repo.owner!==owner || context.repo.repo!==repo) throw Error('Repository guard');
  if(context.eventName==='workflow_dispatch' && context.payload.inputs.mode==='routine') {core.info(JSON.stringify({decision:'ROUTINE',marker_written:false}));return;}
  const id=context.eventName==='workflow_run'?context.payload.workflow_run.id:Number(context.payload.inputs.run_id);
  if(!Number.isSafeInteger(id)||id<=0) throw Error('Valid run ID required');
  const {data:run}=await github.rest.actions.getWorkflowRun({owner,repo,run_id:id});
  if(run.pull_requests.length!==1) {
    if(context.eventName!=='workflow_run') throw Error('Exactly one linked PR required');
    const result={decision:'INELIGIBLE',reason:'Exactly one linked PR required',marker_written:false,mode:'READ_ONLY_PREVIEW'};
    core.info(JSON.stringify(result));
    await core.summary.addCodeBlock(JSON.stringify(result,null,2),'json').write();
    return;
  }
  const issue_number=run.pull_requests[0].number;
  const {data:pr}=await github.rest.pulls.get({owner,repo,pull_number:issue_number});
  const event=adapt(run,pr);
  const result=await processEvent(event,{
    list:()=>github.paginate(github.rest.issues.listComments,{owner,repo,issue_number,per_page:100}),
    trusted:c=>c.user.login==='github-actions[bot]',
    // No write permission is granted. Do not pretend this preview persisted state.
    write:async()=>core.warning('MARKER_WRITE_BLOCKED: existing token permissions are read-only; candidate is preview only')
  });
  core.info(JSON.stringify({...result,marker_written:false,mode:'READ_ONLY_PREVIEW'}));
  await core.summary.addCodeBlock(JSON.stringify({...result,marker_written:false},null,2),'json').write();
}

const terminalRunStates = new Set(["PR_OPEN", "NEEDS_HUMAN", "REJECTED", "COMPLETED"]);

export function evaluateGlobalStop({ now, deadlineAt, nightlySpentUsd, nightlyBudgetUsd, circuitOpen }) {
  if (circuitOpen) return { stop: true, reason: "CIRCUIT_BREAKER" };
  if (Number(nightlySpentUsd) >= Number(nightlyBudgetUsd)) return { stop: true, reason: "NIGHTLY_BUDGET" };
  if (new Date(now).getTime() >= new Date(deadlineAt).getTime()) return { stop: true, reason: "DEADLINE" };
  return { stop: false, reason: null };
}

export function evaluatePreflight({ issue, labelActor, config, existing, global, lock }) {
  if (!issue?.labels?.includes(config.requiredLabel)) return { state: "REJECT", reason: "MISSING_LABEL" };
  if (!config.authorizedLabelActors.includes(labelActor)) return { state: "REJECT", reason: "UNAUTHORIZED_LABEL_ACTOR" };

  const stop = evaluateGlobalStop({ ...global, nightlyBudgetUsd: config.nightlyBudgetUsd });
  if (stop.stop) return { state: "GLOBAL_STOP", reason: stop.reason };

  if (existing?.openPr) return { state: "SKIP_DUPLICATE", reason: "OPEN_PR_EXISTS", pr: existing.openPr };
  if (existing?.run && !terminalRunStates.has(existing.run.state)) return { state: "RESUME", reason: "NONTERMINAL_RUN_EXISTS", runId: existing.run.id };
  if (existing?.branch) return { state: "SKIP_DUPLICATE", reason: "BRANCH_EXISTS", branch: existing.branch };

  if (lock?.held && !lock?.expired) return { state: "WAIT", reason: "LOCK_HELD", lockOwner: lock.owner };

  return { state: "QUEUE", reason: "AUTHORIZED" };
}

export function classifyFailure(failure) {
  const kind = failure?.kind;
  if (["TRANSIENT", "CAPABILITY", "AMBIGUOUS_REQUIREMENT", "ENVIRONMENT"].includes(kind)) return kind;
  return "ENVIRONMENT";
}

function retryBudgetAvailable({ attempts, maxAttempts, taskSpentUsd, taskBudgetUsd, nightlySpentUsd, nightlyBudgetUsd, now, deadlineAt, circuitOpen }) {
  if (attempts >= maxAttempts) return { ok: false, reason: "MAX_ATTEMPTS" };
  if (Number(taskSpentUsd) >= Number(taskBudgetUsd)) return { ok: false, reason: "TASK_BUDGET" };
  const stop = evaluateGlobalStop({ now, deadlineAt, nightlySpentUsd, nightlyBudgetUsd, circuitOpen });
  if (stop.stop) return { ok: false, reason: stop.reason };
  return { ok: true, reason: null };
}

export function decideAfterFailure({ failure, attempts, config, spending, global }) {
  const classification = classifyFailure(failure);
  if (classification === "AMBIGUOUS_REQUIREMENT" || classification === "ENVIRONMENT") {
    return { action: "NEEDS_HUMAN", classification, reason: classification };
  }

  const budget = retryBudgetAvailable({
    attempts,
    maxAttempts: config.maxAttempts,
    taskSpentUsd: spending.taskSpentUsd,
    taskBudgetUsd: config.perTaskBudgetUsd,
    nightlySpentUsd: global.nightlySpentUsd,
    nightlyBudgetUsd: config.nightlyBudgetUsd,
    now: global.now,
    deadlineAt: global.deadlineAt,
    circuitOpen: global.circuitOpen,
  });
  if (!budget.ok) return { action: "NEEDS_HUMAN", classification, reason: budget.reason };

  if (classification === "TRANSIENT") return { action: "RETRY_SAME_MODEL", classification, reason: "TRANSIENT_RETRY" };
  if (classification === "CAPABILITY") {
    return config.modelEscalationEnabled
      ? { action: "ESCALATE_MODEL", classification, reason: "CAPABILITY_ESCALATION" }
      : { action: "NEEDS_HUMAN", classification, reason: "MODEL_ESCALATION_DISABLED" };
  }

  return { action: "NEEDS_HUMAN", classification, reason: "UNCLASSIFIED" };
}

export function interruptionDecision({ globalStop, taskFinished, safeCheckpointAvailable, now, graceUntil }) {
  if (!globalStop) return { action: "CONTINUE" };
  if (taskFinished) return { action: "NORMAL_STOP" };
  if (new Date(now).getTime() < new Date(graceUntil).getTime()) return { action: "GRACE_PERIOD" };
  if (safeCheckpointAvailable) return { action: "SAFE_CHECKPOINT_AND_INTERRUPT" };
  return { action: "PRESERVE_ARTIFACTS_AND_INTERRUPT" };
}

export function finalizeRun(run) {
  return { ...run, lockReleased: true, finalized: true };
}

export function buildMorningReport(runs) {
  const totals = runs.reduce((acc, run) => {
    acc.tasks += 1;
    acc.attempts += Number(run.attempts || 0);
    if (run.costUsd == null) acc.unknownCostCount += 1;
    else acc.knownCostUsd += Number(run.costUsd);
    return acc;
  }, { tasks: 0, knownCostUsd: 0, unknownCostCount: 0, attempts: 0 });

  return {
    generatedFromExecutionRecords: true,
    totals: { ...totals, knownCostUsd: Number(totals.knownCostUsd.toFixed(2)) },
    tasks: runs.map(run => ({
      issue: run.issue,
      state: run.state,
      pr: run.pr || null,
      ci: run.ci || null,
      costUsd: run.costUsd == null ? null : Number(run.costUsd),
      attempts: Number(run.attempts || 0),
      failureReason: run.failureReason || null,
    })),
  };
}

export function toEvalRecord(run, human = {}) {
  return {
    runId: run.runId,
    issue: run.issue,
    taskType: "CODE",
    model: run.model,
    attemptCount: run.attempts,
    failureClass: run.failureClass || null,
    retryCount: Math.max(0, Number(run.attempts || 0) - 1),
    modelEscalation: false,
    runtimeSeconds: run.runtimeSeconds,
    costUsd: run.costUsd,
    validationResult: run.validationResult,
    finalExecutionState: run.state,
    humanOutcome: human.outcome || null,
    repairMinutes: human.repairMinutes ?? null,
    mergeStatus: human.mergeStatus || "UNMERGED"
  };
}

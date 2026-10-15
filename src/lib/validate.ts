/* ------------------------------------------------------------------ */
/*  VALIDACIÓN DE INPUTS DE LA API                                     */
/*  Capa que sanitiza y valida antes de llegar al motor.               */
/*  Convierte params crudos en structs tipados y seguros.              */
/* ------------------------------------------------------------------ */

import { requireId, requireOneOf, requireParam, OperationalError } from "./errors";

/** Params validados para decide_approval */
export type DecideApprovalInput = {
  approvalId: number;
  decision: "approved" | "rejected";
  actor: string;
  reason?: string;
};

export function validateDecideApproval(p: Record<string, unknown>, defaultActor: string): DecideApprovalInput {
  return {
    approvalId: requireId("approvalId", p.approvalId),
    decision: requireOneOf("decision", p.decision, ["approved", "rejected"]),
    actor: typeof p.actor === "string" && p.actor.trim() ? p.actor.trim() : defaultActor,
    reason: typeof p.reason === "string" && p.reason.trim() ? p.reason.trim() : undefined,
  };
}

/** Params validados para task */
export type TaskActionInput = {
  taskId: number;
  op: "accept" | "start" | "finish" | "block" | "unblock" | "cancel";
  actor: string;
  reason?: string;
};

export function validateTaskAction(p: Record<string, unknown>, defaultActor: string): TaskActionInput {
  return {
    taskId: requireId("taskId", p.taskId),
    op: requireOneOf("taskOp", p.taskOp, ["accept", "start", "finish", "block", "unblock", "cancel"]),
    actor: typeof p.actor === "string" && p.actor.trim() ? p.actor.trim() : defaultActor,
    reason: typeof p.reason === "string" && p.reason.trim() ? p.reason.trim() : undefined,
  };
}

/** Params validados para bed */
export type BedActionInput = {
  bedId: number;
  op: "propose_discharge" | "reserve" | "release" | "block" | "out_of_service" | "reincorporate" | "reconfirm" | "mark_unknown" | "mark_available";
  actor: string;
  reason?: string;
};

const BED_OPS = [
  "propose_discharge", "reserve", "release", "block", "out_of_service",
  "reincorporate", "reconfirm", "mark_unknown", "mark_available",
] as const;

export function validateBedAction(p: Record<string, unknown>, defaultActor: string): BedActionInput {
  return {
    bedId: requireId("bedId", p.bedId),
    op: requireOneOf("bedOp", p.bedOp, [...BED_OPS]),
    actor: typeof p.actor === "string" && p.actor.trim() ? p.actor.trim() : defaultActor,
    reason: typeof p.reason === "string" && p.reason.trim() ? p.reason.trim() : undefined,
  };
}

/** Params validados para resolve_conflict */
export type ResolveConflictInput = {
  conflictId: number;
  winner: "A" | "B";
  apply: boolean;
  criterion: string;
  actor: string;
};

export function validateResolveConflict(p: Record<string, unknown>, defaultActor: string): ResolveConflictInput {
  const criterion = typeof p.criterion === "string" ? p.criterion.trim() : "";
  if (!criterion) {
    throw new OperationalError("VALIDATION_ERROR", "El criterio de resolución es obligatorio — queda guardado para aprender y capacitar.");
  }
  return {
    conflictId: requireId("conflictId", p.conflictId),
    winner: requireOneOf("winner", p.winner, ["A", "B"]),
    apply: p.apply !== false,
    criterion,
    actor: typeof p.actor === "string" && p.actor.trim() ? p.actor.trim() : defaultActor,
  };
}

/** Params validados para draft_reply */
export type DraftReplyInput = {
  messageId: number;
  actor: string;
};

export function validateDraftReply(p: Record<string, unknown>, defaultActor: string): DraftReplyInput {
  return {
    messageId: requireId("messageId", p.messageId),
    actor: typeof p.actor === "string" && p.actor.trim() ? p.actor.trim() : defaultActor,
  };
}

/** Params validados para save_setting */
export type SaveSettingInput = {
  key: string;
  value: string;
  actor: string;
};

export function validateSaveSetting(p: Record<string, unknown>, defaultActor: string): SaveSettingInput {
  requireParam("key", p.key);
  requireParam("value", p.value);
  return {
    key: String(p.key).trim(),
    value: String(p.value).trim(),
    actor: typeof p.actor === "string" && p.actor.trim() ? p.actor.trim() : defaultActor,
  };
}

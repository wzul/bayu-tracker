import { db } from "./db";

interface AuditData {
  action: string;
  actorId?: string;
  actorType: string;
  targetId?: string;
  details?: any;
}

export async function logAudit(data: AuditData) {
  try {
    await db.auditLog.create({
      data: {
        action: data.action,
        actorId: data.actorId ?? null,
        actorType: data.actorType,
        targetId: data.targetId ?? null,
        details: data.details ?? null,
      },
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}

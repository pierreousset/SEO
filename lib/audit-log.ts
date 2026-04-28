import { randomUUID } from "node:crypto";
import { db, schema } from "@/db/client";

export async function logAction(opts: {
  userId: string;
  actorId: string;
  action: string;
  detail?: Record<string, unknown>;
}) {
  await db.insert(schema.auditLog).values({
    id: randomUUID(),
    userId: opts.userId,
    actorId: opts.actorId,
    action: opts.action,
    detail: opts.detail ? JSON.stringify(opts.detail) : null,
    createdAt: new Date(),
  });
}

import { PrismaClient } from "@prisma/client";

// Build-time safe: if DATABASE_URL is missing, create a no-op proxy so
// `npm run build` doesn't crash during static analysis of API routes.
// At runtime (Dokploy container), DATABASE_URL is injected via compose env.

const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || !process.env.DATABASE_URL;

function createNoOpPrisma(): PrismaClient {
  return new Proxy({} as any, {
    get(_target, prop) {
      if (prop === '$connect' || prop === '$disconnect') {
        return async () => {};
      }
      return () => Promise.resolve(null);
    },
  }) as unknown as PrismaClient;
}

const globalForPrisma = global as unknown as { db?: PrismaClient };

export const db = globalForPrisma.db ?? (isBuildPhase ? createNoOpPrisma() : new PrismaClient());

if (!isBuildPhase && process.env.NODE_ENV !== "production") globalForPrisma.db = db;

import { prisma } from '@repo/db';
export class AuditService {
    /**
     * Logs an admin action with before/after snapshots.
     */
    static async log(params) {
        // Structured metadata for snapshots
        const logMetadata = {
            ...(params.before && { before: params.before }),
            ...(params.after && { after: params.after }),
            ...(params.metadata && { ...params.metadata }),
        };
        return await prisma.auditLog.create({
            data: {
                userId: params.adminId,
                action: params.action,
                entity: params.entity,
                entityId: params.entityId,
                metadata: logMetadata,
                ipAddress: params.ipAddress,
                userAgent: params.userAgent,
            }
        });
    }
}

import { adminAuditContract } from '@repo/types';
import { implement } from '@orpc/server';
import { prisma } from '@repo/db';
import { handlePrismaError } from '../../utils/errors';
import { CSVExport } from '../../lib/csvExport';
export const auditRouter = implement(adminAuditContract).router({
    list: implement(adminAuditContract.list).handler(async ({ input }) => {
        try {
            const { page, limit } = input;
            const skip = (page - 1) * limit;
            const [logs, total] = await Promise.all([
                prisma.auditLog.findMany({
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: { user: { select: { email: true } } }
                }),
                prisma.auditLog.count()
            ]);
            return {
                data: logs,
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    }),
    export: implement(adminAuditContract.export).handler(async () => {
        try {
            const logs = await prisma.auditLog.findMany();
            const csv = CSVExport.formatAuditLogs(logs);
            return { csv };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    })
});

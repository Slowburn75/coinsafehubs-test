import { adminTicketsContract } from '@repo/types';
import { implement } from '@orpc/server';
import { prisma } from '@repo/db';
import { AppError, handlePrismaError } from '../../utils/errors';
import { AuditService } from '../../lib/auditService';
export const ticketsRouter = implement(adminTicketsContract).router({
    list: implement(adminTicketsContract.list).handler(async ({ input }) => {
        try {
            const { page, limit, status, priority } = input;
            const skip = (page - 1) * limit;
            const where = {
                ...(status && { status }),
                ...(priority && { priority }),
            };
            const [tickets, total] = await Promise.all([
                prisma.supportTicket.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { updatedAt: 'desc' },
                    include: {
                        user: { select: { email: true } },
                        assignee: { select: { email: true } },
                        replies: { take: 10, orderBy: { createdAt: 'desc' } }
                    }
                }),
                prisma.supportTicket.count({ where })
            ]);
            return {
                data: tickets,
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
    reply: implement(adminTicketsContract.reply).handler(async ({ input, context }) => {
        try {
            const admin = context.user;
            const ticket = await prisma.supportTicket.findUnique({ where: { id: input.ticketId } });
            if (!ticket)
                throw new AppError('Ticket not found', 'NOT_FOUND', 404);
            await prisma.ticketReply.create({
                data: {
                    ticketId: input.ticketId,
                    authorId: admin.id,
                    message: input.message,
                    isInternal: input.isInternal,
                }
            });
            await prisma.supportTicket.update({
                where: { id: input.ticketId },
                data: { updatedAt: new Date() }
            });
            await AuditService.log({
                adminId: admin.id,
                action: 'REPLY_TICKET',
                entity: 'ticket',
                entityId: input.ticketId,
                metadata: { isInternal: input.isInternal }
            });
            return { success: true };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    }),
    updateStatus: implement(adminTicketsContract.updateStatus).handler(async ({ input, context }) => {
        try {
            const admin = context.user;
            await prisma.supportTicket.update({
                where: { id: input.ticketId },
                data: { status: input.status }
            });
            await AuditService.log({
                adminId: admin.id,
                action: 'UPDATE_TICKET_STATUS',
                entity: 'ticket',
                entityId: input.ticketId,
                after: { status: input.status }
            });
            return { success: true };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    }),
    assign: implement(adminTicketsContract.assign).handler(async ({ input, context }) => {
        try {
            const admin = context.user;
            await prisma.supportTicket.update({
                where: { id: input.ticketId },
                data: { assignedTo: input.adminId }
            });
            await AuditService.log({
                adminId: admin.id,
                action: 'ASSIGN_TICKET',
                entity: 'ticket',
                entityId: input.ticketId,
                after: { assignedTo: input.adminId }
            });
            return { success: true };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    }),
    updatePriority: implement(adminTicketsContract.updatePriority).handler(async ({ input, context }) => {
        try {
            const admin = context.user;
            await prisma.supportTicket.update({
                where: { id: input.ticketId },
                data: { priority: input.priority }
            });
            await AuditService.log({
                adminId: admin.id,
                action: 'UPDATE_TICKET_PRIORITY',
                entity: 'ticket',
                entityId: input.ticketId,
                after: { priority: input.priority }
            });
            return { success: true };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    })
});

import { adminTicketsContract } from '@repo/types'
import { implement } from '@orpc/server'
import { prisma } from '@repo/db'
import { AppError, handlePrismaError } from '../../utils/errors'

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
                    include: { user: { select: { email: true, fullName: true } } }
                }),
                prisma.supportTicket.count({ where })
            ]);

            return {
                data: tickets as any,
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            };
        } catch (error) {
            throw handlePrismaError(error);
        }
    }),

    reply: implement(adminTicketsContract.reply).handler(async ({ input, context }) => {
        try {
            const admin = (context as any).user;

            await prisma.ticketReply.create({
                data: {
                    ticketId: input.ticketId,
                    authorId: admin.id,
                    message: input.message,
                    isInternal: input.isInternal ?? false
                }
            });

            await prisma.supportTicket.update({
                where: { id: input.ticketId },
                data: { updatedAt: new Date() }
            });

            return { success: true };
        } catch (error) {
            throw handlePrismaError(error);
        }
    }),

    updateStatus: implement(adminTicketsContract.updateStatus).handler(async ({ input }) => {
        try {
            await prisma.supportTicket.update({
                where: { id: input.ticketId },
                data: { status: input.status }
            });
            return { success: true };
        } catch (error) {
            throw handlePrismaError(error);
        }
    }),

    assign: implement(adminTicketsContract.assign).handler(async ({ input }) => {
        try {
            await prisma.supportTicket.update({
                where: { id: input.ticketId },
                data: { assignedTo: input.adminId }
            });
            return { success: true };
        } catch (error) {
            throw handlePrismaError(error);
        }
    }),

    updatePriority: implement(adminTicketsContract.updatePriority).handler(async ({ input }) => {
        try {
            await prisma.supportTicket.update({
                where: { id: input.ticketId },
                data: { priority: input.priority }
            });
            return { success: true };
        } catch (error) {
            throw handlePrismaError(error);
        }
    }),
})

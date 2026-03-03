import { supportContract } from '@repo/types';
import { implement } from '@orpc/server';
import { prisma } from '@repo/db';
import { AppError, handlePrismaError } from '../utils/errors';
export const supportRouter = implement(supportContract).router({
    createTicket: implement(supportContract.createTicket).handler(async ({ input, context }) => {
        try {
            const user = context?.user;
            if (!user)
                throw new AppError('Unauthorized', 'UNAUTHORIZED', 401);
            await prisma.supportTicket.create({
                data: {
                    userId: user.id,
                    subject: input.subject,
                    message: input.message,
                }
            });
            return { success: true };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    }),
    listTickets: implement(supportContract.listTickets).handler(async ({ context }) => {
        try {
            const user = context?.user;
            if (!user)
                throw new AppError('Unauthorized', 'UNAUTHORIZED', 401);
            const tickets = await prisma.supportTicket.findMany({
                where: user.role === 'ADMIN' ? undefined : { userId: user.id },
                orderBy: { createdAt: 'desc' }
            });
            return { tickets: tickets };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    }),
    updateTicket: implement(supportContract.updateTicket).handler(async ({ input, context }) => {
        try {
            const user = context?.user;
            if (!user || user.role !== 'ADMIN')
                throw new AppError('Forbidden', 'FORBIDDEN', 403);
            const existing = await prisma.supportTicket.findUnique({ where: { id: input.ticketId } });
            if (!existing)
                throw new AppError('Ticket not found.', 'NOT_FOUND', 404);
            await prisma.supportTicket.update({
                where: { id: input.ticketId },
                data: { status: input.status }
            });
            return { success: true };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    })
});

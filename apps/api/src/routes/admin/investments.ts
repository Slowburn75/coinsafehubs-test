import { adminInvestmentsContract } from '@repo/types'
import { implement } from '@orpc/server'
import { prisma } from '@repo/db'
import { handlePrismaError, AppError } from '../../utils/errors'
import { InvestmentStatus } from '@repo/db'

export const investmentsRouter = implement(adminInvestmentsContract).router({
    list: implement(adminInvestmentsContract.list).handler(async ({ input }) => {
        try {
            const { page, limit, status } = input;
            const skip = (page - 1) * limit;

            const where = {
                ...(status && { status }),
            };

            const [investments, total] = await Promise.all([
                prisma.investment.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        user: { select: { email: true, fullName: true } },
                        plan: true
                    }
                }),
                prisma.investment.count({ where })
            ]);

            return {
                data: investments as any,
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            };
        } catch (error) {
            throw handlePrismaError(error);
        }
    }),

    complete: implement(adminInvestmentsContract.complete).handler(async ({ input }) => {
        try {
            await prisma.investment.update({
                where: { id: input.investmentId },
                data: { status: InvestmentStatus.COMPLETED }
            });
            return { success: true };
        } catch (error) {
            throw handlePrismaError(error);
        }
    }),

    cancel: implement(adminInvestmentsContract.cancel).handler(async ({ input }) => {
        try {
            await prisma.investment.update({
                where: { id: input.investmentId },
                data: { status: InvestmentStatus.CANCELLED }
            });
            return { success: true };
        } catch (error) {
            throw handlePrismaError(error);
        }
    }),

    pause: implement(adminInvestmentsContract.pause).handler(async ({ input }) => {
        try {
            await prisma.investment.update({
                where: { id: input.investmentId },
                data: { isPaused: input.pause }
            });
            return { success: true };
        } catch (error) {
            throw handlePrismaError(error);
        }
    }),

    adjustRoi: implement(adminInvestmentsContract.adjustRoi).handler(async ({ input }) => {
        try {
            await prisma.investment.update({
                where: { id: input.investmentId },
                data: { roi: input.newRoi }
            });
            return { success: true };
        } catch (error) {
            throw handlePrismaError(error);
        }
    })
})

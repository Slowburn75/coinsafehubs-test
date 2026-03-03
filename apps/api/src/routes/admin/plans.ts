import { adminPlansContract } from '@repo/types'
import { implement } from '@orpc/server'
import { prisma } from '@repo/db'
import { handlePrismaError, AppError } from '../../utils/errors'

export const plansRouter = implement(adminPlansContract).router({
    list: implement(adminPlansContract.list).handler(async () => {
        try {
            const plans = await prisma.investmentPlan.findMany({
                where: { isArchived: false },
                orderBy: { displayOrder: 'asc' }
            });
            return { plans: plans as any };
        } catch (error) {
            throw handlePrismaError(error);
        }
    }),

    create: implement(adminPlansContract.create).handler(async ({ input }) => {
        try {
            const plan = await prisma.investmentPlan.create({
                data: {
                    name: input.name,
                    description: input.description,
                    minimumAmount: input.minimumAmount,
                    maximumAmount: input.maximumAmount,
                    roiPercent: input.roiPercent,
                    durationDays: input.durationDays,
                    riskLevel: input.riskLevel,
                    isActive: input.isActive,
                    isFeatured: input.isFeatured,
                    isArchived: input.isArchived,
                    displayOrder: input.displayOrder,
                }
            });
            return { plan: plan as any };
        } catch (error) {
            throw handlePrismaError(error);
        }
    }),

    update: implement(adminPlansContract.update).handler(async ({ input }) => {
        try {
            const plan = await prisma.investmentPlan.update({
                where: { id: input.id },
                data: input.data
            });
            return { plan: plan as any };
        } catch (error) {
            throw handlePrismaError(error);
        }
    }),

    toggleActive: implement(adminPlansContract.toggleActive).handler(async ({ input }) => {
        try {
            await prisma.investmentPlan.update({
                where: { id: input.id },
                data: { isActive: input.active }
            });
            return { success: true };
        } catch (error) {
            throw handlePrismaError(error);
        }
    }),

    delete: implement(adminPlansContract.delete).handler(async ({ input }) => {
        try {
            await prisma.investmentPlan.update({
                where: { id: input.id },
                data: { isArchived: true, isActive: false }
            });
            return { success: true };
        } catch (error) {
            throw handlePrismaError(error);
        }
    }),
})

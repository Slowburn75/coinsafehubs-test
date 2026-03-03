import { adminPlansContract } from '@repo/types';
import { implement } from '@orpc/server';
import { prisma } from '@repo/db';
import { AppError, handlePrismaError } from '../../utils/errors';
import { AuditService } from '../../lib/auditService';
export const plansRouter = implement(adminPlansContract).router({
    list: implement(adminPlansContract.list).handler(async () => {
        try {
            const plans = await prisma.investmentPlan.findMany({
                orderBy: { displayOrder: 'asc' }
            });
            return { plans: plans };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    }),
    create: implement(adminPlansContract.create).handler(async ({ input, context }) => {
        try {
            const admin = context.user;
            const plan = await prisma.investmentPlan.create({
                data: input
            });
            await AuditService.log({
                adminId: admin.id,
                action: 'CREATE_PLAN',
                entity: 'investment_plan',
                entityId: plan.id,
                after: plan
            });
            return { plan: plan };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    }),
    update: implement(adminPlansContract.update).handler(async ({ input, context }) => {
        try {
            const admin = context.user;
            const oldPlan = await prisma.investmentPlan.findUnique({ where: { id: input.id } });
            if (!oldPlan)
                throw new AppError('Plan not found', 'NOT_FOUND', 404);
            const plan = await prisma.investmentPlan.update({
                where: { id: input.id },
                data: input.data
            });
            await AuditService.log({
                adminId: admin.id,
                action: 'UPDATE_PLAN',
                entity: 'investment_plan',
                entityId: plan.id,
                before: oldPlan,
                after: plan
            });
            return { plan: plan };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    }),
    toggleActive: implement(adminPlansContract.toggleActive).handler(async ({ input, context }) => {
        try {
            const admin = context.user;
            await prisma.investmentPlan.update({
                where: { id: input.id },
                data: { isActive: input.active }
            });
            await AuditService.log({
                adminId: admin.id,
                action: input.active ? 'ACTIVATE_PLAN' : 'DEACTIVATE_PLAN',
                entity: 'investment_plan',
                entityId: input.id
            });
            return { success: true };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    }),
    delete: implement(adminPlansContract.delete).handler(async ({ input, context }) => {
        try {
            const admin = context.user;
            const activeInvestmentsCount = await prisma.investment.count({
                where: { planId: input.id, status: 'ACTIVE' }
            });
            if (activeInvestmentsCount > 0) {
                throw new AppError('Cannot delete plan with active investments', 'BAD_REQUEST', 400);
            }
            await prisma.investmentPlan.delete({
                where: { id: input.id }
            });
            await AuditService.log({
                adminId: admin.id,
                action: 'DELETE_PLAN',
                entity: 'investment_plan',
                entityId: input.id
            });
            return { success: true };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    })
});

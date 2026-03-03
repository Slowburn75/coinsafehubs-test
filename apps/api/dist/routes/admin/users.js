import { adminUsersContract } from '@repo/types';
import { implement } from '@orpc/server';
import { prisma } from '@repo/db';
import { AppError, handlePrismaError } from '../../utils/errors';
import { BalanceService } from '../../lib/balanceService';
import { AuditService } from '../../lib/auditService';
import { CSVExport } from '../../lib/csvExport';
import { generateTemporaryPassword, hashPassword } from '../../lib/bcrypt';
export const usersRouter = implement(adminUsersContract).router({
    list: implement(adminUsersContract.list).handler(async ({ input }) => {
        try {
            const { page, limit, role, kycStatus, isActive } = input;
            const skip = (page - 1) * limit;
            const where = {
                ...(role && { role }),
                ...(kycStatus && { kycStatus }),
                ...(isActive !== undefined && { isActive }),
            };
            const [users, total] = await Promise.all([
                prisma.user.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    include: { balance: true }
                }),
                prisma.user.count({ where })
            ]);
            return {
                data: users,
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
    getProfile: implement(adminUsersContract.getProfile).handler(async ({ input }) => {
        try {
            const user = await prisma.user.findUnique({
                where: { id: input.id },
                include: {
                    balance: true,
                    investments: { include: { plan: true } },
                    transactions: true,
                    tickets: true,
                    auditLogs: { take: 10, orderBy: { createdAt: 'desc' } }
                }
            });
            if (!user)
                throw new AppError('User not found', 'NOT_FOUND', 404);
            return {
                user: user,
                investments: user.investments,
                transactions: user.transactions,
                tickets: user.tickets,
                auditLogs: user.auditLogs,
            };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    }),
    editBalance: implement(adminUsersContract.editBalance).handler(async ({ input, context }) => {
        try {
            const admin = context.user;
            await BalanceService.editBalance({
                userId: input.userId,
                newBalances: input.balances,
                adminId: admin.id,
                reason: input.reason
            });
            await AuditService.log({
                adminId: admin.id,
                action: 'EDIT_BALANCE',
                entity: 'user',
                entityId: input.userId,
                metadata: { balances: input.balances, reason: input.reason }
            });
            return { success: true };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    }),
    freeze: implement(adminUsersContract.freeze).handler(async ({ input, context }) => {
        try {
            const admin = context.user;
            if (admin.id === input.userId)
                throw new AppError('Cannot freeze your own account', 'BAD_REQUEST', 400);
            await prisma.user.update({
                where: { id: input.userId },
                data: { isActive: !input.freeze }
            });
            // Invalidate all tokens for this user
            await prisma.refreshToken.deleteMany({ where: { userId: input.userId } });
            await AuditService.log({
                adminId: admin.id,
                action: input.freeze ? 'FREEZE_ACCOUNT' : 'UNFREEZE_ACCOUNT',
                entity: 'user',
                entityId: input.userId
            });
            return { success: true };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    }),
    updateKyc: implement(adminUsersContract.updateKyc).handler(async ({ input, context }) => {
        try {
            const admin = context.user;
            await prisma.user.update({
                where: { id: input.userId },
                data: { kycStatus: input.status }
            });
            if (input.adminNote) {
                await prisma.adminNote.create({
                    data: {
                        adminId: admin.id,
                        targetType: 'user',
                        targetId: input.userId,
                        note: input.adminNote,
                    }
                });
            }
            await AuditService.log({
                adminId: admin.id,
                action: 'UPDATE_KYC',
                entity: 'user',
                entityId: input.userId,
                metadata: { status: input.status, note: input.adminNote }
            });
            return { success: true };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    }),
    updateRole: implement(adminUsersContract.updateRole).handler(async ({ input, context }) => {
        try {
            const admin = context.user;
            if (admin.id === input.userId)
                throw new AppError('Cannot demote yourself', 'BAD_REQUEST', 400);
            await prisma.user.update({
                where: { id: input.userId },
                data: { role: input.role }
            });
            await AuditService.log({
                adminId: admin.id,
                action: 'UPDATE_ROLE',
                entity: 'user',
                entityId: input.userId,
                metadata: { newRole: input.role }
            });
            return { success: true };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    }),
    delete: implement(adminUsersContract.delete).handler(async ({ input, context }) => {
        try {
            const admin = context.user;
            if (admin.id === input.userId)
                throw new AppError('Cannot delete yourself', 'BAD_REQUEST', 400);
            await prisma.user.update({
                where: { id: input.userId },
                data: { isActive: false }
            });
            await AuditService.log({
                adminId: admin.id,
                action: 'SOFT_DELETE_USER',
                entity: 'user',
                entityId: input.userId
            });
            return { success: true };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    }),
    resetPassword: implement(adminUsersContract.resetPassword).handler(async ({ input, context }) => {
        try {
            const admin = context.user;
            const tempPassword = generateTemporaryPassword();
            const hashed = await hashPassword(tempPassword);
            await prisma.user.update({
                where: { id: input.userId },
                data: { password: hashed }
            });
            await AuditService.log({
                adminId: admin.id,
                action: 'RESET_PASSWORD',
                entity: 'user',
                entityId: input.userId
            });
            return { temporaryPassword: tempPassword };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    }),
    export: implement(adminUsersContract.export).handler(async () => {
        try {
            const users = await prisma.user.findMany();
            const csv = CSVExport.formatUsers(users);
            return { csv };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    })
});

import { prisma } from '@repo/db'
import { handlePrismaError } from '../../utils/errors'
import { TransactionStatus, TransactionType, KycStatus, Role } from '@repo/db'
import { subDays } from 'date-fns'
import { adminContract } from '@repo/types'
import { implement } from '@orpc/server'

export const dashboardRouter = {
    getStats: implement(adminContract.getStats).handler(async () => {
        try {
            const thirtyDaysAgo = subDays(new Date(), 30);

            const [
                totalUsers,
                activeUsersLoginCount,
                frozenAccounts,
                pendingKycCount,
                totalDeposits,
                totalWithdrawals,
                activeInvestments,
                paidRoi,
                pendingWithdrawals,
                pendingDeposits
            ] = await Promise.all([
                prisma.user.count({ where: { role: Role.USER } }),
                prisma.auditLog.count({
                    where: {
                        action: 'LOGIN',
                        createdAt: { gte: thirtyDaysAgo }
                    },
                }),
                prisma.user.count({ where: { isActive: false } }),
                prisma.user.count({ where: { kycStatus: KycStatus.PENDING } }),
                prisma.transaction.aggregate({
                    where: { type: TransactionType.DEPOSIT, status: TransactionStatus.COMPLETED },
                    _sum: { amount: true }
                }),
                prisma.transaction.aggregate({
                    where: { type: TransactionType.WITHDRAWAL, status: TransactionStatus.COMPLETED },
                    _sum: { amount: true }
                }),
                prisma.investment.aggregate({
                    where: { status: 'ACTIVE' as any },
                    _sum: { amount: true }
                }),
                prisma.transaction.aggregate({
                    where: { type: TransactionType.INTEREST, status: TransactionStatus.COMPLETED },
                    _sum: { amount: true }
                }),
                prisma.transaction.aggregate({
                    where: { type: TransactionType.WITHDRAWAL, status: TransactionStatus.PENDING },
                    _sum: { amount: true }
                }),
                prisma.transaction.aggregate({
                    where: { type: TransactionType.DEPOSIT, status: TransactionStatus.PENDING },
                    _sum: { amount: true }
                })
            ]);

            return {
                totalUsers,
                activeUsers30d: activeUsersLoginCount,
                frozenAccounts,
                pendingKycCount,
                totalDepositsAllTime: Number(totalDeposits._sum.amount || 0),
                totalWithdrawalsAllTime: Number(totalWithdrawals._sum.amount || 0),
                activeInvestmentVolume: Number(activeInvestments._sum.amount || 0),
                totalRoiPaidOut: Number(paidRoi._sum.amount || 0),
                pendingWithdrawalTotal: Number(pendingWithdrawals._sum.amount || 0),
                pendingDepositTotal: Number(pendingDeposits._sum.amount || 0),
            };
        } catch (error) {
            throw handlePrismaError(error);
        }
    }),

    getCharts: implement(adminContract.getCharts).handler(async () => {
        try {
            return {
                dailyStats: [],
                userGrowth: []
            };
        } catch (error) {
            throw handlePrismaError(error);
        }
    })
}

import { prisma } from '@repo/db';
import { Decimal, TransactionType, TransactionSource, TransactionStatus } from '@repo/db';
import { AppError } from '../utils/errors';
export class BalanceService {
    /**
     * Credits a user's balance and creates a transaction record.
     */
    static async credit(params) {
        const amount = new Decimal(params.amount.toString());
        return await prisma.$transaction(async (tx) => {
            // 1. Update UserBalance
            const balance = await tx.userBalance.update({
                where: { userId: params.userId },
                data: {
                    available: { increment: amount }
                }
            });
            // 2. Create Transaction
            const transaction = await tx.transaction.create({
                data: {
                    userId: params.userId,
                    type: params.type,
                    amount: amount,
                    status: TransactionStatus.COMPLETED,
                    source: params.source,
                    reference: params.reference,
                    adminNote: params.adminNote,
                    metadata: params.metadata,
                }
            });
            return { balance, transaction };
        });
    }
    /**
     * Debits a user's balance and creates a transaction record.
     */
    static async debit(params) {
        const amount = new Decimal(params.amount.toString());
        return await prisma.$transaction(async (tx) => {
            // 1. Check current balance
            const currentBalance = await tx.userBalance.findUnique({
                where: { userId: params.userId }
            });
            if (!currentBalance || currentBalance.available.lt(amount)) {
                throw new AppError('Insufficient balance', 'INSUFFICIENT_BALANCE', 400);
            }
            // 2. Update UserBalance
            const balance = await tx.userBalance.update({
                where: { userId: params.userId },
                data: {
                    available: { decrement: amount }
                }
            });
            // 3. Create Transaction
            const transaction = await tx.transaction.create({
                data: {
                    userId: params.userId,
                    type: params.type,
                    amount: amount,
                    status: TransactionStatus.COMPLETED,
                    source: params.source,
                    reference: params.reference,
                    adminNote: params.adminNote,
                    metadata: params.metadata,
                }
            });
            return { balance, transaction };
        });
    }
    /**
     * Directly edits user balances (Admin only capability).
     * Computes the delta and creates a SYSTEM transaction record.
     */
    static async editBalance(params) {
        return await prisma.$transaction(async (tx) => {
            const oldBalance = await tx.userBalance.findUnique({
                where: { userId: params.userId }
            });
            if (!oldBalance)
                throw new AppError('User balance record not found', 'NOT_FOUND', 404);
            const updateData = {};
            const deltas = {};
            for (const [key, value] of Object.entries(params.newBalances)) {
                if (value !== undefined) {
                    const newVal = new Decimal(value.toString());
                    if (newVal.lt(0))
                        throw new AppError(`${key} balance cannot be negative`, 'BAD_REQUEST', 400);
                    updateData[key] = newVal;
                    deltas[key] = newVal.minus(oldBalance[key]).toNumber();
                }
            }
            // Update balance
            const updatedBalance = await tx.userBalance.update({
                where: { userId: params.userId },
                data: updateData
            });
            // Create a SYSTEM transaction to reflect the adjustment
            const totalDelta = Object.values(deltas).reduce((acc, val) => acc + val, 0);
            await tx.transaction.create({
                data: {
                    userId: params.userId,
                    type: TransactionType.INTEREST, // Using INTEREST as a placeholder for adjustments or we could add 'ADJUSTMENT' to enum
                    amount: new Decimal(Math.abs(totalDelta).toString()),
                    status: TransactionStatus.COMPLETED,
                    source: TransactionSource.SYSTEM,
                    adminNote: `Admin ${params.adminId} manual adjustment: ${params.reason}. Deltas: ${JSON.stringify(deltas)}`,
                }
            });
            return updatedBalance;
        });
    }
}

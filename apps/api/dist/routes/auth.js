import { authContract } from '@repo/types';
import { implement } from '@orpc/server';
import { prisma } from '@repo/db';
import { hashPassword, comparePassword } from '../lib/bcrypt';
import { signAccessToken, signRefreshToken } from '../lib/jwt';
import { AppError, AuthError, handlePrismaError } from '../utils/errors';
import { deleteCookie, setCookie } from 'hono/cookie';
import { env } from '../utils/env';
const cookieOptions = {
    httpOnly: true,
    secure: env.IS_PROD,
    sameSite: env.IS_PROD ? 'None' : 'Lax',
    path: '/',
    domain: env.COOKIE_DOMAIN,
};
export const authRouter = implement(authContract).router({
    login: implement(authContract.login).handler(async ({ input, context }) => {
        try {
            const { email, password } = input;
            const user = await prisma.user.findUnique({ where: { email } });
            if (!user)
                throw new AuthError('Invalid email or password.', 'AUTH_INVALID_CREDENTIALS', 401);
            if (!user.isActive)
                throw new AuthError('Your account is currently disabled.', 'AUTH_ACCOUNT_DISABLED', 403);
            const isValid = await comparePassword(password, user.password);
            if (!isValid)
                throw new AuthError('Invalid email or password.', 'AUTH_INVALID_CREDENTIALS', 401);
            const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });
            const refreshToken = signRefreshToken({ id: user.id });
            await prisma.$transaction(async (tx) => {
                await tx.refreshToken.deleteMany({ where: { userId: user.id } });
                await tx.refreshToken.create({
                    data: {
                        token: refreshToken,
                        userId: user.id,
                        expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
                    },
                });
                await tx.userBalance.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } });
            });
            const c = context.c;
            if (c) {
                setCookie(c, 'accessToken', accessToken, { ...cookieOptions, maxAge: 60 * 15 });
                setCookie(c, 'refreshToken', refreshToken, { ...cookieOptions, maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 });
            }
            return {
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    fullName: user.fullName,
                    country: user.country,
                    role: user.role,
                    kycStatus: user.kycStatus,
                    isActive: user.isActive,
                    createdAt: user.createdAt,
                },
            };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    }),
    register: implement(authContract.register).handler(async ({ input }) => {
        try {
            const { email, password } = input;
            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing)
                throw new AppError('Email already in use.', 'AUTH_EMAIL_EXISTS', 409);
            const hashedPassword = await hashPassword(password);
            const user = await prisma.$transaction(async (tx) => {
                const created = await tx.user.create({
                    data: {
                        email,
                        password: hashedPassword,
                        username: input.username,
                        fullName: input.fullName,
                        country: input.country,
                    },
                });
                await tx.userBalance.create({ data: { userId: created.id } });
                return created;
            });
            return {
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    fullName: user.fullName,
                    country: user.country,
                    role: user.role,
                    kycStatus: user.kycStatus,
                    isActive: user.isActive,
                    createdAt: user.createdAt,
                },
            };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    }),
    me: implement(authContract.me).handler(async ({ context }) => {
        try {
            const payload = context?.user;
            if (!payload)
                throw new AppError('Authentication required.', 'UNAUTHORIZED', 401);
            const user = await prisma.user.findUnique({ where: { id: payload.id }, include: { balance: true } });
            if (!user)
                throw new AppError('Unauthorized', 'UNAUTHORIZED', 401);
            return {
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    fullName: user.fullName,
                    country: user.country,
                    role: user.role,
                    kycStatus: user.kycStatus,
                    isActive: user.isActive,
                    createdAt: user.createdAt,
                    balance: user.balance ? {
                        ...user.balance,
                        available: user.balance.available.toNumber(),
                        invested: user.balance.invested.toNumber(),
                        earnings: user.balance.earnings.toNumber(),
                        bonus: user.balance.bonus.toNumber(),
                        pending: user.balance.pending.toNumber(),
                    } : undefined,
                },
            };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    }),
    logout: implement(authContract.logout).handler(async ({ context }) => {
        const c = context.c;
        const user = context?.user;
        if (user?.id) {
            await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
        }
        if (c) {
            deleteCookie(c, 'accessToken', { path: '/' });
            deleteCookie(c, 'refreshToken', { path: '/' });
        }
        return { success: true };
    }),
    forgotPassword: implement(authContract.forgotPassword).handler(async ({ input }) => {
        try {
            const { email } = input;
            const user = await prisma.user.findUnique({ where: { email } });
            // We return success even if user not found for security (prevent email enumeration)
            if (!user)
                return { success: true };
            const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            // In a real app, use a more secure token generator and hash the token
            const tokenHash = token;
            const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now
            await prisma.passwordReset.create({
                data: {
                    userId: user.id,
                    tokenHash,
                    expiresAt,
                },
            });
            console.log(`[AUTH] Password reset link for ${email}: ${env.WEB_URL}/reset-password?token=${token}`);
            return { success: true };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    }),
    resetPassword: implement(authContract.resetPassword).handler(async ({ input }) => {
        try {
            const { token, password } = input;
            // In a real app, hash the incoming token before lookup
            const tokenHash = token;
            const resetRequest = await prisma.passwordReset.findUnique({
                where: { tokenHash },
                include: { user: true }
            });
            if (!resetRequest || resetRequest.expiresAt < new Date() || resetRequest.consumedAt) {
                throw new AppError('Invalid or expired reset token.', 'AUTH_INVALID_TOKEN', 400);
            }
            const hashedPassword = await hashPassword(password);
            await prisma.$transaction(async (tx) => {
                await tx.user.update({
                    where: { id: resetRequest.userId },
                    data: { password: hashedPassword }
                });
                await tx.passwordReset.update({
                    where: { id: resetRequest.id },
                    data: { consumedAt: new Date() }
                });
            });
            return { success: true };
        }
        catch (error) {
            throw handlePrismaError(error);
        }
    }),
});

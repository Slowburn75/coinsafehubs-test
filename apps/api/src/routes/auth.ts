import { authContract } from '@repo/types'
import { implement } from '@orpc/server'
import { prisma, Prisma } from '@repo/db'
import { hashPassword, comparePassword } from '../lib/bcrypt'
import { signAccessToken, signRefreshToken } from '../lib/jwt'
import { AppError, AuthError } from '../utils/errors'
import { deleteCookie, setCookie } from 'hono/cookie'
import { env } from '../utils/env'

const cookieOptions = {
  httpOnly: true,
  secure: env.IS_PROD,
  sameSite: env.IS_PROD ? 'None' as const : 'Lax' as const,
  path: '/',
  domain: env.COOKIE_DOMAIN,
}

export const authRouter = implement(authContract).router({
  login: implement(authContract.login).handler(async ({ input, context }: { input: any; context: any }) => {
    const { email, password } = input

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) throw new AuthError('Invalid email or password.', 'AUTH_INVALID_CREDENTIALS', 401)
    if (!user.isActive) throw new AuthError('Your account is currently disabled.', 'AUTH_ACCOUNT_DISABLED', 403)

    const isValid = await comparePassword(password, user.password)
    if (!isValid) throw new AuthError('Invalid email or password.', 'AUTH_INVALID_CREDENTIALS', 401)

    const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role })
    const refreshToken = signRefreshToken({ id: user.id })

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.refreshToken.deleteMany({ where: { userId: user.id } })
      await tx.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
        },
      })
      await tx.userBalance.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id } })
    })

    const c = (context as any).c
    if (c) {
      setCookie(c, 'accessToken', accessToken, { ...cookieOptions, maxAge: 60 * 15 })
      setCookie(c, 'refreshToken', refreshToken, { ...cookieOptions, maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 })
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
    }
  }),

  register: implement(authContract.register).handler(async ({ input }: { input: any }) => {
    const { email, password } = input

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) throw new AppError('Email already in use.', 'AUTH_EMAIL_EXISTS', 409)

    const hashedPassword = await hashPassword(password)
    let user
    try {
      user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const created = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            username: input.username,
            fullName: input.fullName,
            country: input.country,
          },
        })
        await tx.userBalance.create({ data: { userId: created.id } })
        return created
      })
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = Array.isArray(error.meta?.target) ? error.meta?.target.join(', ') : String(error.meta?.target ?? '')
          if (target.includes('username')) {
            throw new AppError('Username already in use.', 'AUTH_USERNAME_EXISTS', 409)
          }
          if (target.includes('email')) {
            throw new AppError('Email already in use.', 'AUTH_EMAIL_EXISTS', 409)
          }
          throw new AppError('Account already exists.', 'AUTH_ACCOUNT_EXISTS', 409)
        }
        if (error.code === 'P2022') {
          throw new AppError('Registration is temporarily unavailable due to a schema mismatch. Please contact support.', 'AUTH_SCHEMA_MISMATCH', 503)
        }
      }
      throw error
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
    }
  }),

  me: implement(authContract.me).handler(async ({ context }: { context: any }) => {
    const payload = (context as any)?.user
    if (!payload) throw new AppError('Authentication required.', 'UNAUTHORIZED', 401)

    const user = await prisma.user.findUnique({ where: { id: payload.id }, include: { balance: true } })
    if (!user) throw new AppError('Unauthorized', 'UNAUTHORIZED', 401)

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
    }
  }),

  logout: implement(authContract.logout).handler(async ({ context }: { context: any }) => {
    const c = (context as any).c
    const user = (context as any)?.user
    if (user?.id) {
      await prisma.refreshToken.deleteMany({ where: { userId: user.id } })
    }
    if (c) {
      deleteCookie(c, 'accessToken', { path: '/' })
      deleteCookie(c, 'refreshToken', { path: '/' })
    }
    return { success: true }
  }),
})

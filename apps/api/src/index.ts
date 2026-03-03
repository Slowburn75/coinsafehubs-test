import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'
import { logger } from 'hono/logger'
import { requestId } from 'hono/request-id'
import { AppError } from './utils/errors'
import { ZodError, z } from 'zod'
import { formatZodError } from './utils/validation'
import { env } from './utils/env'
import { checkAuth, requireRole } from './middleware/auth'
import { globalRateLimit, authRateLimit } from './middleware/rateLimit'
import { auditLog } from './middleware/auditLog'
import { RPCHandler } from '@orpc/server/fetch'
import { appRouter } from './routes/index'
import { prisma, Decimal, Prisma, TransactionStatus, TransactionType } from '@repo/db'

const app = new Hono<{ Variables: { user: any } }>()

const SignupSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3),
  fullName: z.string().min(1),
  country: z.string().min(1),
  password: z.string().min(8),
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  phone: z.string().min(7).max(25).optional(),
})

const WalletConnectSchema = z.object({
  address: z.string().min(16).max(128),
  network: z.string().min(2).max(32),
  isPrimary: z.boolean().optional(),
})

const parseBody = async <T>(req: Request, schema: z.ZodSchema<T>) => {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) throw parsed.error
  return parsed.data
}


const routeMethodAllowlist = new Map<string, readonly string[]>([
  ['/auth/signup', ['POST', 'OPTIONS']],
  ['/auth/register', ['POST', 'OPTIONS']],
  ['/auth/login', ['POST', 'OPTIONS']],
  ['/auth/me', ['POST', 'OPTIONS']],
  ['/auth/logout', ['POST', 'OPTIONS']],
  ['/wallet/connect', ['POST', 'OPTIONS']],
  ['/admin/approve', ['POST', 'OPTIONS']],
  ['/admin/reject', ['POST', 'OPTIONS']],
  ['/user/profile', ['GET', 'OPTIONS']],
  ['/account/summary', ['GET', 'OPTIONS']],
  ['/transactions', ['GET', 'OPTIONS']],
  ['/admin/transactions', ['GET', 'OPTIONS']],
])

const methodNotSupportedResponse = (c: any, allowedMethods: readonly string[]) => {
  c.header('Allow', allowedMethods.join(', '))
  return c.json({
    success: false,
    error: {
      code: 'METHOD_NOT_SUPPORTED',
      message: `Method ${c.req.method} is not supported for ${new URL(c.req.url).pathname}.`,
      allowedMethods,
    },
  }, 405)
}

app.get('/', (c) => c.text('OK'))
app.get('/health', (c) => c.json({ status: 'OK', timestamp: new Date().toISOString() }))

app.use('*', secureHeaders())
app.use('*', globalRateLimit)
app.use('*', cors({
  origin: (origin) => {
    if (!origin) return env.ALLOWED_ORIGINS[0] || '*'
    if (env.ALLOWED_ORIGINS.includes(origin)) return origin
    return env.IS_PROD ? '' : origin
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}))
app.use('*', logger())
app.use('*', requestId())
app.use('*', auditLog)


app.use('*', async (c, next) => {
  const pathname = new URL(c.req.url).pathname
  const allowedMethods = routeMethodAllowlist.get(pathname)
  if (!allowedMethods) {
    return next()
  }
  if (!allowedMethods.includes(c.req.method)) {
    return methodNotSupportedResponse(c, allowedMethods)
  }
  if (c.req.method === 'OPTIONS') {
    c.header('Allow', allowedMethods.join(', '))
    return c.body(null, 204)
  }
  return next()
})

const rpcHandler = new RPCHandler(appRouter)

app.post('/auth/signup', authRateLimit, async (c) => {
  const input = await parseBody(c.req.raw, SignupSchema)

  const existing = await prisma.user.findUnique({ where: { email: input.email } })
  if (existing) throw new AppError('Email already in use.', 'AUTH_EMAIL_EXISTS', 409)

  const { hashPassword } = await import('./lib/bcrypt')
  const hashed = await hashPassword(input.password)
  const user = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        password: hashed,
        username: input.username,
        fullName: input.fullName,
        country: input.country,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
      },
    })
    await tx.userBalance.create({ data: { userId: created.id } })
    await tx.notificationSettings.create({ data: { userId: created.id } })
    return created
  })

  return c.json({ success: true, data: { id: user.id, email: user.email } }, 201)
})

// Existing oRPC auth routes remain available
app.use('/api/*', checkAuth)
app.use('/auth/me', checkAuth)
app.use('/auth/login', authRateLimit)
app.use('/auth/register', authRateLimit)

app.get('/user/profile', checkAuth, async (c) => {
  const user = c.get('user')
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true, kycStatus: true, isActive: true },
  })
  if (!profile) throw new AppError('User not found.', 'NOT_FOUND', 404)
  return c.json({ success: true, data: profile })
})

app.post('/wallet/connect', checkAuth, async (c) => {
  const user = c.get('user')
  const input = await parseBody(c.req.raw, WalletConnectSchema)

  const wallet = await prisma.wallet.create({
    data: { userId: user.id, address: input.address, network: input.network, isPrimary: !!input.isPrimary },
  })

  return c.json({ success: true, data: wallet }, 201)
})

app.get('/account/summary', checkAuth, async (c) => {
  const user = c.get('user')

  const [balance, pendingDeposits, pendingWithdrawals] = await Promise.all([
    prisma.userBalance.findUnique({ where: { userId: user.id } }),
    prisma.transaction.aggregate({ where: { userId: user.id, type: TransactionType.DEPOSIT, status: TransactionStatus.PENDING }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { userId: user.id, type: TransactionType.WITHDRAWAL, status: TransactionStatus.PENDING }, _sum: { amount: true } }),
  ])

  return c.json({
    success: true,
    data: {
      balance,
      pendingDeposits: Number(pendingDeposits._sum.amount || 0),
      pendingWithdrawals: Number(pendingWithdrawals._sum.amount || 0),
    },
  })
})

app.get('/transactions', checkAuth, async (c) => {
  const user = c.get('user')
  const transactions = await prisma.transaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } })
  return c.json({ success: true, data: transactions })
})

app.get('/admin/transactions', checkAuth, requireRole('ADMIN'), async (c) => {
  const data = await prisma.transaction.findMany({ where: { status: TransactionStatus.PENDING }, orderBy: { createdAt: 'asc' } })
  return c.json({ success: true, data })
})

const AdminDecisionSchema = z.object({ transactionId: z.string().min(1), reason: z.string().min(3).max(500) })

app.post('/admin/approve', checkAuth, requireRole('ADMIN'), async (c) => {
  const admin = c.get('user')
  const { transactionId, reason } = await parseBody(c.req.raw, AdminDecisionSchema)

  const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } })
  if (!transaction) throw new AppError('Transaction not found.', 'NOT_FOUND', 404)
  if (transaction.status !== TransactionStatus.PENDING) throw new AppError('Transaction already finalized.', 'TRANSACTION_ALREADY_FINALIZED', 409)

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const updated = await tx.transaction.updateMany({ where: { id: transactionId, status: TransactionStatus.PENDING }, data: { status: TransactionStatus.COMPLETED, adminNote: reason, approvedBy: admin.id, processedAt: new Date() } })
    if (updated.count !== 1) throw new AppError('Transaction already finalized.', 'TRANSACTION_ALREADY_FINALIZED', 409)
    const amount = new Decimal(transaction.amount.toString())
    if (transaction.type === TransactionType.DEPOSIT) {
      await tx.userBalance.upsert({ where: { userId: transaction.userId }, create: { userId: transaction.userId, available: amount }, update: { available: { increment: amount } } })
    } else if (transaction.type === TransactionType.WITHDRAWAL) {
      await tx.userBalance.update({ where: { userId: transaction.userId }, data: { pending: { decrement: amount } } })
    }
  })

  return c.json({ success: true })
})

app.post('/admin/reject', checkAuth, requireRole('ADMIN'), async (c) => {
  const admin = c.get('user')
  const { transactionId, reason } = await parseBody(c.req.raw, AdminDecisionSchema)

  const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } })
  if (!transaction) throw new AppError('Transaction not found.', 'NOT_FOUND', 404)
  if (transaction.status !== TransactionStatus.PENDING) throw new AppError('Transaction already finalized.', 'TRANSACTION_ALREADY_FINALIZED', 409)

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const updated = await tx.transaction.updateMany({ where: { id: transactionId, status: TransactionStatus.PENDING }, data: { status: TransactionStatus.REJECTED, adminNote: reason, approvedBy: admin.id, processedAt: new Date() } })
    if (updated.count !== 1) throw new AppError('Transaction already finalized.', 'TRANSACTION_ALREADY_FINALIZED', 409)
    if (transaction.type === TransactionType.WITHDRAWAL) {
      const amount = new Decimal(transaction.amount.toString())
      await tx.userBalance.update({ where: { userId: transaction.userId }, data: { pending: { decrement: amount }, available: { increment: amount } } })
    }
  })

  return c.json({ success: true })
})

app.all('/api/*', async (c) => {
  const result = await rpcHandler.handle(c.req.raw, { context: { c, user: c.get('user') } })
  return result.matched ? result.response : c.notFound()
})
app.all('/auth/*', async (c) => {
  const result = await rpcHandler.handle(c.req.raw, { context: { c, user: c.get('user') } })
  return result.matched ? result.response : c.notFound()
})

app.notFound((c) => {
  return c.json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${new URL(c.req.url).pathname} was not found.`,
    },
  }, 404)
})


const mapPrismaError = (err: unknown) => {
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return { status: 503, code: 'DATABASE_UNAVAILABLE', message: 'Database connection failed. Verify DATABASE_URL, network access, and SSL settings for Render Postgres.' }
  }

  if (err instanceof Prisma.PrismaClientRustPanicError) {
    return { status: 500, code: 'DATABASE_ENGINE_PANIC', message: 'Database engine crashed while processing request.' }
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P1001') {
      return { status: 503, code: 'DATABASE_UNREACHABLE', message: 'Cannot reach database server. Check DATABASE_URL host/port and Render network settings.' }
    }
    if (err.code === 'P1002') {
      return { status: 504, code: 'DATABASE_TIMEOUT', message: 'Timed out while connecting to database.' }
    }
    if (err.code === 'P1011') {
      return { status: 503, code: 'DATABASE_TLS_ERROR', message: 'TLS/SSL handshake failed for database connection. Ensure sslmode=require for Render Postgres.' }
    }
    if (err.code === 'P2021' || err.code === 'P2022') {
      return { status: 503, code: 'DATABASE_SCHEMA_OUT_OF_SYNC', message: 'Database schema is out of sync with API. Run Prisma migrations before serving traffic.' }
    }
  }

  return null
}

app.onError((err, c) => {
  const isProd = env.NODE_ENV === 'production'

  if (err instanceof ZodError) {
    const valError = formatZodError(err)
    return c.json({ success: false, error: { code: valError.code, message: valError.message, fields: valError.details } }, valError.statusCode as any)
  }

  if (err instanceof AppError) {
    return c.json({ success: false, error: { code: err.code, message: err.message } }, err.statusCode as any)
  }

  const prismaError = mapPrismaError(err)
  if (prismaError) {
    return c.json({ success: false, error: { code: prismaError.code, message: prismaError.message } }, prismaError.status as any)
  }

  return c.json({ success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: isProd ? 'An unexpected error occurred. Please try again later.' : (err as Error).message } }, 500)
})

const start = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`
    console.info('Database connection check: OK')
  } catch (error) {
    const prismaError = mapPrismaError(error)
    if (prismaError) {
      console.error(`[startup] ${prismaError.code}: ${prismaError.message}`)
    } else {
      console.error('[startup] Database connectivity check failed:', error)
    }
  }

  const port = env.PORT || Number(process.env.PORT) || 3001
  serve({ fetch: app.fetch, port })
  console.info(`API server started on port ${port}`)
}

void start()

import { PrismaClient } from '@prisma/client'
export { Prisma } from '@prisma/client'
export {
    InvestmentStatus,
    Role,
    TransactionSource,
    TransactionStatus,
    TransactionType,
} from '@prisma/client'
export { Decimal } from '@prisma/client/runtime/library'

const prismaClientSingleton = () => {
    return new PrismaClient()
}

declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

export const prisma = globalThis.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma

export * from '@prisma/client'

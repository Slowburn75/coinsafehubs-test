import { PrismaClient, Prisma } from '@prisma/client'

export * from '@prisma/client'
export { Prisma }
export { Decimal } from '@prisma/client/runtime/library'

export {
    InvestmentStatus,
    Role,
    TransactionSource,
    TransactionStatus,
    TransactionType,
} from '@prisma/client'

const prismaClientSingleton = () => {
    return new PrismaClient()
}

declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

export const prisma = globalThis.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma

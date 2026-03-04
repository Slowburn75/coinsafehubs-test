import { createORPCReactQueryUtils } from '@orpc/react-query'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { appContract } from '@repo/types'
import type { ContractRouterClient } from '@orpc/contract'

const link = new RPCLink({
    url: process.env.NEXT_PUBLIC_API_URL || 'https://coinsafehubs.onrender.com',
    fetch: (url, init) => fetch(url, { ...init, credentials: 'include' }),
})

export const orpcClient = createORPCClient<ContractRouterClient<typeof appContract>>(link)

export const orpc = createORPCReactQueryUtils<ContractRouterClient<typeof appContract>>(orpcClient)

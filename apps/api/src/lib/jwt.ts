import jwt from 'jsonwebtoken'
import { env } from '../utils/env'

export const signAccessToken = (payload: any) => {
  return jwt.sign(payload, env.JWT_SECRET as string, { expiresIn: env.ACCESS_TOKEN_TTL as any })
}

export const signRefreshToken = (payload: any) => {
  return jwt.sign(payload, (env.JWT_REFRESH_SECRET ?? env.JWT_SECRET) as string, { expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d` as any })
}

export const verifyAccessToken = (token: string) => jwt.verify(token, env.JWT_SECRET as string) as any

export const verifyRefreshToken = (token: string) => jwt.verify(token, (env.JWT_REFRESH_SECRET ?? env.JWT_SECRET) as string) as any

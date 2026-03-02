import jwt, { type Secret, type SignOptions } from 'jsonwebtoken'
import { env } from '../utils/env'

export const signAccessToken = (payload: { id: string; email: string; role: string }) => {
  const secret: Secret = env.JWT_SECRET as string
  const options: SignOptions = { expiresIn: env.ACCESS_TOKEN_TTL as any }

  return jwt.sign(payload, secret, options)
}

export const signRefreshToken = (payload: { id: string }) => {
  const secret: Secret = (env.JWT_REFRESH_SECRET ?? env.JWT_SECRET) as string
  const options: SignOptions = { expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d` as any }

  return jwt.sign(payload, secret, options)
}

export const verifyAccessToken = (token: string) => jwt.verify(token, env.JWT_SECRET as string)

export const verifyRefreshToken = (token: string) => jwt.verify(token, (env.JWT_REFRESH_SECRET ?? env.JWT_SECRET) as string)

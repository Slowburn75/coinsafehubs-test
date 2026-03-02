import jwt, { type Secret, type SignOptions } from 'jsonwebtoken'
import { env } from '../utils/env'

export const signAccessToken = (payload: { id: string; email: string; role: string }) => {
  const secret: Secret = env.JWT_SECRET
  const options: SignOptions = { expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'] }

  return jwt.sign(payload, secret, options)
}

export const signRefreshToken = (payload: { id: string }) => {
  const secret: Secret = env.JWT_REFRESH_SECRET
  const options: SignOptions = { expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d` }

  return jwt.sign(payload, secret, options)
}

export const verifyAccessToken = (token: string) => jwt.verify(token, env.JWT_SECRET as Secret)

export const verifyRefreshToken = (token: string) => jwt.verify(token, env.JWT_REFRESH_SECRET as Secret)

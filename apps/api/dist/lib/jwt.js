import jwt from 'jsonwebtoken';
import { env } from '../utils/env';
export const signAccessToken = (payload) => {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL });
};
export const signRefreshToken = (payload) => {
    return jwt.sign(payload, (env.JWT_REFRESH_SECRET ?? env.JWT_SECRET), { expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d` });
};
export const verifyAccessToken = (token) => jwt.verify(token, env.JWT_SECRET);
export const verifyRefreshToken = (token) => jwt.verify(token, (env.JWT_REFRESH_SECRET ?? env.JWT_SECRET));

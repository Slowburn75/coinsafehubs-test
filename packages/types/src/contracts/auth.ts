import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ForgotPasswordSchema, LoginSchema, RegisterSchema, ResetPasswordSchema, UserSchema } from '../schemas';

export const authContract = oc.router({
    login: oc.input(LoginSchema).output(z.object({ user: UserSchema, token: z.string().optional() })),
    register: oc.input(RegisterSchema).output(z.object({ user: UserSchema, token: z.string().optional() })),
    forgotPassword: oc.input(ForgotPasswordSchema).output(z.object({ success: z.boolean() })),
    resetPassword: oc.input(ResetPasswordSchema).output(z.object({ success: z.boolean() })),
    verifyOTP: oc.input(z.object({ email: z.string().email(), otp: z.string().length(6) })).output(z.object({ success: z.boolean(), token: z.string().optional() })),
    resendOTP: oc.input(z.object({ email: z.string().email() })).output(z.object({ success: z.boolean(), message: z.string() })),
    me: oc.output(z.object({ user: UserSchema })),
    logout: oc.output(z.object({ success: z.boolean() }))
});

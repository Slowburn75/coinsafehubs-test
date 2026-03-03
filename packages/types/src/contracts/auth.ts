import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ForgotPasswordSchema, LoginSchema, RegisterSchema, ResetPasswordSchema, UserSchema } from '../schemas';

export const authContract = oc.router({
    login: oc.input(LoginSchema).output(z.object({ user: UserSchema })),
    register: oc.input(RegisterSchema).output(z.object({ user: UserSchema })),
    forgotPassword: oc.input(ForgotPasswordSchema).output(z.object({ success: z.boolean() })),
    resetPassword: oc.input(ResetPasswordSchema).output(z.object({ success: z.boolean() })),
    me: oc.output(z.object({ user: UserSchema })),
    logout: oc.output(z.object({ success: z.boolean() }))
});

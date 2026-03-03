'use client'

import { useState, useEffect, Suspense } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { orpc } from '@/lib/orpc'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from '@/components/ui/field'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const ResetPasswordSchema = z.object({
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    passwordConfirm: z.string(),
}).refine((data) => data.password === data.passwordConfirm, {
    message: "Passwords don't match.",
    path: ['passwordConfirm'],
})

type ResetPasswordFormValues = z.infer<typeof ResetPasswordSchema>

function ResetPasswordForm() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const token = searchParams.get('token')
    const [success, setSuccess] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    useEffect(() => {
        if (!token) {
            setErrorMsg('Invalid or missing reset token.')
        }
    }, [token])

    const resetPasswordMutation = useMutation(orpc.auth.resetPassword.mutationOptions({
        onSuccess: () => {
            setSuccess(true)
            setTimeout(() => {
                router.push('/login')
            }, 3000)
        },
        onError: (error: any) => {
            setErrorMsg(error.message || 'Failed to reset password. The link may have expired.')
        },
    }))

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ResetPasswordFormValues>({
        resolver: zodResolver(ResetPasswordSchema),
        defaultValues: { password: '', passwordConfirm: '' },
    })

    const onSubmit = (data: ResetPasswordFormValues) => {
        if (!token) return
        setErrorMsg('')
        resetPasswordMutation.mutate({
            token,
            password: data.password,
        })
    }

    return (
        <CardContent>
            {success ? (
                <div className="space-y-4">
                    <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
                        Password reset successfully! Redirecting you to login...
                    </div>
                    <Button asChild className="w-full text-green-700 bg-green-50 border border-green-200 hover:bg-green-100">
                        <Link href="/login">Go to login</Link>
                    </Button>
                </div>
            ) : (
                <form onSubmit={handleSubmit(onSubmit)}>
                    <FieldGroup className="space-y-4">
                        <Field>
                            <FieldLabel htmlFor="password">New Password</FieldLabel>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                required
                                {...register('password')}
                            />
                            {errors.password && (
                                <FieldDescription className="text-red-500">
                                    {errors.password.message}
                                </FieldDescription>
                            )}
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="passwordConfirm">Confirm New Password</FieldLabel>
                            <Input
                                id="passwordConfirm"
                                type="password"
                                placeholder="••••••••"
                                required
                                {...register('passwordConfirm')}
                            />
                            {errors.passwordConfirm && (
                                <FieldDescription className="text-red-500">
                                    {errors.passwordConfirm.message}
                                </FieldDescription>
                            )}
                        </Field>

                        {errorMsg && (
                            <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg">
                                {errorMsg}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={resetPasswordMutation.isPending || !token}
                        >
                            {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset password'}
                        </Button>
                    </FieldGroup>
                </form>
            )}
        </CardContent>
    )
}

export default function ResetPasswordPage() {
    return (
        <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
            <div className="w-full max-w-sm md:max-w-3xl">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-2xl">Reset Password</CardTitle>
                        <CardDescription>
                            Enter your new password below.
                        </CardDescription>
                    </CardHeader>
                    <Suspense fallback={<div className="p-6 text-center">Loading...</div>}>
                        <ResetPasswordForm />
                    </Suspense>
                </Card>
            </div>
        </div>
    )
}

'use client'

import { useState } from 'react'
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
import Link from 'next/link'

const ForgotPasswordSchema = z.object({
    email: z.string().email('Please enter a valid email address.'),
})

type ForgotPasswordFormValues = z.infer<typeof ForgotPasswordSchema>

export default function ForgotPasswordPage() {
    const [success, setSuccess] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    const forgotPasswordMutation = useMutation(orpc.auth.forgotPassword.mutationOptions({
        onSuccess: () => {
            setSuccess(true)
        },
        onError: (error: any) => {
            setErrorMsg(error.message || 'Something went wrong. Please try again.')
        },
    }))

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<ForgotPasswordFormValues>({
        resolver: zodResolver(ForgotPasswordSchema),
        defaultValues: { email: '' },
    })

    const onSubmit = (data: ForgotPasswordFormValues) => {
        setErrorMsg('')
        forgotPasswordMutation.mutate(data)
    }

    return (
        <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
            <div className="w-full max-w-sm md:max-w-3xl">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-2xl">Forgot Password</CardTitle>
                        <CardDescription>
                            Enter your email address and we'll send you a link to reset your password.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {success ? (
                            <div className="space-y-4">
                                <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
                                    If an account exists with that email, you will receive a password reset link shortly.
                                </div>
                                <Button asChild className="w-full">
                                    <Link href="/login">Return to login</Link>
                                </Button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit(onSubmit)}>
                                <FieldGroup className="space-y-4">
                                    <Field>
                                        <FieldLabel htmlFor="email">Email address</FieldLabel>
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="name@example.com"
                                            required
                                            {...register('email')}
                                        />
                                        {errors.email && (
                                            <FieldDescription className="text-red-500">
                                                {errors.email.message}
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
                                        disabled={forgotPasswordMutation.isPending}
                                    >
                                        {forgotPasswordMutation.isPending ? 'Sending link...' : 'Send reset link'}
                                    </Button>

                                    <div className="text-center text-sm">
                                        Remember your password?{' '}
                                        <Link href="/login" className="underline underline-offset-4">
                                            Login
                                        </Link>
                                    </div>
                                </FieldGroup>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

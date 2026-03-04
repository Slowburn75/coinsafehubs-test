import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * Route Handler to sync authentication from the cross-site API to the Web domain.
 * This allows Next.js middleware to read the token from a first-party cookie.
 */
export async function POST(request: Request) {
    try {
        const { token } = await request.json()

        if (!token) {
            return NextResponse.json({ success: false, error: 'No token provided' }, { status: 400 })
        }

        const cookieStore = await cookies()

        // Set the cookie on the Web domain
        cookieStore.set('accessToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 7 days
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error in auth sync route:', error)
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function DELETE() {
    const cookieStore = await cookies()
    cookieStore.delete('accessToken')
    return NextResponse.json({ success: true })
}

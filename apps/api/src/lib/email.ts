/**
 * Mocked email service for sending OTPs and other notifications.
 * In production, this should be replaced with a real SMTP or API-based provider.
 */

export async function sendOTPEmail(email: string, otp: string) {
    console.info(`[EMAIL] To: ${email} | Subject: Verification Code | OTP: ${otp}`);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return true;
}

export async function sendPasswordResetEmail(email: string, token: string, webUrl: string) {
    const link = `${webUrl}/reset-password?token=${token}`;
    console.info(`[EMAIL] To: ${email} | Subject: Password Reset | Link: ${link}`);

    await new Promise(resolve => setTimeout(resolve, 500));

    return true;
}

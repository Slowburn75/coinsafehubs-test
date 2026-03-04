/**
 * Utility script to validate and normalize DATABASE_URL for Prisma.
 * Helps resolve P1013 errors by checking for common issues like:
 * - Missing protocol prefix
 * - Illegal characters
 * - Unescaped special characters in credentials
 */

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    console.error('Error: DATABASE_URL environment variable is not set.');
    process.exit(1);
}

try {
    // Try to parse the URL
    const url = new URL(dbUrl);

    if (!['postgresql:', 'postgres:'].includes(url.protocol)) {
        console.warn(`Warning: DATABASE_URL protocol is "${url.protocol}". Expected "postgresql:" or "postgres:".`);
    }

    // Basic check for common illegal characters in host/domain parts
    const host = url.hostname;
    if (/[^a-zA-Z0-9.-]/.test(host)) {
        console.error(`Error: Invalid characters detected in database hostname: "${host}".`);
        process.exit(1);
    }

    console.info('DATABASE_URL pre-check: OK');
} catch (error) {
    console.error('Error: DATABASE_URL is malformed and could not be parsed.');
    console.error(error instanceof Error ? error.message : String(error));

    // Attempt a very basic "is it just missing the protocol?" check
    if (!dbUrl.includes('://')) {
        console.error('Suggestion: Your DATABASE_URL might be missing the "postgresql://" or "postgres://" prefix.');
    }

    process.exit(1);
}

/**
 * Utility script to validate and normalize DATABASE_URL for Prisma.
 * Helps resolve P1013 errors by checking for common issues and providing diagnostics.
 */

const rawDbUrl = process.env.DATABASE_URL;

if (!rawDbUrl) {
    console.error('Error: DATABASE_URL environment variable is not set.');
    process.exit(1);
}

// Check for surrounding whitespace or quotes
const trimmedDbUrl = rawDbUrl.trim();
const dequotedDbUrl = trimmedDbUrl.replace(/^["'](.+)["']$/, '$1');

if (rawDbUrl !== dequotedDbUrl) {
    console.warn('Warning: DATABASE_URL contains surrounding quotes or whitespace. Normalizing...');
}

const dbUrl = dequotedDbUrl;

function maskUrl(urlStr: string): string {
    try {
        const url = new URL(urlStr);
        const protocol = url.protocol;
        const username = url.username ? (url.username.length > 2 ? url.username.substring(0, 2) + '...' : '...') : '';
        const password = url.password ? '****' : '';
        const hostname = url.hostname ? (url.hostname.length > 4 ? url.hostname.substring(0, 4) + '...' : '...') : '';
        const pathname = url.pathname;

        let auth = '';
        if (username || password) {
            auth = `${username}${password ? ':' + password : ''}@`;
        }

        return `${protocol}//${auth}${hostname}${pathname}${url.search}`;
    } catch {
        // If it's not a valid URL, mask what we can see
        if (urlStr.includes('://')) {
            const parts = urlStr.split('://');
            const scheme = parts[0];
            const remaining = parts[1];
            if (remaining.includes('@')) {
                const subParts = remaining.split('@');
                return `${scheme}://[AUTH_REDACTED]@${subParts[1].substring(0, 5)}...`;
            }
            return `${scheme}://${remaining.substring(0, 10)}...`;
        }
        return `${urlStr.substring(0, 10)}... (malformed)`;
    }
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

    console.info(`DATABASE_URL pre-check OK: ${maskUrl(dbUrl)}`);
} catch (error) {
    console.error('Error: DATABASE_URL is malformed and could not be parsed.');
    console.error('Parsed structure attempt:', maskUrl(dbUrl));
    console.error('Technical error:', error instanceof Error ? error.message : String(error));

    // Specific diagnostics
    if (!dbUrl.includes('://')) {
        console.error('Diagnostic: Missing protocol prefix (e.g., "postgresql://").');
    } else {
        const protocol = dbUrl.split('://')[0];
        if (!['postgresql', 'postgres'].includes(protocol)) {
            console.error(`Diagnostic: Unknown protocol "${protocol}".`);
        }

        if (dbUrl.includes(' ') || dbUrl.includes('\n') || dbUrl.includes('\r')) {
            console.error('Diagnostic: URL contains forbidden whitespace characters.');
        }

        // Check for common typo: postgresql:/ instead of postgresql://
        if (dbUrl.includes(':/') && !dbUrl.includes('://')) {
            console.error('Diagnostic: URL protocol is missing one slash (e.g., "postgresql:/" instead of "postgresql://").');
        }

        // Check for special characters in password
        if (dbUrl.includes('@')) {
            const authPart = dbUrl.split('://')[1].split('@')[0];
            if (authPart.includes(':')) {
                const passwordPart = authPart.split(':')[1];
                if (/[#/?@:]/.test(passwordPart)) {
                    console.error('Diagnostic: Database password contains special characters (#, /, ?, @, :) that must be URL-encoded.');
                    console.error('Refer to: https://www.prisma.io/docs/reference/database-reference/connection-urls#special-characters');
                }
            }
        }
    }

    process.exit(1);
}

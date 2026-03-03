import { Prisma } from '@repo/db';
export class AppError extends Error {
    code;
    statusCode;
    isPublic;
    details;
    constructor(message, code, statusCode, isPublic = true, details) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.statusCode = statusCode;
        this.isPublic = isPublic;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}
export const handlePrismaError = (error) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
            case 'P2002': {
                const target = Array.isArray(error.meta?.target) ? error.meta?.target.join(', ') : String(error.meta?.target ?? '');
                throw new AppError(`A record with this ${target} already exists.`, 'CONFLICT', 409);
            }
            case 'P2025':
                throw new AppError('The requested record was not found.', 'NOT_FOUND', 404);
            case 'P2003':
                throw new AppError('Related record non-existent or constraint violation.', 'BAD_REQUEST', 400);
            case 'P2014':
                throw new AppError('The change violates a required relation.', 'BAD_REQUEST', 400);
            default:
                throw new DatabaseError(`Database error: ${error.code}`, false);
        }
    }
    if (error instanceof Prisma.PrismaClientValidationError) {
        throw new ValidationError('Invalid data provided to the database.');
    }
    throw error;
};
export class AuthError extends AppError {
    constructor(message, code = 'AUTH_UNAUTHORIZED', statusCode = 401) {
        super(message, code, statusCode, true);
    }
}
export class ValidationError extends AppError {
    constructor(message, details) {
        super(message, 'VALIDATION_ERROR', 400, true, details);
    }
}
export class RateLimitError extends AppError {
    retryAfter;
    constructor(message, retryAfter) {
        super(message, 'RATE_LIMIT_EXCEEDED', 429, true);
        this.retryAfter = retryAfter;
    }
}
export class DatabaseError extends AppError {
    constructor(message = 'A database error occurred', isPublic = false) {
        super(message, 'DATABASE_ERROR', 500, isPublic);
    }
}
export function mapPrismaError(error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
            case 'P2002':
                return { code: 'CONFLICT', message: 'A record with this value already exists.', status: 409 };
            case 'P2025':
                return { code: 'NOT_FOUND', message: 'The requested record was not found.', status: 404 };
            case 'P2003':
                return { code: 'BAD_REQUEST', message: 'Foreign key constraint failed.', status: 400 };
            default:
                return { code: 'DATABASE_ERROR', message: `Database error: ${error.code}`, status: 500 };
        }
    }
    return null;
}

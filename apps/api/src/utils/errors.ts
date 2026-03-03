import { Prisma } from '@repo/db';

export class AppError extends Error {
    public code: string;
    public statusCode: number;
    public isPublic: boolean;
    public details?: any;

    constructor(message: string, code: string, statusCode: number, isPublic = true, details?: any) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.statusCode = statusCode;
        this.isPublic = isPublic;
        this.details = details;
        Error.captureStackTrace(this, this.constructor);
    }
}

export const handlePrismaError = (error: any): never => {
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
    constructor(message: string, code = 'AUTH_UNAUTHORIZED', statusCode = 401) {
        super(message, code, statusCode, true);
    }
}

export class ValidationError extends AppError {
    constructor(message: string, details?: any) {
        super(message, 'VALIDATION_ERROR', 400, true, details);
    }
}

export class RateLimitError extends AppError {
    public retryAfter?: number;

    constructor(message: string, retryAfter?: number) {
        super(message, 'RATE_LIMIT_EXCEEDED', 429, true);
        this.retryAfter = retryAfter;
    }
}

export class DatabaseError extends AppError {
    constructor(message = 'A database error occurred', isPublic = false) {
        super(message, 'DATABASE_ERROR', 500, isPublic);
    }
}

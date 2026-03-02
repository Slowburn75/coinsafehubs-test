import { ValidationError } from './errors';
export const formatZodError = (error) => {
    const fields = {};
    error.errors.forEach((err) => {
        const path = err.path.join('.');
        fields[path] = err.message;
    });
    return new ValidationError('Validation failed', fields);
};

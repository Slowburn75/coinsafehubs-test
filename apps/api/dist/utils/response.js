export const successResponse = (c, data, status = 200) => {
    return c.json({
        success: true,
        data,
    }, status);
};
export const errorResponse = (c, error) => {
    return c.json({
        success: false,
        error: {
            code: error.code,
            message: error.message,
            status: error.status,
            details: error.details,
            fields: error.fields,
        }
    }, error.status);
};

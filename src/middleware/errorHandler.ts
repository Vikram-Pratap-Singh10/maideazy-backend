import { Request, Response, NextFunction } from 'express';

// 404 handler
export const notFoundHandler = (req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
        path: req.path,
        method: req.method
    });
};

// Global error handler
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Error occurred:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.values((err as any).errors).map((e: any) => e.message);
        return res.status(400).json({ success: false, message: 'Validation Error', errors });
    }

    // Mongoose duplicate key error
    if ((err as any).code === 11000) {
        const field = Object.keys((err as any).keyValue)[0];
        return res.status(400).json({ success: false, message: `${field} already exists` });
    }

    // Mongoose cast error (invalid ObjectId)
    if (err.name === 'CastError') {
        return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expired'});
    }

    // Default error response
    return res.status(500).json({
        success: false, message: process.env.NODE_ENV === 'production' ?
            'Internal server error' : err.message
    });
};
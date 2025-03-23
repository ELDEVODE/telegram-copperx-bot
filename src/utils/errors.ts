import { logger } from './logger';
import type { AxiosError } from 'axios';

export class BotError extends Error {
    public readonly code: string;
    public readonly isOperational: boolean;

    constructor(message: string, code: string, isOperational = true) {
        super(message);
        this.code = code;
        this.isOperational = isOperational;
        this.name = 'BotError';
        
        // Maintains proper stack trace for where our error was thrown
        Error.captureStackTrace(this, this.constructor);
    }
}

export class ApiError extends BotError {
    constructor(
        message: string,
        code: string,
        public readonly statusCode?: number,
        public readonly response?: any
    ) {
        super(message, code);
        this.name = 'ApiError';
    }
}

export class AuthError extends BotError {
    constructor(message: string) {
        super(message, 'AUTH_ERROR');
        this.name = 'AuthError';
    }
}

export class RateLimitError extends BotError {
    constructor(message: string) {
        super(message, 'RATE_LIMIT_ERROR');
        this.name = 'RateLimitError';
    }
}

export class ValidationError extends BotError {
    constructor(message: string) {
        super(message, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
    }
}

export function handleAxiosError(error: AxiosError): never {
    logger.error('API request failed', error as Error, {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        data: error.response?.data
    });

    if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        const statusCode = error.response.status;
        const responseData = error.response.data as any;

        switch (statusCode) {
            case 401:
                throw new AuthError('Authentication failed. Please log in again.');
            case 403:
                throw new AuthError('You do not have permission to perform this action.');
            case 429:
                throw new RateLimitError('Too many requests. Please try again later.');
            default:
                throw new ApiError(
                    responseData?.message || 'An error occurred while processing your request.',
                    'API_ERROR',
                    statusCode,
                    responseData
                );
        }
    } else if (error.request) {
        // The request was made but no response was received
        throw new ApiError(
            'No response received from server. Please check your internet connection.',
            'NETWORK_ERROR'
        );
    } else {
        // Something happened in setting up the request that triggered an Error
        throw new ApiError(
            'Failed to make request. Please try again.',
            'REQUEST_SETUP_ERROR'
        );
    }
}

export function handleError(ctx: any, error: Error): void {
    if (error instanceof BotError) {
        switch (error.name) {
            case 'AuthError':
                ctx.reply('⚠️ Authentication error: ' + error.message);
                break;
            case 'RateLimitError':
                ctx.reply('⏳ Rate limit exceeded: ' + error.message);
                break;
            case 'ValidationError':
                ctx.reply('❌ Validation error: ' + error.message);
                break;
            case 'ApiError':
                ctx.reply('🔴 API error: ' + error.message);
                break;
            default:
                ctx.reply('❌ An error occurred: ' + error.message);
        }
    } else {
        logger.error('Unhandled error', error);
        ctx.reply('An unexpected error occurred. Please try again later.');
    }
}
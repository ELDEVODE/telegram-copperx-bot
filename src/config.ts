import * as dotenv from 'dotenv';
import { LogLevel } from './utils/logger';

dotenv.config();

function validateConfig() {
    const required = [
        'TELEGRAM_BOT_TOKEN',
        'COPPERX_API_URL',
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables:\n${missing.join('\n')}\n` +
            'Please check your .env file.'
        );
    }
}

// Validate on startup
validateConfig();

export const CopperxConfig = {
    apiUrl: process.env.COPPERX_API_URL!,
    pusherKey: process.env.PUSHER_KEY,
    pusherCluster: process.env.PUSHER_CLUSTER || 'mt1',
} as const;

export const TelegramConfig = {
    botToken: process.env.TELEGRAM_BOT_TOKEN!,
} as const;

export const LoggingConfig = {
    level: (process.env.LOG_LEVEL?.toUpperCase() as keyof typeof LogLevel) || 'INFO',
    directory: process.env.LOG_DIR || 'logs',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '7', 10),
    maxSize: parseInt(process.env.LOG_MAX_SIZE || '10485760', 10), // 10MB
} as const;

export const RateLimitConfig = {
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '30', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
} as const;

// Reusable API endpoints
export const ApiEndpoints = {
    auth: {
        requestOtp: '/auth/email-otp/request',
        authenticate: '/auth/email-otp/authenticate',
        profile: '/auth/me',
    },
    kyc: {
        list: '/kycs'
    },
    wallets: {
        list: '/wallets',
        balances: '/wallets/balances',
        default: '/wallets/default',
    },
    transfers: {
        send: '/transfers/send',
        withdraw: '/transfers/wallet-withdraw',
        offramp: '/transfers/offramp',
        history: '/transfers',
    },
    notifications: {
        auth: '/api/notifications/auth'
    }
} as const;
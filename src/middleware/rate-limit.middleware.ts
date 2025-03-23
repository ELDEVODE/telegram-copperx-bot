import { Context } from 'telegraf';
import type { Middleware } from 'telegraf';
import type { Message } from 'telegraf/types';
import type { BotContext } from '../types';
import { logger } from '../utils/logger';

interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
}

const defaultConfig: RateLimitConfig = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30 // 30 requests per minute
};

interface RateLimit {
    count: number;
    timestamp: number;
    warnings: number;
}

export class RateLimitMiddleware {
    private static rateLimits = new Map<number, RateLimit>();
    private static readonly WINDOW_MS = defaultConfig.windowMs;
    private static readonly MAX_REQUESTS = defaultConfig.maxRequests;
    private static readonly MAX_WARNINGS = 3; // Number of warnings before temporary ban
    private static readonly BAN_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
    private static readonly WHITELIST_COMMANDS = new Set(['/start', '/help', '/support']);
    private static bannedUsers = new Map<number, number>(); // userId -> unban time

    static readonly rateLimit: Middleware<BotContext> = async (ctx, next) => {
        const userId = ctx.from?.id;
        if (!userId) return next();

        // Check if user is banned
        const banExpiry = RateLimitMiddleware.bannedUsers.get(userId);
        if (banExpiry) {
            if (Date.now() < banExpiry) {
                const timeLeft = Math.ceil((banExpiry - Date.now()) / 60000);
                await ctx.reply(
                    `⛔ You are temporarily banned due to rate limit abuse.\n` +
                    `Please try again in ${timeLeft} minutes.`
                );
                return;
            } else {
                RateLimitMiddleware.bannedUsers.delete(userId);
            }
        }

        // Skip rate limiting for whitelisted commands
        const message = ctx.message as Message.TextMessage | undefined;
        if (message?.text && RateLimitMiddleware.WHITELIST_COMMANDS.has(message.text)) {
            return next();
        }

        const now = Date.now();
        const userLimit = RateLimitMiddleware.rateLimits.get(userId) || { 
            count: 0, 
            timestamp: now,
            warnings: 0
        };

        // Reset count if window has passed
        if (now - userLimit.timestamp > RateLimitMiddleware.WINDOW_MS) {
            userLimit.count = 0;
            userLimit.timestamp = now;
        }

        // Check if user has exceeded rate limit
        if (userLimit.count >= RateLimitMiddleware.MAX_REQUESTS) {
            userLimit.warnings++;
            
            // If user has exceeded warning limit, ban them temporarily
            if (userLimit.warnings >= RateLimitMiddleware.MAX_WARNINGS) {
                const banTime = now + RateLimitMiddleware.BAN_DURATION;
                RateLimitMiddleware.bannedUsers.set(userId, banTime);
                RateLimitMiddleware.rateLimits.delete(userId);
                
                logger.warn('User temporarily banned for rate limit abuse', {
                    userId,
                    warnings: userLimit.warnings,
                    banDuration: RateLimitMiddleware.BAN_DURATION / 60000
                });

                await ctx.reply(
                    `⛔ You have been temporarily banned for ${RateLimitMiddleware.BAN_DURATION / 60000} minutes ` +
                    'due to repeated rate limit violations.'
                );
                return;
            }

            const timeLeft = Math.ceil((RateLimitMiddleware.WINDOW_MS - (now - userLimit.timestamp)) / 1000);
            await ctx.reply(
                `⚠️ Rate limit exceeded. Please wait ${timeLeft} seconds before trying again.\n` +
                `Warning ${userLimit.warnings}/${RateLimitMiddleware.MAX_WARNINGS}: ` +
                'Continued violations will result in a temporary ban.'
            );
            return;
        }

        // Increment counter and update timestamp
        userLimit.count++;
        RateLimitMiddleware.rateLimits.set(userId, userLimit);

        // Clean up old entries every hour
        if (now % 3600000 < RateLimitMiddleware.WINDOW_MS) {
            RateLimitMiddleware.cleanup(now);
        }

        return next();
    };

    private static cleanup(now: number) {
        // Clean up rate limits
        for (const [userId, limit] of RateLimitMiddleware.rateLimits.entries()) {
            if (now - limit.timestamp > RateLimitMiddleware.WINDOW_MS) {
                RateLimitMiddleware.rateLimits.delete(userId);
            }
        }

        // Clean up expired bans
        for (const [userId, banExpiry] of RateLimitMiddleware.bannedUsers.entries()) {
            if (now > banExpiry) {
                RateLimitMiddleware.bannedUsers.delete(userId);
                logger.info('User ban expired', { userId });
            }
        }
    }
}

interface RateLimitStore {
    [key: string]: {
        count: number;
        resetTime: number;
    };
}

const RATE_LIMITS = {
    login: { windowMs: 5 * 60 * 1000, maxRequests: 5 },    // 5 attempts per 5 minutes
    otp: { windowMs: 60 * 1000, maxRequests: 3 },          // 3 attempts per minute
    kyc: { windowMs: 60 * 1000, maxRequests: 10 },         // 10 checks per minute
    default: { windowMs: 60 * 1000, maxRequests: 30 }      // 30 requests per minute
} as const;

type RateLimitAction = keyof typeof RATE_LIMITS;

export class RateLimiter {
    private store: RateLimitStore = {};

    private getKey(ctx: Context, action: RateLimitAction): string {
        return `${ctx.from?.id.toString() || 'anonymous'}-${action}`;
    }

    private clearExpiredEntries() {
        const now = Date.now();
        Object.keys(this.store).forEach(key => {
            if (this.store[key].resetTime < now) {
                delete this.store[key];
            }
        });
    }

    middleware(action: RateLimitAction = 'default'): Middleware<Context> {
        return async (ctx: Context, next: () => Promise<void>) => {
            this.clearExpiredEntries();

            const key = this.getKey(ctx, action);
            const limit = RATE_LIMITS[action] || RATE_LIMITS.default;
            const now = Date.now();

            if (!this.store[key]) {
                this.store[key] = {
                    count: 0,
                    resetTime: now + limit.windowMs
                };
            }

            const record = this.store[key];

            // Reset counter if window has expired
            if (now > record.resetTime) {
                record.count = 0;
                record.resetTime = now + limit.windowMs;
            }

            if (record.count >= limit.maxRequests) {
                const waitTime = Math.ceil((record.resetTime - now) / 1000);
                logger.warn('Rate limit exceeded', { 
                    userId: ctx.from?.id, 
                    action, 
                    waitTime 
                });
                await ctx.reply(
                    `Rate limit exceeded. Please try again in ${waitTime} seconds.`
                );
                return;
            }

            record.count++;
            return next();
        };
    }
}

export const rateLimiter = new RateLimiter();
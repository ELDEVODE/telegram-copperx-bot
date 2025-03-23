import { Context } from 'telegraf';
import type { Middleware } from 'telegraf';
import type { BotContext } from '../types';
import { AuthService } from '../auth/auth.service';
import { logger } from '../utils/logger';

interface BotSession {
    token?: string;
    refreshToken?: string;
    email?: string;
    state?: string;
    sid?: string;
    transferState?: any;
}

declare module 'telegraf' {
    interface Context {
        session?: BotSession;
    }
}

export class AuthMiddleware {
    private static authService = new AuthService();
    private static readonly EXCLUDED_COMMANDS = new Set([
        '/start', 
        '/login', 
        '/help'
    ]);

    static readonly authenticate: Middleware<BotContext> = async (ctx, next) => {
        const message = ctx.message || ctx.callbackQuery;
        if (!message) return next();

        // Skip authentication for excluded commands
        if ('text' in message && AuthMiddleware.EXCLUDED_COMMANDS.has(message.text)) {
            return next();
        }

        if (!ctx.session?.token) {
            await ctx.reply(
                'Please login first using /login command to access this feature.'
            );
            return;
        }

        try {
            // Check if token is about to expire
            if (await AuthMiddleware.authService.isTokenExpiringSoon(ctx.session.token)) {
                if (ctx.session.refreshToken) {
                    try {
                        const newToken = await AuthMiddleware.authService.refreshToken(
                            ctx.session.refreshToken
                        );
                        ctx.session.token = newToken;
                        logger.info('Token refreshed successfully', { 
                            userId: ctx.from?.id 
                        });
                    } catch (refreshError) {
                        logger.error('Token refresh failed', refreshError as Error);
                        ctx.session = {};
                        await ctx.reply(
                            'Your session has expired. Please login again using /login.'
                        );
                        return;
                    }
                } else {
                    ctx.session = {};
                    await ctx.reply(
                        'Your session has expired. Please login again using /login.'
                    );
                    return;
                }
            }

            // Validate the session
            const isValid = await AuthMiddleware.authService.validateSession(
                ctx.session.token
            );
            
            if (!isValid) {
                ctx.session = {};
                await ctx.reply(
                    'Your session is invalid. Please login again using /login.'
                );
                return;
            }

            return next();
        } catch (error) {
            logger.error('Authentication middleware error', error as Error);
            await ctx.reply(
                'An error occurred while validating your session. Please try again later.'
            );
            return;
        }
    };

    static readonly sessionGuard: Middleware<BotContext> = async (ctx, next) => {
        // Initialize session if not exists
        if (!ctx.session) {
            ctx.session = {};
        }
        return next();
    };
}
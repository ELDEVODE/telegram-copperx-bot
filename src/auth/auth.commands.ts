import { Context, Markup } from 'telegraf';
import type { Message } from 'telegraf/types';
import { AuthService } from './auth.service';
import { message } from 'telegraf/filters';
import type { BotContext } from '../types';
import { SessionStore } from '../utils/session-store';
import { logger } from '../utils/logger';
import { RateLimiter } from '../middleware/rate-limit.middleware';

export class AuthCommands {
    private readonly authService: AuthService;
    private readonly sessionStore: SessionStore;
    private readonly rateLimiter = new RateLimiter();
    private readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    constructor(private readonly bot: any) {
        this.authService = new AuthService();
        this.sessionStore = SessionStore.getInstance();
        this.registerHandlers();
    }

    private registerHandlers() {
        // Start authentication flow with rate limiting
        this.bot.command('login', 
            this.rateLimiter.middleware('login'),
            this.handleLoginCommand.bind(this)
        );
        
        // Handle email input with rate limiting
        this.bot.hears(
            this.EMAIL_REGEX,
            this.rateLimiter.middleware('login'),
            this.handleEmailInput.bind(this)
        );
        
        // Handle OTP input with rate limiting
        this.bot.hears(
            /^\d{6}$/,
            this.rateLimiter.middleware('otp'),
            this.handleOTPInput.bind(this)
        );
        
        // Logout command (no rate limiting needed)
        this.bot.command('logout', this.handleLogout.bind(this));

        // KYC status check with rate limiting
        this.bot.command('kyc',
            this.rateLimiter.middleware('kyc'),
            this.handleKycCheck.bind(this)
        );
    }

    private async handleLoginCommand(ctx: BotContext) {
        logger.debug('Login command received', { userId: ctx.from?.id });

        if (ctx.session?.token) {
            const isValid = await this.authService.validateSession(ctx.session.token);
            if (isValid) {
                return ctx.reply('You are already logged in. Use /logout to sign out first.');
            }
            // Clear invalid session
            ctx.session.token = undefined;
            this.sessionStore.removeSession(ctx.from?.id?.toString() || '');
        }

        ctx.session.state = 'AWAITING_EMAIL';
        return ctx.reply(
            'Please enter your CopperX email address:',
            Markup.keyboard([['Cancel']])
            .oneTime()
            .resize()
        );
    }

    private async handleEmailInput(ctx: BotContext) {
        const msg = ctx.message;
        if (ctx.session?.state !== 'AWAITING_EMAIL' || !msg || !('text' in msg)) {
            return;
        }

        const email = msg.text;
        try {
            const otpResponse = await this.authService.requestOTP(email);
            ctx.session.email = email;
            ctx.session.sid = otpResponse.sid; // Store the session ID
            ctx.session.state = 'AWAITING_OTP';
            logger.info('OTP requested', { email });
            
            return ctx.reply(
                'Please enter the 6-digit OTP sent to your email:',
                Markup.keyboard([['Cancel']])
                .oneTime()
                .resize()
            );
        } catch (error: any) {
            logger.error('OTP request failed', error, { email });
            return ctx.reply(
                `Failed to send OTP: ${error.message}`,
                Markup.keyboard([['Try Again']])
                .oneTime()
                .resize()
            );
        }
    }

    private async handleOTPInput(ctx: BotContext) {
        const msg = ctx.message;
        if (ctx.session?.state !== 'AWAITING_OTP' || 
            !ctx.session?.email || 
            !ctx.session?.sid || 
            !msg || !('text' in msg)) {
            return;
        }

        const otp = msg.text;
        try {
            const authData = await this.authService.authenticate(
                ctx.session.email, 
                otp,
                ctx.session.sid
            );
            
            ctx.session.token = authData.accessToken;
            ctx.session.state = undefined;
            ctx.session.email = undefined;
            ctx.session.sid = undefined; // Clear the session ID

            // Store chat ID and token for notifications
            if (ctx.from?.id && authData.user) {
                this.sessionStore.storeSession(
                    authData.user.id,
                    ctx.from.id,
                    authData.accessToken,
                    authData.user.organizationId
                );
                logger.info('User authenticated and session stored', { 
                    userId: authData.user.id,
                    chatId: ctx.from.id,
                    organizationId: authData.user.organizationId
                });
            }

            await ctx.reply(
                'Login successful! 🎉\nWelcome to CopperX Bot.\n\n' +
                'You will receive notifications for deposits and important updates.\n\n' +
                'Use /help to see available commands.',
                Markup.removeKeyboard()
            );

            // Fetch and display user profile
            if (!authData.accessToken) throw new Error('Access token is missing');
            const profile = await this.authService.getProfile(authData.accessToken);
            return ctx.reply(
                `Account Information:\n` +
                `Email: ${profile.email}\n` +
                `KYC Status: ${profile.isKycApproved ? '✅ Approved' : '⏳ Pending'}\n` +
                `Member since: ${new Date(profile.createdAt).toLocaleDateString()}\n\n` +
                `🔔 Deposit notifications are enabled. Use /settings to manage preferences.`
            );
        } catch (error: any) {
            logger.error('Authentication failed', error, { email: ctx.session.email });
            return ctx.reply(
                `Authentication failed: ${error.message}`,
                Markup.keyboard([['Try Again']])
                .oneTime()
                .resize()
            );
        }
    }

    private async handleLogout(ctx: BotContext) {
        if (!ctx.session?.token) {
            return ctx.reply('You are not logged in.');
        }

        // Remove session from store
        if (ctx.from?.id) {
            this.sessionStore.removeSession(ctx.from.id.toString());
            logger.info('User logged out', { userId: ctx.from.id });
        }

        ctx.session = {};
        return ctx.reply(
            'You have been logged out successfully.\nYou will no longer receive notifications.',
            Markup.removeKeyboard()
        );
    }

    private async handleKycCheck(ctx: BotContext) {
        if (!ctx.session?.token) {
            return ctx.reply('You need to be logged in to check your KYC status. Use /login first.');
        }

        try {
            const profile = await this.authService.getProfile(ctx.session.token);
            const kycMessage = `KYC Status Check:\n\n` +
                `Email: ${profile.email}\n` +
                `Status: ${profile.isKycApproved ? '✅ Approved' : '⏳ Pending'}\n` +
                `Last Updated: ${new Date(profile.updatedAt || profile.createdAt).toLocaleDateString()}`;

            if (!profile.isKycApproved) {
                return ctx.reply(
                    `${kycMessage}\n\n` +
                    `Your KYC is not yet approved. Please complete your verification at:\n` +
                    `${process.env.PLATFORM_URL}/kyc`,
                    Markup.inlineKeyboard([
                        Markup.button.url('Complete KYC', `${process.env.PLATFORM_URL}/kyc`)
                    ])
                );
            }

            return ctx.reply(kycMessage);
        } catch (error: any) {
            logger.error('KYC check failed', error);
            return ctx.reply('Failed to check KYC status. Please try again later or contact support.');
        }
    }
}
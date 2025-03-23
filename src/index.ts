import { Telegraf, session, Markup } from 'telegraf';
import * as dotenv from 'dotenv';
import type { BotContext } from './types';
import { AuthCommands } from './auth/auth.commands';
import { WalletCommands } from './wallet/wallet.commands';
import { TransferCommands } from './transfers/transfer.commands';
import { BulkTransferCommands } from './transfers/bulk-transfer.commands';
import { PreferencesCommands } from './commands/preferences.commands';
import { AuthMiddleware } from './middleware/auth.middleware';
import { RateLimitMiddleware } from './middleware/rate-limit.middleware';
import { TelegramConfig, CopperxConfig, ApiEndpoints } from './config';
import { Messages, formatAmount, formatAddress } from './utils/format';
import type { CurrencyCode } from './utils/format';
import { logger } from './utils/logger';
import { SessionStore } from './utils/session-store';
import { PreferencesManager } from './utils/preferences';
import PusherClient from 'pusher-js';
import axios from 'axios';

dotenv.config(); // Load environment variables from .env

const bot = new Telegraf<BotContext>(TelegramConfig.botToken!);
const sessionStore = SessionStore.getInstance();
const prefsManager = PreferencesManager.getInstance();

// Command aliases for better usability
const commandAliases: Record<string, string> = {
    'b': 'balance',
    'w': 'wallets',
    's': 'send',
    'h': 'history',
    'set': 'settings'
};

// Initialize Pusher if credentials are available
let pusher: PusherClient | undefined;
if (CopperxConfig.pusherKey) {
    pusher = new PusherClient(CopperxConfig.pusherKey, {
        cluster: CopperxConfig.pusherCluster,
        authorizer: (channel) => ({
            authorize: async (socketId, callback) => {
                try {
                    const response = await axios.post(
                        `${CopperxConfig.apiUrl}${ApiEndpoints.notifications.auth}`,
                        {
                            socket_id: socketId,
                            channel_name: channel.name
                        },
                        {
                            headers: { 
                                Authorization: `Bearer ${sessionStore.getLatestToken()}` 
                            }
                        }
                    );

                    if (response.data) {
                        callback(null, response.data);
                    } else {
                        callback(new Error('Pusher authentication failed'), null);
                    }
                } catch (error) {
                    logger.error('Pusher authorization error:', error as Error);
                    callback(error as Error, null);
                }
            }
        })
    });
    logger.info('Pusher client initialized with auth configuration');
}

// Session middleware must come first
bot.use(session());

// Register middleware
bot.use(AuthMiddleware.sessionGuard);
bot.use(RateLimitMiddleware.rateLimit);

// Handle command aliases
bot.use((ctx, next) => {
    if (ctx.message && 'text' in ctx.message && ctx.message.text.startsWith('/')) {
        const command = ctx.message.text.split(' ')[0].substring(1);
        if (command in commandAliases) {
            ctx.message.text = `/${commandAliases[command]}${ctx.message.text.substring(command.length + 1)}`;
        }
    }
    return next();
});

// Global error handler with improved logging
bot.catch((err, ctx) => {
    logger.error('Unhandled bot error', err as Error, {
        update: ctx.update,
        userId: ctx.from?.id,
        chatId: ctx.chat?.id
    });
    ctx.reply('An error occurred while processing your request. Please try again.');
});

// Register command handlers
bot.command(['start', 'help'], async (ctx) => {
    logger.debug('Help command accessed', { userId: ctx.from?.id });
    const helpMessage = `
🤖 Welcome to CopperX Bot!

Available commands:
🔑 Authentication
/login - Log in to your CopperX account
/logout - Sign out of your account

💰 Wallet Commands
/balance (or /b) - Check your wallet balances
/wallets (or /w) - View all your wallets
/default_wallet - View or set default wallet

💸 Transfer Commands
/send (or /s) - Send funds to email
/withdraw - Withdraw to external wallet
/history (or /h) - View transfer history

📤 Bulk Transfers
/bulk_transfer - Start bulk transfer via CSV
/bulk_template - Get CSV templates for bulk transfers

⚙️ Settings
/settings (or /set) - Configure your preferences

❓ Help & Support
/help - Show this help message
/support - Get support from CopperX team

Need help? Contact our support team at support@copperx.io
`;
    await ctx.reply(helpMessage);
});

// Support command
bot.command('support', (ctx) => {
    logger.debug('Support command accessed', { userId: ctx.from?.id });
    return ctx.reply('Need help? Contact our support team at support@copperx.io');
});

// Cancel command
bot.command('cancel', (ctx) => {
    if (ctx.session) {
        logger.debug('Operation canceled by user', { 
            userId: ctx.from?.id,
            previousState: ctx.session.state,
            previousTransferState: ctx.session.transferState
        });
        ctx.session.state = undefined;
        ctx.session.transferState = undefined;
    }
    return ctx.reply('Current operation canceled.', Markup.removeKeyboard());
});

// Initialize command handlers
new AuthCommands(bot);
new WalletCommands(bot);
new TransferCommands(bot);
new BulkTransferCommands(bot);
new PreferencesCommands(bot);

// Subscribe to Pusher events if available
if (pusher) {
    logger.info('Setting up Pusher notifications...');

    const subscribeToDeposits = (organizationId: string) => {
        const channelName = `private-org-${organizationId}`;
        const channel = pusher!.subscribe(channelName);
        
        channel.bind('deposit', (data: any) => {
            logger.info('Deposit notification received', { data });
            
            if (data.userId) {
                const chatId = sessionStore.getChatId(data.userId);
                
                if (chatId) {
                    const prefs = prefsManager.getPreferences(data.userId);
                    if (!prefs.notificationsEnabled) {
                        logger.debug('Notifications disabled for user', { userId: data.userId });
                        return;
                    }

                    bot.telegram.sendMessage(
                        chatId,
                        `💰 *New Deposit Received*\n\n` +
                        `Amount: ${formatAmount(data.amount, data.currency as CurrencyCode)} ${data.currency}\n` +
                        `Status: ${data.status}\n` +
                        `Network: ${data.network}\n` +
                        `Transaction: ${formatAddress(data.transactionId)}\n\n` +
                        `_Deposit will be credited after network confirmations._`,
                        { parse_mode: 'Markdown' }
                    ).catch(error => {
                        logger.error('Failed to send deposit notification', error as Error, { 
                            userId: data.userId,
                            chatId,
                            data 
                        });
                    });
                } else {
                    logger.warn('No active session found for deposit notification', {
                        userId: data.userId,
                        data
                    });
                }
            }
        });

        channel.bind('pusher:subscription_succeeded', () => {
            logger.info('Successfully subscribed to channel', { channel: channelName });
        });

        channel.bind('pusher:subscription_error', (error: any) => {
            logger.error('Failed to subscribe to channel', error as Error, { channel: channelName });
        });
    };

    // Subscribe to deposit notifications when user logs in
    bot.on('message', (ctx, next) => {
        if (ctx.session?.token && ctx.from?.id) {
            const userId = ctx.from.id.toString();
            const orgId = sessionStore.getOrganizationId(userId);
            if (orgId) {
                subscribeToDeposits(orgId);
            }
        }
        return next();
    });
}

// Unknown command handler
bot.on('text', (ctx) => {
    if (ctx.message.text.startsWith('/')) {
        logger.debug('Unknown command received', { 
            command: ctx.message.text,
            userId: ctx.from?.id
        });
        return ctx.reply('Unknown command. Use /help to see available commands.');
    }
});

// Graceful stop
const stopBot = () => {
    logger.info('Shutting down bot...');
    if (pusher) {
        pusher.disconnect();
    }
    bot.stop();
    process.exit();
};

process.once('SIGINT', stopBot);
process.once('SIGTERM', stopBot);

// Start bot
bot.launch().then(() => {
    logger.info('🤖 CopperX Bot is running...');
}).catch(error => {
    logger.error('Failed to start bot', error as Error);
    process.exit(1);
});
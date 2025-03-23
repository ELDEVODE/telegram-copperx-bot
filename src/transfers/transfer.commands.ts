import { Markup } from 'telegraf';
import type { Message } from 'telegraf/types';
import { TransferService } from './transfer.service';
import { WalletService } from '../wallet/wallet.service';
import type { BotContext, TransferState } from '../types';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { formatAmount, formatDate, Messages, type CurrencyCode } from '../utils/format';

export class TransferCommands {
    private readonly transferService: TransferService;
    private readonly walletService: WalletService;
    private readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    private readonly AMOUNT_REGEX = /^\d+(\.\d+)?$/;

    constructor(private readonly bot: any) {
        this.transferService = new TransferService();
        this.walletService = new WalletService();
        this.registerHandlers();
    }

    private registerHandlers() {
        // Send funds command
        this.bot.command('send', AuthMiddleware.requireAuth, this.handleSendCommand.bind(this));
        
        // Withdraw funds command
        this.bot.command('withdraw', AuthMiddleware.requireAuth, this.handleWithdrawCommand.bind(this));
        
        // Transfer history command and actions
        this.bot.command('history', AuthMiddleware.requireAuth, this.handleHistoryCommand.bind(this));
        this.bot.action(/^history_page:(\d+)$/, this.handleHistoryPage.bind(this));
        this.bot.action('refresh_history', this.handleRefreshHistory.bind(this));

        // Handle interactive menus
        this.bot.action('send_email', this.startSendToEmail.bind(this));
        this.bot.action('send_withdraw', this.startWithdraw.bind(this));
        
        // Handle email input for sending
        this.bot.hears(this.EMAIL_REGEX, this.handleEmailInput.bind(this));
        
        // Handle amount input
        this.bot.hears(this.AMOUNT_REGEX, this.handleAmountInput.bind(this));
        
        // Handle address input for withdrawal
        this.bot.on('text', this.handleAddressInput.bind(this));

        // Bank withdrawal command
        this.bot.command('withdraw_bank', AuthMiddleware.requireAuth, this.handleBankWithdrawCommand.bind(this));
        this.bot.action('withdraw_bank', this.handleBankWithdrawCommand.bind(this));

        // Transfer quote actions
        this.bot.action(/^confirm_quote:(.+)$/, this.handleQuoteConfirmation.bind(this));
        this.bot.action('cancel_quote', this.handleQuoteCancel.bind(this));
    }

    private async handleSendCommand(ctx: BotContext) {
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('📧 Send to Email', 'send_email')],
            [Markup.button.callback('💱 Withdraw to Wallet', 'send_withdraw')]
        ]);

        return ctx.reply('Choose a transfer method:', keyboard);
    }

    private async startSendToEmail(ctx: BotContext) {
        if (!ctx.session) return;

        ctx.session.transferState = {
            type: 'EMAIL',
            step: 'AWAITING_EMAIL',
            data: {}
        };

        const keyboard = Markup.inlineKeyboard([[
            Markup.button.callback('❌ Cancel', 'cancel_transfer')
        ]]);

        await ctx.editMessageText(
            'Please enter the recipient\'s email address:',
            { reply_markup: keyboard.reply_markup }
        );
    }

    private async handleEmailInput(ctx: BotContext) {
        const message = ctx.message as Message.TextMessage;
        if (!ctx.session?.transferState || 
            ctx.session.transferState.step !== 'AWAITING_EMAIL' || 
            !message?.text) {
            return;
        }

        const email = message.text;
        ctx.session.transferState.data.recipientEmail = email;
        ctx.session.transferState.step = 'AWAITING_AMOUNT';

        // Get available balances
        try {
            const balances = await this.walletService.getBalances(ctx.session.token!);
            const message = Object.entries(balances as Record<CurrencyCode, string>)
                .map(([currency, balance]) => `${currency}: ${formatAmount(balance, currency as CurrencyCode)}`)
                .join('\n');

            const keyboard = Markup.inlineKeyboard([[
                Markup.button.callback('❌ Cancel', 'cancel_transfer')
            ]]);

            await ctx.reply(
                `Available balances:\n${message}\n\nPlease enter the amount to send:`,
                { reply_markup: keyboard.reply_markup }
            );
        } catch (error) {
            ctx.session.transferState = undefined;
            return ctx.reply('Failed to fetch balances. Please try again.');
        }
    }

    private async handleAmountInput(ctx: BotContext) {
        const message = ctx.message as Message.TextMessage;
        if (!ctx.session?.transferState || !message?.text) {
            return;
        }

        const amount = message.text;
        if (ctx.session.transferState.type === 'EMAIL') {
            try {
                const currency: CurrencyCode = 'USD'; // Default currency
                const transfer = await this.transferService.sendToEmail(
                    ctx.session.token!,
                    {
                        recipientEmail: ctx.session.transferState.data.recipientEmail!,
                        amount,
                        currency
                    }
                );

                ctx.session.transferState = undefined;
                return ctx.reply(
                    `✅ Transfer successful!\n\n` +
                    `Amount: ${formatAmount(transfer.amount, transfer.currency as CurrencyCode)} ${transfer.currency}\n` +
                    `To: ${transfer.recipientEmail}\n` +
                    `Status: ${transfer.status}\n` +
                    `Date: ${formatDate(transfer.createdAt)}`,
                    { reply_markup: { remove_keyboard: true } }
                );
            } catch (error: any) {
                return ctx.reply(`❌ Transfer failed: ${error.message}`);
            }
        }
    }

    private async handleHistoryCommand(ctx: BotContext) {
        try {
            const { transfers, total, page, limit } = await this.transferService.getTransferHistory(
                ctx.session.token!,
                1, // Start with first page
                10  // Show 10 transfers per page
            );

            if (!transfers.length) {
                return ctx.reply('No transfer history available.');
            }

            const totalPages = Math.ceil(total / limit);
            const message = transfers.map(transfer => formatTransferHistory(transfer)).join('\n\n');

            return ctx.reply(
                `📊 Recent Transfers (Page ${page}/${totalPages}):\n\n${message}`,
                Markup.inlineKeyboard([
                    ...(totalPages > 1 ? [
                        [Markup.button.callback('Next Page ➡️', `history_page:${page + 1}`)]
                    ] : []),
                    [Markup.button.callback('🔄 Refresh', 'refresh_history')],
                    [Markup.button.callback('🏠 Main Menu', 'show_main')]
                ])
            );
        } catch (error: any) {
            logger.error('Failed to fetch transfer history', error);
            return ctx.reply(`Failed to fetch transfer history: ${error.message}`);
        }
    }

    private async showHistoryPage(ctx: BotContext, page: number) {
        try {
            const { transfers, total, limit } = await this.transferService.getTransferHistory(
                ctx.session.token!,
                page
            );

            if (!transfers.length) {
                return ctx.reply('No transfer history available.');
            }

            const totalPages = Math.ceil(total / limit);
            const message = transfers.map(transfer => 
                `💸 ${transfer.type}\n` +
                `Amount: ${formatAmount(transfer.amount, transfer.currency as CurrencyCode)} ${transfer.currency}\n` +
                `Status: ${transfer.status}\n` +
                `Date: ${formatDate(transfer.createdAt)}\n` +
                `${transfer.recipientEmail ? `To: ${transfer.recipientEmail}` : 
                  transfer.recipientAddress ? `To: ${transfer.recipientAddress}` : ''}\n`
            ).join('\n');

            const buttons = [];
            if (page > 1) {
                buttons.push(Markup.button.callback('⬅️ Previous', `history_page:${page - 1}`));
            }
            if (page < totalPages) {
                buttons.push(Markup.button.callback('➡️ Next', `history_page:${page + 1}`));
            }

            const keyboard = buttons.length ? Markup.inlineKeyboard(buttons) : undefined;

            await ctx.reply(
                `Transfer History (Page ${page}/${totalPages}):\n\n${message}`,
                keyboard
            );
        } catch (error: any) {
            return ctx.reply(`Failed to fetch transfer history: ${error.message}`);
        }
    }

    private async handleHistoryPage(ctx: BotContext) {
        const match = ctx.match?.[1];
        if (!match) return;

        const page = parseInt(match);
        
        try {
            const { transfers, total, limit } = await this.transferService.getTransferHistory(
                ctx.session.token!,
                page,
                10
            );

            if (!transfers.length) {
                await ctx.answerCbQuery('No more transfers to show');
                return;
            }

            const totalPages = Math.ceil(total / limit);
            const message = transfers.map(transfer => formatTransferHistory(transfer)).join('\n\n');

            const buttons = [];
            if (page > 1) {
                buttons.push(Markup.button.callback('⬅️ Previous', `history_page:${page - 1}`));
            }
            if (page < totalPages) {
                buttons.push(Markup.button.callback('Next ➡️', `history_page:${page + 1}`));
            }

            await ctx.editMessageText(
                `📊 Recent Transfers (Page ${page}/${totalPages}):\n\n${message}`,
                Markup.inlineKeyboard([
                    buttons,
                    [Markup.button.callback('🔄 Refresh', 'refresh_history')],
                    [Markup.button.callback('🏠 Main Menu', 'show_main')]
                ].filter(row => row.length > 0))
            );
            await ctx.answerCbQuery();
        } catch (error: any) {
            logger.error('Failed to fetch transfer history page', error);
            await ctx.answerCbQuery(`Failed to load page: ${error.message}`);
        }
    }

    private async handleWithdrawCommand(ctx: BotContext) {
        if (!ctx.session) return;

        try {
            const wallets = await this.walletService.getWallets(ctx.session.token!);
            if (!wallets.length) {
                return ctx.reply('You don\'t have any wallets available for withdrawal.');
            }

            const balances = await this.walletService.getBalances(ctx.session.token!);
            const balanceMessage = Object.entries(balances as Record<CurrencyCode, string>)
                .map(([currency, balance]) => `${currency}: ${formatAmount(balance, currency as CurrencyCode)}`)
                .join('\n');

            ctx.session.transferState = {
                type: 'WITHDRAW',
                step: 'AWAITING_ADDRESS',
                data: {}
            };

            const keyboard = Markup.inlineKeyboard([[
                Markup.button.callback('❌ Cancel', 'cancel_transfer')
            ]]);

            return ctx.reply(
                `Available balances:\n${balanceMessage}\n\n` +
                'Please enter the recipient wallet address:',
                { reply_markup: keyboard.reply_markup }
            );
        } catch (error: any) {
            return ctx.reply(`Failed to start withdrawal: ${error.message}`);
        }
    }

    private async handleAddressInput(ctx: BotContext) {
        const message = ctx.message as Message.TextMessage;
        if (!ctx.session?.transferState || 
            ctx.session.transferState.type !== 'WITHDRAW' || 
            ctx.session.transferState.step !== 'AWAITING_ADDRESS' || 
            !message?.text) {
            return;
        }

        const address = message.text;
        if (address === 'Cancel') {
            ctx.session.transferState = undefined;
            return ctx.reply('Withdrawal cancelled.', { reply_markup: { remove_keyboard: true } });
        }

        ctx.session.transferState.data.recipientAddress = address;
        ctx.session.transferState.step = 'AWAITING_AMOUNT';

        const keyboard = Markup.inlineKeyboard([[
            Markup.button.callback('❌ Cancel', 'cancel_transfer')
        ]]);

        return ctx.reply(
            'Please enter the amount to withdraw:',
            { reply_markup: keyboard.reply_markup }
        );
    }

    private async startWithdraw(ctx: BotContext) {
        if (!ctx.session) return;

        try {
            const wallets = await this.walletService.getWallets(ctx.session.token!);
            if (!wallets.length) {
                return ctx.editMessageText('You don\'t have any wallets available for withdrawal.');
            }

            const balances = await this.walletService.getBalances(ctx.session.token!);
            const balanceMessage = Object.entries(balances as Record<CurrencyCode, string>)
                .map(([currency, balance]) => `${currency}: ${formatAmount(balance, currency as CurrencyCode)}`)
                .join('\n');

            ctx.session.transferState = {
                type: 'WITHDRAW',
                step: 'AWAITING_ADDRESS',
                data: {}
            };

            const keyboard = Markup.inlineKeyboard([[
                Markup.button.callback('❌ Cancel', 'cancel_transfer')
            ]]);

            return ctx.editMessageText(
                `Available balances:\n${balanceMessage}\n\n` +
                'Please enter the recipient wallet address:',
                { reply_markup: keyboard.reply_markup }
            );
        } catch (error: any) {
            return ctx.editMessageText(`Failed to start withdrawal: ${error.message}`);
        }
    }

    private async handleBankWithdrawCommand(ctx: BotContext) {
        if (!ctx.session) return;

        try {
            // Get bank account details and show transfer options
            const keyboard = Markup.inlineKeyboard([
                [Markup.button.url('🏦 Complete Bank KYC', `${process.env.PLATFORM_URL}/kyc`)],
                [Markup.button.callback('❌ Cancel', 'cancel_transfer')]
            ]);

            await ctx.reply(
                'To withdraw funds to your bank account, you need to complete the bank KYC process first. ' +
                'Please click the button below to complete your KYC.',
                keyboard
            );
        } catch (error: any) {
            return ctx.reply(`Failed to start bank withdrawal: ${error.message}`);
        }
    }

    private async handleQuoteConfirmation(ctx: BotContext) {
        const match = ctx.match?.[1];
        if (!match || !ctx.session?.token) return;

        try {
            const [quotePayload, quoteSignature] = match.split(':');
            
            const transfer = await this.transferService.withdrawToBank(
                ctx.session.token,
                {
                    quotePayload,
                    quoteSignature
                }
            );

            await ctx.editMessageText(
                `✅ Bank withdrawal initiated!\n\n${formatTransferHistory(transfer)}`,
                Markup.inlineKeyboard([[
                    Markup.button.callback('🏠 Main Menu', 'show_main')
                ]])
            );
        } catch (error: any) {
            logger.error('Bank withdrawal failed', error);
            await ctx.editMessageText(
                `❌ Bank withdrawal failed: ${error.message}`,
                Markup.inlineKeyboard([[
                    Markup.button.callback('🔄 Try Again', 'withdraw_bank'),
                    Markup.button.callback('🏠 Main Menu', 'show_main')
                ]])
            );
        }
    }

    private async handleQuoteCancel(ctx: BotContext) {
        await ctx.editMessageText(
            '❌ Bank withdrawal cancelled.',
            Markup.inlineKeyboard([[
                Markup.button.callback('🏠 Main Menu', 'show_main')
            ]])
        );
    }

    private async handleRefreshHistory(ctx: BotContext) {
        await ctx.answerCbQuery('Refreshing transfer history...');
        await this.handleHistoryCommand(ctx);
    }
}
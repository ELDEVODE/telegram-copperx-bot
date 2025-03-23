import type { BotContext } from '../types';
import { MenuBuilder } from '../utils/menus';
import { TransferService } from '../transfers/transfer.service';
import { PreferencesManager } from '../utils/preferences';
import { isValidEmail, isValidAmount, isValidWalletAddress } from '../utils/validation';
import { formatAmount, Messages, formatAddress, type CurrencyCode } from '../utils/format';
import { logger } from '../utils/logger';
import { Markup } from 'telegraf';

// Extend BotContext to include match property from regex matches
declare module '../types' {
    interface BotContext {
        match?: RegExpExecArray | null;
    }
}

interface TransferStateData {
    recipientEmail?: string;
    recipientAddress?: string;
    amount?: string;
    currency?: CurrencyCode;
    network?: string;
    fee?: string;
    feeCurrency?: string;
    total?: string;
}

type TransferStep = 
    | 'AWAITING_EMAIL'
    | 'AWAITING_ADDRESS'
    | 'AWAITING_AMOUNT'
    | 'AWAITING_CURRENCY'
    | 'AWAITING_NETWORK';

type TransferType = 'EMAIL' | 'WITHDRAW';

interface TransferState {
    type: TransferType;
    step: TransferStep;
    data: TransferStateData;
}

export class TransferMenuHandler {
    private readonly transferService: TransferService;
    private readonly prefsManager: PreferencesManager;

    constructor(private readonly bot: any) {
        this.transferService = new TransferService();
        this.prefsManager = PreferencesManager.getInstance();
        this.registerHandlers();
    }

    private registerHandlers() {
        // Transfer type selection
        this.bot.action('send_email', this.handleEmailTransferStart.bind(this));
        this.bot.action('send_withdraw', this.handleWalletTransferStart.bind(this));
        this.bot.action('bulk_transfer', this.handleBulkTransferStart.bind(this));

        // Currency selection
        this.bot.action(/^select_currency:(.+)$/, this.handleCurrencySelection.bind(this));
        
        // Network selection
        this.bot.action(/^select_network:(.+)$/, this.handleNetworkSelection.bind(this));
        
        // Confirmation handlers
        this.bot.action('confirm_transfer', this.handleTransferConfirmation.bind(this));
        this.bot.action('edit_transfer', this.handleTransferEdit.bind(this));
        this.bot.action('cancel_transfer', this.handleTransferCancel.bind(this));
    }

    private async handleEmailTransferStart(ctx: BotContext) {
        ctx.session.transferState = {
            type: 'EMAIL',
            step: 'AWAITING_EMAIL',
            data: {}
        };

        await ctx.editMessageText(
            Messages.prompts.enterEmail,
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Cancel', 'cancel_transfer')]
            ])
        );

        // Register one-time handler for email input
        this.registerNextStep(ctx, this.handleEmailInput.bind(this));
    }

    private async handleWalletTransferStart(ctx: BotContext) {
        ctx.session.transferState = {
            type: 'WITHDRAW',
            step: 'AWAITING_ADDRESS',
            data: {}
        };

        await ctx.editMessageText(
            Messages.prompts.enterAddress,
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Cancel', 'cancel_transfer')]
            ])
        );

        // Register one-time handler for address input
        this.registerNextStep(ctx, this.handleAddressInput.bind(this));
    }

    private async handleBulkTransferStart(ctx: BotContext) {
        await ctx.editMessageText(
            'To perform bulk transfers, please upload a CSV file with the following format:\n\n' +
            'For email transfers:\n' +
            'email,amount,currency\n' +
            'recipient@example.com,100,USD\n\n' +
            'For wallet transfers:\n' +
            'address,amount,currency,network\n' +
            '0x1234...,0.1,ETH,ethereum\n\n' +
            'Maximum 50 transfers per file.',
            Markup.inlineKeyboard([
                [Markup.button.callback('📥 Get Template', 'get_bulk_template')],
                [Markup.button.callback('❌ Cancel', 'cancel_transfer')]
            ])
        );
    }

    private async handleEmailInput(ctx: BotContext) {
        if (!ctx.message || !('text' in ctx.message) || !ctx.session?.transferState) return;

        const email = ctx.message.text.trim();
        if (isValidEmail(email)) {
            ctx.session.transferState.data.recipientEmail = email;
            await this.promptForAmount(ctx);
        } else {
            await ctx.reply(
                Messages.errors.invalidEmail,
                Markup.inlineKeyboard([
                    [Markup.button.callback('❌ Cancel', 'cancel_transfer')]
                ])
            );
            this.registerNextStep(ctx, this.handleEmailInput.bind(this));
        }
    }

    private async handleAddressInput(ctx: BotContext) {
        if (!ctx.message || !('text' in ctx.message) || !ctx.session?.transferState) return;

        const address = ctx.message.text.trim();
        // Note: Network validation will happen later when network is selected
        if (address) {
            ctx.session.transferState.data.recipientAddress = address;
            await this.promptForCurrency(ctx);
        } else {
            await ctx.reply(
                Messages.errors.invalidAddress,
                Markup.inlineKeyboard([
                    [Markup.button.callback('❌ Cancel', 'cancel_transfer')]
                ])
            );
            this.registerNextStep(ctx, this.handleAddressInput.bind(this));
        }
    }

    private async promptForAmount(ctx: BotContext) {
        if (!ctx.session?.transferState) return;

        const currency = ctx.session.transferState.data.currency!;
        const minAmount = this.transferService.getMinimumAmount(currency);

        ctx.session.transferState.step = 'AWAITING_AMOUNT';
        await ctx.reply(
            `${Messages.prompts.enterAmount}\n` +
            `\nMinimum amount: ${formatAmount(minAmount, currency)} ${currency}`,
            Markup.inlineKeyboard([
                [Markup.button.callback('❌ Cancel', 'cancel_transfer')]
            ])
        );
        this.registerNextStep(ctx, this.handleAmountInput.bind(this));
    }

    private async handleAmountInput(ctx: BotContext) {
        if (!ctx.message || !('text' in ctx.message) || !ctx.session?.transferState) return;

        const amount = ctx.message.text.trim();
        const currency = ctx.session.transferState.data.currency;
        
        // Check minimum amount first
        const minAmountValidation = this.transferService.validateMinimumAmount(amount, currency!);
        if (!minAmountValidation.isValid) {
            await ctx.reply(
                `❌ ${minAmountValidation.error}\nPlease try again.`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('❌ Cancel', 'cancel_transfer')]
                ])
            );
            this.registerNextStep(ctx, this.handleAmountInput.bind(this));
            return;
        }

        // Then check valid amount format
        if (currency && isValidAmount(amount, currency)) {
            ctx.session.transferState.data.amount = amount;

            if (ctx.session.transferState.type === 'EMAIL') {
                await this.promptForCurrency(ctx);
            } else {
                await this.promptForNetwork(ctx);
            }
        } else {
            await ctx.reply(
                Messages.errors.invalidAmount,
                Markup.inlineKeyboard([
                    [Markup.button.callback('❌ Cancel', 'cancel_transfer')]
                ])
            );
            this.registerNextStep(ctx, this.handleAmountInput.bind(this));
        }
    }

    private async promptForCurrency(ctx: BotContext) {
        if (!ctx.session?.transferState) return;

        ctx.session.transferState.step = 'AWAITING_CURRENCY';
        const prefs = this.prefsManager.getPreferences(ctx.from!.id.toString());
        
        await ctx.reply(
            Messages.prompts.selectCurrency,
            MenuBuilder.currencyMenu(ctx.from!.id.toString(), 'select_currency')
        );
    }

    private async promptForNetwork(ctx: BotContext) {
        if (!ctx.session?.transferState) return;

        ctx.session.transferState.step = 'AWAITING_NETWORK';
        // Network options depend on the selected currency
        const networks = this.getNetworksForCurrency(ctx.session.transferState.data.currency!);
        
        const buttons = networks.map(network => [
            Markup.button.callback(network, `select_network:${network}`)
        ]);
        buttons.push([Markup.button.callback('❌ Cancel', 'cancel_transfer')]);

        await ctx.reply(
            'Select the network for the transfer:',
            Markup.inlineKeyboard(buttons)
        );
    }

    private async showTransferConfirmation(ctx: BotContext) {
        if (!ctx.session?.transferState) return;
        const state = ctx.session.transferState;

        try {
            // Calculate fees before showing confirmation
            const feeData = await this.transferService.calculateFee(ctx.session.token!, {
                amount: state.data.amount!,
                currency: state.data.currency!,
                type: state.type,
                network: state.data.network
            });

            // Ensure we cast currency codes to the proper type
            const feeCurrency = feeData.feeCurrency as CurrencyCode;
            
            const message = `
Please review your transfer details:

💰 Amount: ${formatAmount(state.data.amount!, state.data.currency!)} ${state.data.currency}
📨 To: ${state.data.recipientEmail || formatAddress(state.data.recipientAddress!)}
${state.data.network ? `🌐 Network: ${state.data.network}` : ''}
💵 Fee: ${formatAmount(feeData.fee, feeCurrency)} ${feeCurrency}
💳 Total: ${formatAmount(feeData.total, state.data.currency!)} ${state.data.currency}

⚠️ Please verify all details carefully before confirming.
❓ The transfer cannot be reversed once confirmed.`;

            await ctx.reply(
                message,
                Markup.inlineKeyboard([
                    [
                        Markup.button.callback('✅ Confirm', 'confirm_transfer'),
                        Markup.button.callback('✏️ Edit', 'edit_transfer')
                    ],
                    [Markup.button.callback('❌ Cancel', 'cancel_transfer')]
                ])
            );

            // Store fee information for use in confirmation
            ctx.session.transferState.data.fee = feeData.fee;
            ctx.session.transferState.data.feeCurrency = feeData.feeCurrency;
            ctx.session.transferState.data.total = feeData.total;

        } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to calculate fees';
            logger.error('Fee calculation failed', error instanceof Error ? error : new Error(errorMessage));
            await ctx.reply(
                `❌ ${errorMessage}\nPlease try again or contact support if the issue persists.`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('🔄 Try Again', 'show_send_options')],
                    [Markup.button.callback('🏠 Main Menu', 'show_main')]
                ])
            );
        }
    }

    private async handleTransferConfirmation(ctx: BotContext) {
        if (!ctx.session?.transferState) return;
        const state = ctx.session.transferState;

        try {
            let result;

            // Common transfer parameters
            const transferData = {
                amount: state.data.amount!,
                currency: state.data.currency!,
                fee: state.data.fee,
                feeCurrency: state.data.feeCurrency,
                total: state.data.total,
                purposeCode: 'self'
            };

            if (state.data.recipientEmail) {
                result = await this.transferService.sendToEmail(
                    ctx.session.token!,
                    {
                        ...transferData,
                        recipientEmail: state.data.recipientEmail,
                    }
                );
            } else if (state.data.recipientAddress && state.data.network) {
                result = await this.transferService.withdrawToWallet(
                    ctx.session.token!,
                    {
                        ...transferData,
                        walletAddress: state.data.recipientAddress,
                        network: state.data.network
                    }
                );
            } else {
                throw new Error('Invalid transfer state');
            }

            // Show success message with transaction details
            await ctx.editMessageText(
                `✅ Transfer successful!\n\n` +
                `Amount: ${formatAmount(result.amount, result.currency as CurrencyCode)} ${result.currency}\n` +
                `Fee: ${formatAmount(result.totalFee, result.feeCurrency as CurrencyCode)} ${result.feeCurrency}\n` +
                `Total: ${formatAmount(result.amountSubtotal, result.currency as CurrencyCode)} ${result.currency}\n` +
                `To: ${state.data.recipientEmail || formatAddress(state.data.recipientAddress!)}\n` +
                `Transaction ID: ${result.id}\n` +
                `Status: ${result.status}`,
                MenuBuilder.mainMenu()
            );

            // Clear transfer state
            ctx.session.transferState = undefined;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            logger.error('Transfer failed', error instanceof Error ? error : new Error(errorMessage));
            await ctx.editMessageText(
                `❌ Transfer failed: ${errorMessage}\n` +
                'Please verify your balance and try again, or contact support if the issue persists.',
                Markup.inlineKeyboard([
                    [Markup.button.callback('🔄 Try Again', 'show_send_options')],
                    [Markup.button.callback('🏠 Main Menu', 'show_main')]
                ])
            );
        }
    }

    private async handleTransferEdit(ctx: BotContext) {
        await ctx.editMessageText(
            'What would you like to edit?',
            Markup.inlineKeyboard([
                [Markup.button.callback('💱 Currency', 'edit_currency')],
                [Markup.button.callback('💰 Amount', 'edit_amount')],
                [Markup.button.callback('👤 Recipient', 'edit_recipient')],
                [Markup.button.callback('❌ Cancel', 'cancel_transfer')]
            ])
        );
    }

    private async handleTransferCancel(ctx: BotContext) {
        ctx.session.transferState = undefined;
        await ctx.editMessageText(
            '❌ Transfer cancelled. What would you like to do?',
            MenuBuilder.mainMenu()
        );
    }

    private registerNextStep(ctx: BotContext, handler: Function) {
        const userId = ctx.from!.id;
        this.bot.use((ctx: BotContext, next: Function) => {
            if (ctx.from?.id === userId && ctx.message && 'text' in ctx.message) {
                return handler(ctx);
            }
            return next();
        });
    }

    private getNetworksForCurrency(currency: string): string[] {
        // This would ideally come from a configuration or API
        const networks: Record<string, string[]> = {
            ETH: ['ethereum', 'arbitrum', 'optimism'],
            USDT: ['ethereum', 'tron', 'bsc'],
            BTC: ['bitcoin', 'lightning']
        };
        return networks[currency] || [];
    }

    private async handleCurrencySelection(ctx: BotContext) {
        if (!ctx.session?.transferState) return;

        const match = ctx.match && ctx.match[1];
        if (!match) return;

        ctx.session.transferState.data.currency = match as CurrencyCode;
        
        if (ctx.session.transferState.type === 'EMAIL') {
            await this.showTransferConfirmation(ctx);
        } else {
            await this.promptForNetwork(ctx);
        }
    }

    private async handleNetworkSelection(ctx: BotContext) {
        if (!ctx.session?.transferState) return;

        const match = ctx.match && ctx.match[1];
        if (!match) return;

        ctx.session.transferState.data.network = match;
        await this.showTransferConfirmation(ctx);
    }
}
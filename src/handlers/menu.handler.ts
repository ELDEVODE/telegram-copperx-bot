import { BotContext } from '../types';
import { MenuBuilder } from '../utils/menus';
import { WalletService } from '../wallet/wallet.service';
import { TransferService } from '../transfers/transfer.service';
import { PreferencesManager } from '../utils/preferences';
import { formatAmount, formatDate } from '../utils/format';
import { logger } from '../utils/logger';

export class MenuHandler {
    private readonly walletService: WalletService;
    private readonly transferService: TransferService;
    private readonly prefsManager: PreferencesManager;

    constructor(private readonly bot: any) {
        this.walletService = new WalletService();
        this.transferService = new TransferService();
        this.prefsManager = PreferencesManager.getInstance();
        this.registerHandlers();
    }

    private registerHandlers() {
        // Main menu handlers
        this.bot.action('show_main', this.handleShowMain.bind(this));
        this.bot.action('show_balance', this.handleShowBalance.bind(this));
        this.bot.action('show_send_options', this.handleShowSendOptions.bind(this));
        this.bot.action('show_receive', this.handleShowReceive.bind(this));
        this.bot.action('show_settings', this.handleShowSettings.bind(this));
        this.bot.action('show_history', this.handleShowHistory.bind(this));

        // Generic handlers
        this.bot.action('cancel_action', this.handleCancel.bind(this));
        this.bot.action('noop', (ctx: BotContext) => ctx.answerCbQuery());
    }

    private async handleShowMain(ctx: BotContext) {
        try {
            await ctx.editMessageText(
                '🏠 Main Menu\nSelect an option:',
                MenuBuilder.mainMenu()
            );
        } catch (error) {
            logger.error('Failed to show main menu', error as Error);
            await ctx.reply('Failed to show menu. Please try again.');
        }
    }

    private async handleShowBalance(ctx: BotContext) {
        try {
            const balances = await this.walletService.getBalances(ctx.session.token!);
            const message = Object.entries(balances)
                .map(([currency, balance]) => `${currency}: ${formatAmount(balance)}`)
                .join('\n');

            await ctx.editMessageText(
                `💰 Your Balances:\n\n${message}`,
                MenuBuilder.mainMenu()
            );
        } catch (error) {
            logger.error('Failed to show balances', error as Error);
            await ctx.reply('Failed to fetch balances. Please try again.');
        }
    }

    private async handleShowSendOptions(ctx: BotContext) {
        try {
            await ctx.editMessageText(
                '💸 Send Funds\nChoose a transfer method:',
                MenuBuilder.sendOptions()
            );
        } catch (error) {
            logger.error('Failed to show send options', error as Error);
            await ctx.reply('Failed to show transfer options. Please try again.');
        }
    }

    private async handleShowReceive(ctx: BotContext) {
        try {
            const wallets = await this.walletService.getWallets(ctx.session.token!);
            const defaultWallet = wallets.find(w => w.isDefault);

            if (!defaultWallet) {
                await ctx.editMessageText(
                    '❌ No default wallet found. Please set up a wallet first.',
                    MenuBuilder.mainMenu()
                );
                return;
            }

            await ctx.editMessageText(
                `📥 Your Deposit Address\n\n` +
                `Network: ${defaultWallet.network}\n` +
                `Address: ${defaultWallet.address}\n\n` +
                `Note: Only send ${defaultWallet.currency} to this address.`,
                MenuBuilder.mainMenu()
            );
        } catch (error) {
            logger.error('Failed to show receive info', error as Error);
            await ctx.reply('Failed to fetch wallet information. Please try again.');
        }
    }

    private async handleShowSettings(ctx: BotContext) {
        try {
            if (!ctx.from?.id) return;

            const prefs = this.prefsManager.getPreferences(ctx.from.id.toString());
            await ctx.editMessageText(
                '⚙️ Settings\nCustomize your preferences:',
                MenuBuilder.settingsMenu(prefs)
            );
        } catch (error) {
            logger.error('Failed to show settings', error as Error);
            await ctx.reply('Failed to load settings. Please try again.');
        }
    }

    private async handleShowHistory(ctx: BotContext) {
        try {
            const { transfers, total, page, limit } = await this.transferService.getTransferHistory(
                ctx.session.token!,
                1
            );

            if (!transfers.length) {
                await ctx.editMessageText(
                    'No transfer history available.',
                    MenuBuilder.mainMenu()
                );
                return;
            }

            const totalPages = Math.ceil(total / limit);
            const message = transfers.map(transfer => 
                `💸 ${transfer.type}\n` +
                `Amount: ${formatAmount(transfer.amount)} ${transfer.currency}\n` +
                `Status: ${transfer.status}\n` +
                `Date: ${formatDate(transfer.createdAt)}\n` +
                `${transfer.recipientEmail ? `To: ${transfer.recipientEmail}` : 
                  transfer.recipientAddress ? `To: ${transfer.recipientAddress}` : ''}\n`
            ).join('\n');

            await ctx.editMessageText(
                `Transfer History:\n\n${message}`,
                MenuBuilder.paginationMenu(page, totalPages, 'history_page')
            );
        } catch (error) {
            logger.error('Failed to show transfer history', error as Error);
            await ctx.reply('Failed to fetch transfer history. Please try again.');
        }
    }

    private async handleCancel(ctx: BotContext) {
        try {
            if (ctx.session) {
                ctx.session.state = undefined;
                ctx.session.transferState = undefined;
            }

            await ctx.editMessageText(
                'Operation cancelled. What would you like to do?',
                MenuBuilder.mainMenu()
            );
        } catch (error) {
            logger.error('Failed to cancel operation', error as Error);
            await ctx.reply('Failed to cancel operation. Please try again.');
        }
    }
}
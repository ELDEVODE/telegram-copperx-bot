import { Markup } from 'telegraf';
import { WalletService } from './wallet.service';
import { BotContext } from '../types';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { MenuBuilder } from '../utils/menus';
import { PreferencesManager } from '../utils/preferences';
import { formatBalance, formatAddress } from '../utils/format';
import { logger } from '../utils/logger';

export class WalletCommands {
    private readonly walletService: WalletService;
    private readonly prefsManager: PreferencesManager;

    constructor(private readonly bot: any) {
        this.walletService = new WalletService();
        this.prefsManager = PreferencesManager.getInstance();
        this.registerHandlers();
    }

    private registerHandlers() {
        // Wallet commands
        this.bot.command(['balance', 'b'], AuthMiddleware.requireAuth, this.handleBalanceCommand.bind(this));
        this.bot.command(['wallets', 'w'], AuthMiddleware.requireAuth, this.handleWalletsCommand.bind(this));
        this.bot.command('default_wallet', AuthMiddleware.requireAuth, this.handleDefaultWalletCommand.bind(this));

        // Wallet action handlers
        this.bot.action(/^set_default_wallet:(.+)$/, this.handleSetDefaultWallet.bind(this));
        this.bot.action(/^show_wallet:(.+)$/, this.handleShowWalletDetails.bind(this));
        this.bot.action('refresh_balances', this.handleRefreshBalances.bind(this));
    }

    private async handleBalanceCommand(ctx: BotContext) {
        try {
            const balances = await this.walletService.getBalances(ctx.session.token!);
            
            const keyboard = Markup.inlineKeyboard([
                [
                    Markup.button.callback('🔄 Refresh', 'refresh_balances'),
                    Markup.button.callback('📥 Deposit', 'show_deposit')
                ],
                [Markup.button.callback('🏠 Main Menu', 'show_main')]
            ]);

            await ctx.reply(
                `💰 Your Balances:\n\n${formatBalance(balances)}`,
                keyboard
            );
        } catch (error) {
            logger.error('Failed to fetch balances', error as Error);
            await ctx.reply('Failed to fetch balances. Please try again.');
        }
    }

    private async handleWalletsCommand(ctx: BotContext) {
        try {
            const wallets = await this.walletService.getWallets(ctx.session.token!);
            
            const buttons = wallets.map(wallet => [
                Markup.button.callback(
                    `${wallet.isDefault ? '✅ ' : ''}${wallet.network}`,
                    `show_wallet:${wallet.id}`
                )
            ]);
            
            buttons.push([Markup.button.callback('🏠 Main Menu', 'show_main')]);
    
            await ctx.reply(
                '🏦 Your Wallets:\n\nSelect a wallet to view details:',
                Markup.inlineKeyboard(buttons)
            );
        } catch (error) {
            logger.error('Failed to fetch wallets', error as Error);
            await ctx.reply('Failed to fetch wallets. Please try again.');
        }
    }

    private async handleDefaultWalletCommand(ctx: BotContext) {
        try {
            const wallets = await this.walletService.getWallets(ctx.session.token!);
            const buttons = wallets.map(wallet => [
                Markup.button.callback(
                    `${wallet.isDefault ? '✅ ' : ''}${wallet.currency} - ${wallet.network}`,
                    `set_default_wallet:${wallet.id}`
                )
            ]);

            buttons.push([Markup.button.callback('🏠 Main Menu', 'show_main')]);

            await ctx.reply(
                'Select your default wallet:',
                Markup.inlineKeyboard(buttons)
            );
        } catch (error) {
            logger.error('Failed to fetch wallets for default selection', error as Error);
            await ctx.reply('Failed to load wallets. Please try again.');
        }
    }

    private async handleSetDefaultWallet(ctx: BotContext) {
        try {
            const walletId = ctx.match![1];
            await this.walletService.setDefaultWallet(ctx.session.token!, walletId);
            
            await ctx.answerCbQuery('Default wallet updated successfully!');
            await this.handleWalletsCommand(ctx);
        } catch (error) {
            logger.error('Failed to set default wallet', error as Error);
            await ctx.answerCbQuery('Failed to update default wallet.');
        }
    }

    private async handleShowWalletDetails(ctx: BotContext) {
        try {
            const walletId = ctx.match![1];
            const wallets = await this.walletService.getWallets(ctx.session.token!);
            const wallet = wallets.find(w => w.id === walletId);

            if (!wallet) {
                await ctx.answerCbQuery('Wallet not found');
                return;
            }

            const qrCode = await this.generateQRCode(wallet.address);
            const message = `💼 ${wallet.currency} Wallet Details\n\n` +
                          `Network: ${wallet.network}\n` +
                          `Address: ${wallet.address}\n` +
                          `Balance: ${wallet.balance} ${wallet.currency}\n` +
                          `Default: ${wallet.isDefault ? 'Yes' : 'No'}`;

            const keyboard = Markup.inlineKeyboard([
                [Markup.button.callback('📋 Copy Address', `copy_address:${wallet.id}`)],
                [Markup.button.callback('✅ Set as Default', `set_default_wallet:${wallet.id}`)],
                [Markup.button.callback('⬅️ Back to Wallets', 'wallets')],
                [Markup.button.callback('🏠 Main Menu', 'show_main')]
            ]);

            await ctx.replyWithPhoto(
                { source: qrCode },
                { caption: message, ...keyboard }
            );
        } catch (error) {
            logger.error('Failed to show wallet details', error as Error);
            await ctx.answerCbQuery('Failed to load wallet details.');
        }
    }

    private async handleRefreshBalances(ctx: BotContext) {
        try {
            const prefs = this.prefsManager.getPreferences(ctx.from!.id.toString());
            const balances = await this.walletService.getBalances(ctx.session.token!);
            
            await ctx.answerCbQuery('Balances updated!');
            await ctx.editMessageText(
                `💰 Your Balances:\n\n${formatBalance(balances, prefs)}`,
                Markup.inlineKeyboard([
                    [Markup.button.callback('🔄 Refresh', 'refresh_balances')],
                    [Markup.button.callback('💸 Send', 'show_send_options')],
                    [Markup.button.callback('📥 Receive', 'show_receive')],
                    [Markup.button.callback('🏠 Main Menu', 'show_main')]
                ])
            );
        } catch (error) {
            logger.error('Failed to refresh balances', error as Error);
            await ctx.answerCbQuery('Failed to update balances.');
        }
    }

    private async generateQRCode(data: string): Promise<Buffer> {
        const QRCode = require('qrcode');
        return QRCode.toBuffer(data, {
            errorCorrectionLevel: 'H',
            margin: 1,
            scale: 8
        });
    }
}
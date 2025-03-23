import { Markup } from 'telegraf';
import { BotContext } from '../types';
import { PreferencesManager, UserPreferences } from '../utils/preferences';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { Currencies } from '../utils/format';

export class PreferencesCommands {
    private readonly prefsManager: PreferencesManager;

    constructor(private readonly bot: any) {
        this.prefsManager = PreferencesManager.getInstance();
        this.registerHandlers();
    }

    private registerHandlers() {
        // Settings menu
        this.bot.command('settings', AuthMiddleware.requireAuth, this.handleSettingsCommand.bind(this));
        
        // Currency preference
        this.bot.action('set_currency', this.showCurrencyOptions.bind(this));
        this.bot.action(/^currency:(.+)$/, this.handleCurrencySelection.bind(this));
        
        // Display format preference
        this.bot.action('set_display', this.showDisplayOptions.bind(this));
        this.bot.action(/^display:(.+)$/, this.handleDisplaySelection.bind(this));
        
        // Notifications toggle
        this.bot.action('toggle_notifications', this.toggleNotifications.bind(this));
    }

    private async handleSettingsCommand(ctx: BotContext) {
        if (!ctx.from?.id) return;

        const prefs = this.prefsManager.getPreferences(ctx.from.id.toString());
        await this.showSettingsMenu(ctx, prefs);
    }

    private async showSettingsMenu(ctx: BotContext, prefs: UserPreferences) {
        const message = `
⚙️ Your Settings:

💱 Default Currency: ${prefs.defaultCurrency}
📊 Display Format: ${prefs.displayFormat}
🔔 Notifications: ${prefs.notificationsEnabled ? 'Enabled' : 'Disabled'}
`;

        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('Set Default Currency', 'set_currency')],
            [Markup.button.callback('Change Display Format', 'set_display')],
            [Markup.button.callback(
                `${prefs.notificationsEnabled ? 'Disable' : 'Enable'} Notifications`,
                'toggle_notifications'
            )],
        ]);

        if ('message_id' in ctx.callbackQuery || {}) {
            await ctx.editMessageText(message, keyboard);
        } else {
            await ctx.reply(message, keyboard);
        }
    }

    private async showCurrencyOptions(ctx: BotContext) {
        const buttons = Object.keys(Currencies).map(currency => [
            Markup.button.callback(
                `${Currencies[currency as keyof typeof Currencies].symbol} ${currency}`,
                `currency:${currency}`
            )
        ]);

        await ctx.editMessageText(
            '💱 Select your default currency:',
            Markup.inlineKeyboard(buttons)
        );
    }

    private async handleCurrencySelection(ctx: BotContext) {
        if (!ctx.from?.id || !ctx.match) return;

        const currency = ctx.match[1];
        this.prefsManager.updatePreferences(ctx.from.id.toString(), {
            defaultCurrency: currency
        });

        await ctx.answerCbQuery(`Default currency set to ${currency}`);
        const prefs = this.prefsManager.getPreferences(ctx.from.id.toString());
        await this.showSettingsMenu(ctx, prefs);
    }

    private async showDisplayOptions(ctx: BotContext) {
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('Detailed View', 'display:detailed')],
            [Markup.button.callback('Compact View', 'display:compact')]
        ]);

        await ctx.editMessageText(
            '📊 Select your preferred display format:',
            keyboard
        );
    }

    private async handleDisplaySelection(ctx: BotContext) {
        if (!ctx.from?.id || !ctx.match) return;

        const format = ctx.match[1] as 'compact' | 'detailed';
        this.prefsManager.updatePreferences(ctx.from.id.toString(), {
            displayFormat: format
        });

        await ctx.answerCbQuery(`Display format set to ${format}`);
        const prefs = this.prefsManager.getPreferences(ctx.from.id.toString());
        await this.showSettingsMenu(ctx, prefs);
    }

    private async toggleNotifications(ctx: BotContext) {
        if (!ctx.from?.id) return;

        const prefs = this.prefsManager.getPreferences(ctx.from.id.toString());
        const newValue = !prefs.notificationsEnabled;

        this.prefsManager.updatePreferences(ctx.from.id.toString(), {
            notificationsEnabled: newValue
        });

        await ctx.answerCbQuery(
            `Notifications ${newValue ? 'enabled' : 'disabled'}`
        );

        const updatedPrefs = this.prefsManager.getPreferences(ctx.from.id.toString());
        await this.showSettingsMenu(ctx, updatedPrefs);
    }
}
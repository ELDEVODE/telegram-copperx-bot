import { Markup } from 'telegraf';
import { PreferencesManager } from './preferences';
import { Currencies } from './format';

export class MenuBuilder {
    static mainMenu() {
        return Markup.inlineKeyboard([
            [
                Markup.button.callback('💰 Balance', 'show_balance'),
                Markup.button.callback('💸 Send', 'show_send_options')
            ],
            [
                Markup.button.callback('🏦 Wallets', 'show_wallets'),
                Markup.button.callback('📊 History', 'show_history')
            ],
            [
                Markup.button.callback('⚙️ Settings', 'show_settings')
            ]
        ]);
    }

    static sendOptionsMenu() {
        return Markup.inlineKeyboard([
            [
                Markup.button.callback('📧 Send to Email', 'send_email'),
                Markup.button.callback('🔑 Send to Wallet', 'send_withdraw')
            ],
            [
                Markup.button.callback('📥 Bulk Transfer', 'bulk_transfer')
            ],
            [
                Markup.button.callback('🏠 Main Menu', 'show_main')
            ]
        ]);
    }

    static settingsMenu() {
        return Markup.inlineKeyboard([
            [
                Markup.button.callback('💱 Default Currency', 'set_default_currency'),
                Markup.button.callback('📱 Display Format', 'set_display_format')
            ],
            [
                Markup.button.callback('🔔 Notifications', 'toggle_notifications'),
                Markup.button.callback('🌍 Language', 'set_language')
            ],
            [
                Markup.button.callback('🏠 Main Menu', 'show_main')
            ]
        ]);
    }

    static currencyMenu(userId: string, actionPrefix: string) {
        const prefs = PreferencesManager.getInstance().getPreferences(userId);
        const buttons = Object.entries(Currencies).map(([currency]) => [
            Markup.button.callback(
                `${currency === prefs.defaultCurrency ? '✅ ' : ''}${currency}`,
                `${actionPrefix}:${currency}`
            )
        ]);
        buttons.push([Markup.button.callback('🏠 Main Menu', 'show_main')]);
        return Markup.inlineKeyboard(buttons);
    }

    static displayFormatMenu(userId: string) {
        const prefs = PreferencesManager.getInstance().getPreferences(userId);
        return Markup.inlineKeyboard([
            [
                Markup.button.callback(
                    `${prefs.displayFormat === 'detailed' ? '✅ ' : ''}Detailed`,
                    'set_format:detailed'
                ),
                Markup.button.callback(
                    `${prefs.displayFormat === 'compact' ? '✅ ' : ''}Compact`,
                    'set_format:compact'
                )
            ],
            [
                Markup.button.callback('🏠 Main Menu', 'show_main')
            ]
        ]);
    }

    static languageMenu() {
        return Markup.inlineKeyboard([
            [
                Markup.button.callback('🇺🇸 English', 'set_lang:en'),
                Markup.button.callback('🇪🇸 Español', 'set_lang:es')
            ],
            [
                Markup.button.callback('🇨🇳 中文', 'set_lang:zh'),
                Markup.button.callback('🇯🇵 日本語', 'set_lang:ja')
            ],
            [
                Markup.button.callback('🏠 Main Menu', 'show_main')
            ]
        ]);
    }

    static confirmationMenu(type: 'transfer' | 'settings' | 'logout') {
        return Markup.inlineKeyboard([
            [
                Markup.button.callback('✅ Confirm', `confirm_${type}`),
                Markup.button.callback('❌ Cancel', `cancel_${type}`)
            ]
        ]);
    }

    static paginationMenu(currentPage: number, totalPages: number, actionPrefix: string) {
        const buttons: any[] = [];
        
        // Add navigation buttons
        if (totalPages > 1) {
            const row = [];
            if (currentPage > 1) {
                row.push(Markup.button.callback('⬅️', `${actionPrefix}:${currentPage - 1}`));
            }
            row.push(Markup.button.callback(`${currentPage}/${totalPages}`, 'noop'));
            if (currentPage < totalPages) {
                row.push(Markup.button.callback('➡️', `${actionPrefix}:${currentPage + 1}`));
            }
            buttons.push(row);
        }
        
        // Add main menu button
        buttons.push([Markup.button.callback('🏠 Main Menu', 'show_main')]);
        
        return Markup.inlineKeyboard(buttons);
    }

    static networkMenu(currency: string) {
        const networks: Record<string, string[]> = {
            ETH: ['ethereum', 'arbitrum', 'optimism'],
            USDT: ['ethereum', 'tron', 'bsc'],
            BTC: ['bitcoin', 'lightning']
        };

        const availableNetworks = networks[currency] || [];
        const buttons = availableNetworks.map(network => [
            Markup.button.callback(network, `select_network:${network}`)
        ]);
        buttons.push([Markup.button.callback('❌ Cancel', 'cancel_transfer')]);
        
        return Markup.inlineKeyboard(buttons);
    }
}
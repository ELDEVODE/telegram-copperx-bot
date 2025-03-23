import { logger } from './logger';

export interface UserPreferences {
    defaultCurrency: string;
    displayFormat: 'detailed' | 'compact';
    notificationsEnabled: boolean;
    language?: string;
    timezone?: string;
}

export class PreferencesManager {
    private static instance: PreferencesManager;
    private preferences: Map<string, UserPreferences> = new Map();

    private readonly DEFAULT_PREFERENCES: UserPreferences = {
        defaultCurrency: 'USD',
        notificationsEnabled: true,
        displayFormat: 'detailed'
    };

    private constructor() {
        // Load preferences from persistent storage if available
        this.loadPreferences();
    }

    public static getInstance(): PreferencesManager {
        if (!PreferencesManager.instance) {
            PreferencesManager.instance = new PreferencesManager();
        }
        return PreferencesManager.instance;
    }

    public getPreferences(userId: string): UserPreferences {
        if (!this.preferences.has(userId)) {
            // Set default preferences
            this.preferences.set(userId, { ...this.DEFAULT_PREFERENCES });
        }
        return this.preferences.get(userId)!;
    }

    public updatePreferences(userId: string, updates: Partial<UserPreferences>): void {
        const current = this.getPreferences(userId);
        const updated = { ...current, ...updates };
        this.preferences.set(userId, updated);
        
        logger.debug('User preferences updated', { userId, updates });
        this.savePreferences();
    }

    public setDefaultCurrency(userId: string, currency: string): void {
        const prefs = this.getPreferences(userId);
        this.updatePreferences(userId, {
            ...prefs,
            defaultCurrency: currency
        });
    }

    public setDisplayFormat(userId: string, format: 'detailed' | 'compact'): void {
        const prefs = this.getPreferences(userId);
        this.updatePreferences(userId, {
            ...prefs,
            displayFormat: format
        });
    }

    public toggleNotifications(userId: string): boolean {
        const prefs = this.getPreferences(userId);
        const newValue = !prefs.notificationsEnabled;
        this.updatePreferences(userId, {
            ...prefs,
            notificationsEnabled: newValue
        });
        return newValue;
    }

    public setLanguage(userId: string, language: string): void {
        const prefs = this.getPreferences(userId);
        this.updatePreferences(userId, {
            ...prefs,
            language
        });
    }

    public setTimezone(userId: string, timezone: string): void {
        const prefs = this.getPreferences(userId);
        this.updatePreferences(userId, {
            ...prefs,
            timezone
        });
    }

    public clearPreferences(userId: string): void {
        this.preferences.delete(userId);
        logger.debug('User preferences cleared', { userId });
        this.savePreferences();
    }

    public getAllUserPreferences(): Map<string, UserPreferences> {
        return new Map(this.preferences);
    }

    public hasPreferences(userId: string): boolean {
        return this.preferences.has(userId);
    }

    public exportPreferences(): string {
        return JSON.stringify(Array.from(this.preferences.entries()));
    }

    public importPreferences(json: string): void {
        try {
            const data = JSON.parse(json);
            this.preferences = new Map(data);
        } catch (error) {
            logger.error('Failed to import preferences:', error as Error);
            throw new Error('Invalid preferences data format');
        }
    }

    private loadPreferences(): void {
        try {
            // In a production environment, this would load from a database
            // For now, we'll keep preferences in memory
            logger.info('Preferences manager initialized');
        } catch (error) {
            logger.error('Failed to load preferences', error as Error);
        }
    }

    private savePreferences(): void {
        try {
            // In a production environment, this would save to a database
            // For now, we'll keep preferences in memory
            logger.debug('Preferences saved');
        } catch (error) {
            logger.error('Failed to save preferences', error as Error);
        }
    }

    private validateCurrency(currency: string): boolean {
        const validCurrencies = ['USD', 'BTC', 'ETH', 'USDT'];
        return validCurrencies.includes(currency);
    }

    private validateDisplayFormat(format: string): boolean {
        return ['detailed', 'compact'].includes(format);
    }
}
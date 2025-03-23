import { logger } from './logger';

interface UserSession {
    userId: string;
    chatId: number;
    lastActive: number;
    token?: string;
    organizationId?: string;
}

export class SessionStore {
    private static instance: SessionStore;
    private sessions: Map<string, UserSession> = new Map();

    private constructor() {
        // Clean up inactive sessions every hour
        setInterval(() => this.cleanupInactiveSessions(), 3600000);
    }

    public static getInstance(): SessionStore {
        if (!SessionStore.instance) {
            SessionStore.instance = new SessionStore();
        }
        return SessionStore.instance;
    }

    public storeSession(userId: string, chatId: number, token?: string, organizationId?: string): void {
        this.sessions.set(userId, {
            userId,
            chatId,
            token,
            organizationId,
            lastActive: Date.now()
        });
        logger.debug('Session stored', { userId, chatId, hasToken: !!token });
    }

    public updateSession(userId: string, updates: Partial<UserSession>): void {
        const session = this.sessions.get(userId);
        if (session) {
            this.sessions.set(userId, {
                ...session,
                ...updates,
                lastActive: Date.now()
            });
            logger.debug('Session updated', { userId });
        }
    }

    public getLatestToken(): string | undefined {
        // Get the most recently active session's token
        let latestSession: UserSession | undefined;
        let latestTime = 0;

        for (const session of this.sessions.values()) {
            if (session.lastActive > latestTime && session.token) {
                latestTime = session.lastActive;
                latestSession = session;
            }
        }

        return latestSession?.token;
    }

    public getOrganizationId(userId: string): string | undefined {
        return this.sessions.get(userId)?.organizationId;
    }

    public updateLastActive(userId: string): void {
        const session = this.sessions.get(userId);
        if (session) {
            session.lastActive = Date.now();
            this.sessions.set(userId, session);
        }
    }

    public getChatId(userId: string): number | undefined {
        const session = this.sessions.get(userId);
        if (session) {
            this.updateLastActive(userId);
            return session.chatId;
        }
        return undefined;
    }

    public removeSession(userId: string): void {
        this.sessions.delete(userId);
        logger.debug('Session removed', { userId });
    }

    private cleanupInactiveSessions(): void {
        const now = Date.now();
        const inactiveThreshold = 24 * 60 * 60 * 1000; // 24 hours

        for (const [userId, session] of this.sessions.entries()) {
            if (now - session.lastActive > inactiveThreshold) {
                this.sessions.delete(userId);
                logger.debug('Inactive session cleaned up', { userId });
            }
        }
    }
}
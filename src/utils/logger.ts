import { createWriteStream, WriteStream, mkdirSync, existsSync, unlinkSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { LoggingConfig } from '../config';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

class Logger {
    private static instance: Logger;
    private logStream: WriteStream;
    private errorStream: WriteStream;
    private readonly logLevel: LogLevel;
    private readonly logDir: string;
    private readonly maxFiles: number;
    private readonly maxSize: number;

    private constructor() {
        this.logLevel = LogLevel[LoggingConfig.level];
        this.logDir = LoggingConfig.directory;
        this.maxFiles = LoggingConfig.maxFiles;
        this.maxSize = LoggingConfig.maxSize;

        this.setupLogDirectory();
        this.cleanOldLogs();
        
        const date = new Date().toISOString().split('T')[0];
        this.logStream = this.createLogStream(`${date}.log`);
        this.errorStream = this.createLogStream(`${date}-error.log`);

        // Check log size periodically
        setInterval(() => this.checkLogSize(), 3600000); // Every hour
    }

    private getLogLevelFromEnv(): LogLevel {
        const level = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
        return LogLevel[level as keyof typeof LogLevel] || LogLevel.INFO;
    }

    private setupLogDirectory(): void {
        if (!existsSync(this.logDir)) {
            mkdirSync(this.logDir, { recursive: true });
        }
    }

    private createLogStream(filename: string): WriteStream {
        return createWriteStream(join(this.logDir, filename), { flags: 'a' });
    }

    private checkLogSize(): void {
        const currentSize = statSync(this.logStream.path).size;
        if (currentSize > this.maxSize) {
            this.rotateLog(this.logStream);
        }

        const errorSize = statSync(this.errorStream.path).size;
        if (errorSize > this.maxSize) {
            this.rotateLog(this.errorStream);
        }
    }

    private rotateLog(stream: WriteStream): void {
        const oldPath = stream.path;
        stream.end();

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const newPath = `${oldPath}.${timestamp}`;
        
        try {
            rename(oldPath, newPath);
            stream = this.createLogStream(basename(oldPath));
        } catch (error) {
            console.error('Failed to rotate log file:', error);
        }
    }

    private cleanOldLogs(): void {
        const files = readdirSync(this.logDir)
            .filter(file => file.endsWith('.log'))
            .map(file => ({
                name: file,
                path: join(this.logDir, file),
                time: statSync(join(this.logDir, file)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);

        // Keep only the most recent files based on maxFiles setting
        files.slice(this.maxFiles).forEach(file => {
            try {
                unlinkSync(file.path);
            } catch (error) {
                console.error(`Failed to delete old log file ${file.name}:`, error);
            }
        });
    }

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    private formatMessage(level: string, message: string, meta?: any): string {
        const timestamp = new Date().toISOString();
        const metaStr = meta ? `\nMetadata: ${JSON.stringify(meta, null, 2)}` : '';
        return `[${timestamp}] ${level}: ${message}${metaStr}\n`;
    }

    private shouldLog(level: LogLevel): boolean {
        return level >= this.logLevel;
    }

    public debug(message: string, meta?: any): void {
        if (!this.shouldLog(LogLevel.DEBUG)) return;
        this.logStream.write(this.formatMessage('DEBUG', message, meta));
    }

    public info(message: string, meta?: any): void {
        if (!this.shouldLog(LogLevel.INFO)) return;
        this.logStream.write(this.formatMessage('INFO', message, meta));
    }

    public warn(message: string, meta?: any): void {
        if (!this.shouldLog(LogLevel.WARN)) return;
        this.logStream.write(this.formatMessage('WARN', message, meta));
    }

    public error(message: string, error?: Error, meta?: any): void {
        if (!this.shouldLog(LogLevel.ERROR)) return;
        const errorMeta = error ? {
            ...meta,
            error: {
                message: error.message,
                stack: error.stack,
                name: error.name
            }
        } : meta;
        const logMessage = this.formatMessage('ERROR', message, errorMeta);
        this.logStream.write(logMessage);
        this.errorStream.write(logMessage);
    }

    public close(): void {
        this.logStream.end();
        this.errorStream.end();
    }
}

export const logger = Logger.getInstance();

// Ensure logs are properly closed on process termination
process.on('beforeExit', () => {
    logger.info('Application shutting down');
    logger.close();
});
import { Markup } from 'telegraf';
import { Message } from 'telegraf/types';
import { TransferService } from './transfer.service';
import { BotContext } from '../types';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { handleError } from '../utils/errors';
import { TransferValidation } from '../utils/validation';

export class BulkTransferCommands {
    private readonly transferService: TransferService;

    constructor(private readonly bot: any) {
        this.transferService = new TransferService();
        this.registerHandlers();
    }

    private registerHandlers() {
        // Bulk transfer commands
        this.bot.command('bulk_transfer', AuthMiddleware.requireAuth, this.handleBulkTransferCommand.bind(this));
        this.bot.command('bulk_template', AuthMiddleware.requireAuth, this.handleTemplateCommand.bind(this));
        
        // Bulk transfer actions
        this.bot.action('bulk_email_template', (ctx) => this.handleBulkTemplate(ctx, 'email'));
        this.bot.action('bulk_wallet_template', (ctx) => this.handleBulkTemplate(ctx, 'wallet'));
        this.bot.action('confirm_bulk_transfer', this.handleBulkConfirmation.bind(this));
        
        // Handle CSV file uploads
        this.bot.on('document', AuthMiddleware.requireAuth, this.handleCSVUpload.bind(this));
    }

    private async handleBulkTransferCommand(ctx: BotContext) {
        logger.debug('Bulk transfer command received', { userId: ctx.from?.id });

        // Show bulk transfer options menu
        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback('📧 Email Transfers', 'bulk_email_template'),
                Markup.button.callback('💱 Wallet Transfers', 'bulk_wallet_template')
            ],
            [Markup.button.callback('❌ Cancel', 'cancel_transfer')]
        ]);

        await ctx.reply(
            'Choose the type of bulk transfer you want to perform. ' +
            'I\'ll provide you with the appropriate CSV template.',
            keyboard
        );
    }

    private async handleBulkTemplate(ctx: BotContext, type: 'email' | 'wallet') {
        const template = formatCSVTemplate(type);
        const filename = `${type}_transfers_template.csv`;

        await ctx.replyWithDocument(
            { source: Buffer.from(template), filename },
            { 
                caption: 'Download this template, fill it with your transfer details, ' +
                        'and upload it back to me. Maximum 50 transfers per file.' 
            }
        );
    }

    private async handleCSVUpload(ctx: BotContext) {
        try {
            const document = (ctx.message as Message.DocumentMessage).document;
            
            if (!document.file_name?.toLowerCase().endsWith('.csv')) {
                return ctx.reply('Please upload a CSV file.');
            }

            // Get file link
            const file = await ctx.telegram.getFile(document.file_id);
            const fileLink = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

            // Download and process CSV
            const response = await fetch(fileLink);
            const csv = await response.text();

            // Show preview and confirmation
            const rows = csv.split('\n').map(row => row.split(','));
            const isEmailTransfer = rows[0].includes('email');
            
            // Validate CSV format
            const validation = validateCSVData(rows, isEmailTransfer ? 'email' : 'wallet');
            if (!validation.isValid) {
                return ctx.reply(`❌ ${validation.error}\n\nPlease check the template and try again.`);
            }

            // Show preview
            const preview = rows.slice(1, 4).map(row => {
                const [recipient, amount, currency] = row;
                return `${recipient}: ${formatAmount(amount, currency as CurrencyCode)} ${currency}`;
            }).join('\n');

            const totalTransfers = rows.length - 1;
            const keyboard = Markup.inlineKeyboard([
                [
                    Markup.button.callback('✅ Confirm All', 'confirm_bulk_transfer'),
                    Markup.button.callback('❌ Cancel', 'cancel_transfer')
                ]
            ]);

            ctx.session.bulkTransferData = csv;
            await ctx.reply(
                `📝 Bulk Transfer Preview\n\n` +
                `First ${Math.min(3, totalTransfers)} of ${totalTransfers} transfers:\n` +
                `${preview}\n\n` +
                `Total transfers: ${totalTransfers}\n\n` +
                `Please review and confirm to process all transfers.`,
                keyboard
            );
        } catch (error) {
            logger.error('Failed to process CSV file', error as Error);
            await ctx.reply('Failed to process CSV file. Please check the format and try again.');
        }
    }

    private async showTransferPreview(ctx: BotContext, csv: string) {
        try {
            const result = await this.transferService.processBulkTransferCSV(ctx.session.token!, csv);

            // Show summary of successful transfers
            let message = '✅ Bulk Transfer Results:\n\n';
            message += `Total Transfers: ${result.successful.length + result.failed.length}\n`;
            message += `Successful: ${result.successful.length}\n`;
            message += `Failed: ${result.failed.length}\n\n`;

            if (result.failed.length > 0) {
                message += '❌ Failed Transfers:\n';
                result.failed.forEach(({ transfer, error }, index) => {
                    message += `${index + 1}. ${transfer.recipientEmail || transfer.recipientAddress}: ${error}\n`;
                });
            }

            await ctx.reply(message);

            // Log the operation
            logger.info('Bulk transfer completed', {
                userId: ctx.from?.id,
                successful: result.successful.length,
                failed: result.failed.length
            });
        } catch (error) {
            handleError(ctx, error as Error);
        }
    }

    private async handleBulkConfirmation(ctx: BotContext) {
        if (!ctx.session?.bulkTransferData || !ctx.session.token) {
            return ctx.reply('No bulk transfer data found. Please upload your CSV file again.');
        }

        try {
            const result = await this.transferService.processBulkTransferCSV(
                ctx.session.token,
                ctx.session.bulkTransferData
            );

            const message = [
                '✅ Bulk transfer processing complete!',
                '',
                `Total processed: ${result.successful.length + result.failed.length}`,
                `Successful: ${result.successful.length}`,
                `Failed: ${result.failed.length}`
            ];

            if (result.failed.length > 0) {
                message.push('', '❌ Failed transfers:');
                result.failed.forEach(({transfer, error}, index) => {
                    message.push(`${index + 1}. ${transfer.recipientEmail || transfer.recipientAddress}: ${error}`);
                });
            }

            // Clear the session data
            ctx.session.bulkTransferData = undefined;

            await ctx.editMessageText(
                message.join('\n'),
                Markup.inlineKeyboard([[
                    Markup.button.callback('🏠 Main Menu', 'show_main')
                ]])
            );
        } catch (error: any) {
            logger.error('Bulk transfer failed', error);
            await ctx.editMessageText(
                `❌ Bulk transfer failed: ${error.message}`,
                Markup.inlineKeyboard([[
                    Markup.button.callback('🔄 Try Again', 'bulk_transfer'),
                    Markup.button.callback('🏠 Main Menu', 'show_main')
                ]])
            );
        }
    }

    private async handleTemplateCommand(ctx: BotContext) {
        const emailTemplate = 'email,amount,currency\nrecipient@example.com,100,USD\nother@example.com,50,USD';
        const walletTemplate = 'address,amount,currency,network\n0x1234...,0.1,ETH,ethereum\n0x5678...,0.05,ETH,ethereum';

        await ctx.reply('📝 Here are the CSV templates for bulk transfers:');
        
        // Send email transfer template
        await ctx.replyWithDocument({
            source: Buffer.from(emailTemplate),
            filename: 'email_transfers_template.csv'
        });

        // Send wallet transfer template
        await ctx.replyWithDocument({
            source: Buffer.from(walletTemplate),
            filename: 'wallet_transfers_template.csv'
        });
    }
}
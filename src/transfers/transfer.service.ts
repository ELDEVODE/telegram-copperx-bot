import axios, { AxiosError } from 'axios';
import { CopperxConfig, ApiEndpoints } from '../config';
import type { Transfer } from '../types';
import { handleAxiosError } from '../utils/errors';
import { validateTransferData, validateCSVData } from '../utils/validation';
import { logger } from '../utils/logger';

export class TransferService {
    private readonly apiUrl: string;

    constructor() {
        this.apiUrl = CopperxConfig.apiUrl;
    }

    private getHeaders(token: string) {
        return { Authorization: `Bearer ${token}` };
    }

    // Made these methods public so they can be used from transfer.menu.ts
    public getMinimumAmount(currency: string): string {
        // Define minimum amounts per currency to prevent failed transfers
        const minimumAmounts: Record<string, string> = {
            BTC: '0.0001',
            ETH: '0.01',
            USDT: '1',
            USD: '1'
        };
        return minimumAmounts[currency] || '0';
    }

    public validateMinimumAmount(amount: string, currency: string): { isValid: boolean; error?: string } {
        const minAmount = this.getMinimumAmount(currency);
        if (parseFloat(amount) < parseFloat(minAmount)) {
            return {
                isValid: false,
                error: `Amount must be at least ${minAmount} ${currency}`
            };
        }
        return { isValid: true };
    }

    public async calculateFee(token: string, transferData: {
        amount: string;
        currency: string;
        type: 'EMAIL' | 'WITHDRAW';
        network?: string;
    }): Promise<{
        fee: string;
        feeCurrency: string; // Updated to use CurrencyCode type
        total: string;
    }> {
        try {
            const response = await axios.post(
                `${this.apiUrl}/transfers/calculate-fee`,
                transferData,
                { headers: this.getHeaders(token) }
            );
            return response.data;
        } catch (error) {
            if (error instanceof AxiosError) {
                return handleAxiosError(error);
            }
            throw error;
        }
    }

    private async validateRecipient(token: string, data: {
        recipientEmail?: string;
        walletAddress?: string;
        network?: string;
    }): Promise<{ isValid: boolean; error?: string }> {
        try {
            const response = await axios.post(
                `${this.apiUrl}/transfers/validate-recipient`,
                data,
                { headers: this.getHeaders(token) }
            );
            return { isValid: true };
        } catch (error: any) {
            const message = error.response?.data?.message || 'Invalid recipient';
            return { isValid: false, error: message };
        }
    }

    async sendToEmail(token: string, data: { 
        recipientEmail: string; 
        amount: string; 
        currency: string;
        purposeCode?: string;
    }): Promise<Transfer> {
        try {
            // Validate minimum amount first
            const minAmountValidation = this.validateMinimumAmount(data.amount, data.currency);
            if (!minAmountValidation.isValid) {
                throw new Error(minAmountValidation.error);
            }

            // Enhanced validation including recipient check
            const validation = validateTransferData({
                amount: data.amount,
                currency: data.currency,
                recipient: data.recipientEmail
            });
            
            if (!validation.isValid) {
                throw new Error(validation.error);
            }

            // Validate recipient
            const recipientValidation = await this.validateRecipient(token, {
                recipientEmail: data.recipientEmail
            });

            if (!recipientValidation.isValid) {
                throw new Error(recipientValidation.error);
            }

            // Calculate fees
            const feeCalculation = await this.calculateFee(token, {
                amount: data.amount,
                currency: data.currency,
                type: 'EMAIL'
            });

            // Add fee information to the request
            const response = await axios.post(
                `${this.apiUrl}${ApiEndpoints.transfers.send}`,
                {
                    email: data.recipientEmail,
                    amount: data.amount,
                    currency: data.currency,
                    purposeCode: data.purposeCode || 'self',
                    fee: feeCalculation.fee,
                    feeCurrency: feeCalculation.feeCurrency,
                    total: feeCalculation.total
                },
                { headers: this.getHeaders(token) }
            );
            return response.data;
        } catch (error) {
            if (error instanceof AxiosError) {
                return handleAxiosError(error);
            }
            throw error;
        }
    }

    async withdrawToWallet(token: string, data: {
        walletAddress: string;
        amount: string;
        currency: string;
        network: string;
        purposeCode?: string;
    }): Promise<Transfer> {
        try {
            // Enhanced validation including recipient check
            const validation = validateTransferData({
                amount: data.amount,
                currency: data.currency,
                recipient: data.walletAddress,
                network: data.network
            });
            
            if (!validation.isValid) {
                throw new Error(validation.error);
            }

            // Validate recipient address
            const recipientValidation = await this.validateRecipient(token, {
                walletAddress: data.walletAddress,
                network: data.network
            });

            if (!recipientValidation.isValid) {
                throw new Error(recipientValidation.error);
            }

            // Calculate fees including network fees
            const feeCalculation = await this.calculateFee(token, {
                amount: data.amount,
                currency: data.currency,
                type: 'WITHDRAW',
                network: data.network
            });

            // Add fee information to the request
            const response = await axios.post(
                `${this.apiUrl}${ApiEndpoints.transfers.withdraw}`,
                {
                    walletAddress: data.walletAddress,
                    amount: data.amount,
                    currency: data.currency,
                    network: data.network,
                    purposeCode: data.purposeCode || 'self',
                    fee: feeCalculation.fee,
                    feeCurrency: feeCalculation.feeCurrency,
                    total: feeCalculation.total
                },
                { headers: this.getHeaders(token) }
            );
            return response.data;
        } catch (error) {
            if (error instanceof AxiosError) {
                return handleAxiosError(error);
            }
            throw error;
        }
    }

    async withdrawToBank(token: string, data: {
        quotePayload: string;
        quoteSignature: string;
        preferredWalletId?: string;
        customerData?: {
            name: string;
            businessName?: string;
            email: string;
            country: string;
        };
        sourceOfFunds?: string;
        note?: string;
        purposeCode?: string;
        recipientRelationship?: string;
    }): Promise<Transfer> {
        try {
            const response = await axios.post(
                `${this.apiUrl}${ApiEndpoints.transfers.offramp}`,
                {
                    ...data,
                    purposeCode: data.purposeCode || 'self',
                    sourceOfFunds: data.sourceOfFunds || 'salary',
                    recipientRelationship: data.recipientRelationship || 'self'
                },
                { headers: this.getHeaders(token) }
            );
            return response.data;
        } catch (error) {
            if (error instanceof AxiosError) {
                return handleAxiosError(error);
            }
            throw error;
        }
    }

    async sendBulkTransfers(token: string, transfers: any[]): Promise<{
        successful: Transfer[];
        failed: Array<{ transfer: any; error: string }>;
    }> {
        try {
            // Validate each transfer in the bulk request
            for (const transfer of transfers) {
                const validation = validateTransferData(transfer);
                if (!validation.isValid) {
                    throw new Error(`Invalid transfer: ${validation.error}`);
                }
            }

            const response = await axios.post(
                `${this.apiUrl}${ApiEndpoints.transfers.send}-batch`,
                { transfers },
                { headers: this.getHeaders(token) }
            );

            logger.info('Bulk transfer completed', {
                total: transfers.length,
                successful: response.data.successful.length,
                failed: response.data.failed.length
            });

            return response.data;
        } catch (error) {
            if (error instanceof AxiosError) {
                return handleAxiosError(error);
            }
            throw error;
        }
    }

    async processBulkTransferCSV(token: string, csv: string): Promise<{
        successful: Transfer[];
        failed: Array<{ transfer: any; error: string }>;
    }> {
        try {
            // Parse CSV data into array
            const rows = csv.split('\n').map(row => row.split(','));
            const validation = validateCSVData(rows, 'email'); // or 'wallet' depending on the transfer type
            
            if (!validation.isValid) {
                throw new Error(validation.error);
            }

            // Convert validated CSV data to transfer objects
            const transfers = rows.slice(1).map(row => ({
                recipient: row[0],
                amount: row[1],
                currency: row[2],
                ...(row[3] ? { network: row[3] } : {})
            }));

            return this.sendBulkTransfers(token, transfers);
        } catch (error) {
            logger.error('Failed to process bulk transfer CSV', error as Error);
            throw error;
        }
    }

    async getTransferHistory(token: string, page: number = 1, limit: number = 10): Promise<{
        transfers: Transfer[];
        total: number;
        page: number;
        limit: number;
    }> {
        try {
            const response = await axios.get(
                `${this.apiUrl}${ApiEndpoints.transfers.history}`,
                {
                    params: { page, limit },
                    headers: this.getHeaders(token)
                }
            );
            return response.data;
        } catch (error) {
            if (error instanceof AxiosError) {
                return handleAxiosError(error);
            }
            throw error;
        }
    }
}
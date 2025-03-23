import axios, { AxiosError } from 'axios';
import { CopperxConfig, ApiEndpoints } from '../config';
import type { Wallet, WalletBalance, TransferQueryParams } from '../types';
import { logger } from '../utils/logger';
import { handleAxiosError } from '../utils/errors';

export class WalletService {
    private readonly apiUrl: string;

    constructor() {
        this.apiUrl = CopperxConfig.apiUrl;
    }

    private getHeaders(token: string) {
        return { Authorization: `Bearer ${token}` };
    }

    async getWallets(token: string): Promise<Wallet[]> {
        try {
            const response = await axios.get(
                `${this.apiUrl}${ApiEndpoints.wallets.list}`,
                { headers: this.getHeaders(token) }
            );
            return response.data;
        } catch (error) {
            return handleAxiosError(error as AxiosError);
        }
    }

    async getBalances(token: string): Promise<WalletBalance[]> {
        try {
            const response = await axios.get(
                `${this.apiUrl}${ApiEndpoints.wallets.balances}`,
                { headers: this.getHeaders(token) }
            );
            return response.data;
        } catch (error) {
            return handleAxiosError(error as AxiosError);
        }
    }

    async getDefaultWallet(token: string): Promise<Wallet> {
        try {
            const response = await axios.get(
                `${this.apiUrl}${ApiEndpoints.wallets.default}`,
                { headers: this.getHeaders(token) }
            );
            return response.data;
        } catch (error) {
            return handleAxiosError(error as AxiosError);
        }
    }

    async setDefaultWallet(token: string, walletId: string): Promise<Wallet> {
        try {
            const response = await axios.post(
                `${this.apiUrl}${ApiEndpoints.wallets.default}`,
                { walletId },
                { headers: this.getHeaders(token) }
            );
            return response.data;
        } catch (error) {
            return handleAxiosError(error as AxiosError);
        }
    }

    async getTransferHistory(
        token: string, 
        params: TransferQueryParams = { page: 1, limit: 10 }
    ) {
        try {
            const response = await axios.get(
                `${this.apiUrl}${ApiEndpoints.transfers.history}`,
                {
                    params,
                    headers: this.getHeaders(token)
                }
            );
            return response.data;
        } catch (error) {
            return handleAxiosError(error as AxiosError);
        }
    }
}
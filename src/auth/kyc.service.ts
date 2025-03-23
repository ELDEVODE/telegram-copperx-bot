import axios, { AxiosError } from 'axios';
import { CopperxConfig, ApiEndpoints } from '../config';
import type { KycResponse } from '../types';
import { logger } from '../utils/logger';

export class KycService {
    private readonly apiUrl: string;

    constructor() {
        this.apiUrl = CopperxConfig.apiUrl;
    }

    private getHeaders(token: string) {
        return { Authorization: `Bearer ${token}` };
    }

    async getKycStatus(token: string): Promise<KycResponse> {
        try {
            const response = await axios.get(
                `${this.apiUrl}${ApiEndpoints.kyc.list}`,
                { 
                    headers: this.getHeaders(token),
                    params: { limit: 1, page: 1 }
                }
            );
            return response.data;
        } catch (error) {
            const axiosError = error as AxiosError;
            logger.error('KYC status fetch failed', error as Error);
            throw new Error(axiosError.response?.data?.message || 'Failed to fetch KYC status');
        }
    }
}
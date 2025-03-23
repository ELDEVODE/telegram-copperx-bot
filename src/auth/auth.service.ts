import axios, { AxiosError } from 'axios';
import { CopperxConfig, ApiEndpoints } from '../config';
import type { AuthResponse, User } from '../types';
import { KycService } from './kyc.service';
import { logger } from '../utils/logger';

export class AuthService {
    private readonly apiUrl: string;
    private readonly kycService: KycService;
    private readonly TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds
    private tokenRefreshPromises: Map<string, Promise<string>> = new Map();

    constructor() {
        this.apiUrl = CopperxConfig.apiUrl;
        this.kycService = new KycService();
    }

    private getHeaders(token: string) {
        return { Authorization: `Bearer ${token}` };
    }

    async requestOTP(email: string): Promise<{ success: boolean; message: string; sid: string }> {
        try {
            const response = await axios.post(`${this.apiUrl}${ApiEndpoints.auth.requestOtp}`, { email });
            return { 
                success: true, 
                message: 'OTP sent successfully',
                sid: response.data.sid
            };
        } catch (error) {
            const axiosError = error as AxiosError;
            const errorMessage = axiosError.response?.data?.message || 'Failed to send OTP';
            logger.error('Request OTP failed', error as Error, { email });
            throw new Error(errorMessage);
        }
    }

    async authenticate(email: string, otp: string, sid: string): Promise<AuthResponse> {
        try {
            const response = await axios.post<AuthResponse>(
                `${this.apiUrl}${ApiEndpoints.auth.authenticate}`, 
                { email, otp, sid }
            );
            return {
                accessToken: response.data.accessToken,
                refreshToken: response.data.refreshToken,
                user: response.data.user
            };
        } catch (error) {
            const axiosError = error as AxiosError;
            const errorMessage = axiosError.response?.data?.message || 'Authentication failed';
            logger.error('Authentication failed', error as Error, { email });
            throw new Error(errorMessage);
        }
    }

    async getProfile(token: string): Promise<User> {
        try {
            const response = await axios.get<User>(
                `${this.apiUrl}${ApiEndpoints.auth.profile}`, 
                { headers: this.getHeaders(token) }
            );

            // Fetch KYC status and update user profile
            try {
                const kycResponse = await this.kycService.getKycStatus(token);
                const latestKyc = kycResponse.data[0];
                if (latestKyc) {
                    response.data.isKycApproved = latestKyc.status === 'approved';
                }
            } catch (kycError) {
                logger.warn('Failed to fetch KYC status', kycError as Error);
            }

            return response.data;
        } catch (error) {
            const axiosError = error as AxiosError;
            logger.error('Get profile failed', error as Error);
            if (axiosError.response?.status === 401) {
                throw new Error('Invalid token');
            }
            throw new Error(axiosError.response?.data?.message || 'Failed to fetch profile');
        }
    }

    async validateSession(token: string): Promise<boolean> {
        try {
            await this.getProfile(token);
            return true;
        } catch (error) {
            if (error instanceof Error && error.message === 'Invalid token') {
                return false;
            }
            throw error;
        }
    }

    async refreshToken(refreshToken: string): Promise<string> {
        // Check if there's already a refresh operation in progress for this token
        let refreshPromise = this.tokenRefreshPromises.get(refreshToken);
        if (refreshPromise) {
            return refreshPromise;
        }

        // Create new refresh operation
        refreshPromise = (async () => {
            try {
                const response = await axios.post(`${this.apiUrl}${ApiEndpoints.auth.refresh}`, {
                    refreshToken
                });
                return response.data.accessToken;
            } catch (error: any) {
                logger.error('Token refresh failed', error);
                throw new Error('Failed to refresh session');
            } finally {
                // Clean up the promise from the map
                this.tokenRefreshPromises.delete(refreshToken);
            }
        })();

        // Store the promise
        this.tokenRefreshPromises.set(refreshToken, refreshPromise);
        return refreshPromise;
    }

    async isTokenExpiringSoon(token: string): Promise<boolean> {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return true;

            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            const expirationTime = payload.exp * 1000; // Convert to milliseconds
            const currentTime = Date.now();

            return (expirationTime - currentTime) < this.TOKEN_REFRESH_THRESHOLD;
        } catch (error) {
            logger.error('Token expiration check failed', error);
            return true;
        }
    }
}
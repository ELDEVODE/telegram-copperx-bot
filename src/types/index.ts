import { Context } from 'telegraf';
import type { CurrencyCode } from '../utils/format';

export interface AuthResponse {
    accessToken: string | undefined;
    token: string;
    user: User;
}

export interface User {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    organizationId: string;
    isKycApproved: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Wallet {
    id: string;
    createdAt: string;
    updatedAt: string;
    organizationId: string;
    walletType: string;
    network: string;
    walletAddress: string;
    isDefault: boolean;
}

export interface Balance {
    decimals: number;
    balance: string;
    symbol: string;
    address: string;
}

export interface WalletBalance {
    walletId: string;
    isDefault: boolean;
    network: string;
    balances: Balance[];
}

export interface TransferQueryParams {
    page?: number;
    limit?: number;
    sourceCountry?: string;
    destinationCountry?: string;
    status?: 'pending' | 'initiated' | 'processing' | 'success' | 'canceled' | 'failed' | 'refunded';
    sync?: boolean;
    type?: Array<'send' | 'receive' | 'withdraw' | 'deposit' | 'bridge' | 'bank_deposit'>;
    startDate?: string;
    endDate?: string;
}

export interface TransferAccount {
    id: string;
    createdAt: string;
    updatedAt: string;
    type: 'web3_wallet' | 'bank_account' | 'email';
    country: string;
    network?: string;
    accountId?: string;
    walletAddress?: string;
    bankName?: string;
    bankAddress?: string;
    bankRoutingNumber?: string;
    bankAccountNumber?: string;
    bankDepositMessage?: string;
    wireMessage?: string;
    payeeEmail?: string;
    payeeOrganizationId?: string;
    payeeId?: string;
    payeeDisplayName?: string;
}

export interface Transfer {
    id: string;
    createdAt: string;
    updatedAt: string;
    organizationId: string;
    status: 'pending' | 'initiated' | 'processing' | 'success' | 'canceled' | 'failed' | 'refunded';
    customerId: string;
    type: 'send' | 'receive' | 'withdraw' | 'deposit' | 'bridge' | 'bank_deposit';
    sourceCountry: string;
    destinationCountry: string;
    destinationCurrency: string;
    amount: string;
    currency: string;
    amountSubtotal: string;
    totalFee: string;
    feePercentage: string;
    feeCurrency: string;
    invoiceNumber?: string;
    invoiceUrl?: string;
    sourceOfFundsFile?: string;
    note?: string;
    purposeCode: string;
    sourceOfFunds: string;
    recipientRelationship: string;
    sourceAccountId: string;
    destinationAccountId: string;
    paymentUrl?: string;
    mode: 'on_ramp' | 'off_ramp';
    isThirdPartyPayment: boolean;
    sourceAccount?: TransferAccount;
    destinationAccount?: TransferAccount;
    senderDisplayName?: string;
}

export interface TransferStateData {
    recipientEmail?: string;
    recipientAddress?: string;
    amount?: string;
    currency?: CurrencyCode;
    network?: string;
    fee?: string;
    feeCurrency?: string;
    total?: string;
}

export interface TransferState {
    type: 'EMAIL' | 'WITHDRAW';
    step: 'AWAITING_EMAIL' | 'AWAITING_ADDRESS' | 'AWAITING_AMOUNT' | 'AWAITING_CURRENCY' | 'AWAITING_NETWORK';
    data: TransferStateData;
}

export interface KycDocument {
    id: string;
    documentType: 'passport' | 'drivers_license' | 'identity_card';
    status: 'pending' | 'approved' | 'rejected';
    frontFileName?: string;
    backFileName?: string;
}

export interface KycVerification {
    id: string;
    status: 'pending' | 'approved' | 'rejected';
    externalStatus?: string;
    verifiedAt?: string;
}

export interface KycDetail {
    id: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    email: string;
    nationality: string;
    dateOfBirth: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    currentKycVerification?: KycVerification;
    kycDocuments?: KycDocument[];
    kycUrl?: string;
}

export interface Kyc {
    id: string;
    status: 'pending' | 'approved' | 'rejected';
    type: 'individual' | 'corporate';
    country: string;
    kycDetail?: KycDetail;
    createdAt: string;
    updatedAt: string;
}

export interface KycResponse {
    page: number;
    limit: number;
    count: number;
    hasMore: boolean;
    data: Kyc[];
}

export interface BotContext extends Context {
    session: {
        token?: string;
        email?: string;
        state?: string;
        sid?: string;  // Add session ID to the context
        transferState?: TransferState;
    }
}
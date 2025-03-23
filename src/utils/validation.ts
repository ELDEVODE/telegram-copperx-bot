import { CurrencyCode, Currencies } from './format';

export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function isValidAmount(amount: string, currency: CurrencyCode): boolean {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return false;
    
    const decimals = Currencies[currency].decimals;
    const decimalPart = amount.includes('.') ? amount.split('.')[1].length : 0;
    return decimalPart <= decimals;
}

export function isValidEthereumAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function isValidBitcoinAddress(address: string): boolean {
    // Support for legacy, segwit and native segwit addresses
    return /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(address);
}

export function isValidWalletAddress(address: string, network: string): boolean {
    switch (network.toLowerCase()) {
        case 'ethereum':
            return isValidEthereumAddress(address);
        case 'bitcoin':
            return isValidBitcoinAddress(address);
        default:
            return false;
    }
}

export function validateTransferData(data: {
    amount: string;
    currency: string;
    recipient: string;
    network?: string;
}): { isValid: boolean; error?: string } {
    if (!data.amount || !data.currency || !data.recipient) {
        return { isValid: false, error: 'Missing required fields' };
    }

    if (!Object.keys(Currencies).includes(data.currency)) {
        return { isValid: false, error: 'Invalid currency' };
    }

    if (!isValidAmount(data.amount, data.currency as CurrencyCode)) {
        return { isValid: false, error: 'Invalid amount' };
    }

    // For email transfers
    if (data.recipient.includes('@')) {
        if (!isValidEmail(data.recipient)) {
            return { isValid: false, error: 'Invalid email format' };
        }
    }
    // For wallet transfers
    else if (data.network) {
        if (!isValidWalletAddress(data.recipient, data.network)) {
            return { isValid: false, error: 'Invalid wallet address' };
        }
    } else {
        return { isValid: false, error: 'Network required for wallet transfers' };
    }

    return { isValid: true };
}

export function validateCSVData(data: string[][], type: 'email' | 'wallet'): { 
    isValid: boolean; 
    error?: string; 
    line?: number 
} {
    if (data.length === 0) {
        return { isValid: false, error: 'Empty CSV file' };
    }

    if (data.length > 50) {
        return { isValid: false, error: 'Maximum 50 transfers allowed' };
    }

    const expectedHeaders = type === 'email' 
        ? ['email', 'amount', 'currency']
        : ['address', 'amount', 'currency', 'network'];

    const headers = data[0].map(h => h.toLowerCase());
    if (!expectedHeaders.every(h => headers.includes(h))) {
        return { isValid: false, error: 'Invalid CSV headers' };
    }

    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row.length !== expectedHeaders.length) {
            return { isValid: false, error: 'Invalid number of columns', line: i + 1 };
        }

        const [recipient, amount, currency, network] = type === 'email' 
            ? [row[0], row[1], row[2], undefined]
            : [row[0], row[1], row[2], row[3]];

        const validation = validateTransferData({
            amount,
            currency,
            recipient,
            network
        });

        if (!validation.isValid) {
            return { 
                isValid: false, 
                error: `${validation.error} in row ${i + 1}`,
                line: i + 1
            };
        }
    }

    return { isValid: true };
}

export function validateApiKey(apiKey: string): boolean {
    // Basic validation for API key format
    return /^[A-Za-z0-9_-]{32,}$/.test(apiKey);
}
// Helper functions for formatting various data types
export function formatAmount(amount: string | number, currency: CurrencyCode): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    const config = Currencies[currency];
    
    if (isNaN(num)) {
        throw new Error('Invalid amount');
    }

    const formattedNum = num.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: config.decimals
    });

    return `${config.symbol}${formattedNum}`;
}

export const formatAddress = (address: string, length: number = 8): string => {
    if (address.length <= length * 2) return address;
    return `${address.slice(0, length)}...${address.slice(-length)}`;
};

export function formatDate(date: string | Date): string {
    const d = new Date(date);
    return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Commonly used messages across the bot
export const Messages = {
    welcome: `
🤖 Welcome to CopperX Bot!

I can help you manage your crypto assets, send transfers, and more.
Use /help to see available commands.`,

    help: `
Available commands:

🔐 Authentication
/login - Login to your account
/logout - Logout from your account

💰 Wallet
/balance - Check your wallet balance
/send - Send crypto to email or wallet
/withdraw - Withdraw to external wallet
/deposit - Show deposit addresses

📊 History & Settings
/history - View transaction history
/settings - Manage your preferences

Need help? Contact support at support@copperx.io`,

    prompts: {
        enterEmail: '📧 Please enter the recipient\'s email address:',
        enterAddress: '🔑 Please enter the recipient\'s wallet address:',
        enterAmount: '💰 Please enter the amount to send:',
        selectCurrency: '💱 Please select the currency:',
        selectNetwork: '🌐 Please select the network:',
        confirmTransfer: '✅ Please confirm your transfer:',
        login: '🔐 Please enter your API key:',
        bulk: `📥 To perform bulk transfers, please upload a CSV file with the following format:

For email transfers:
email,amount,currency
user@example.com,100,USD

For wallet transfers:
address,amount,currency,network
0x1234...,0.1,ETH,ethereum

Maximum 50 transfers per file.`
    },

    success: {
        login: '✅ Successfully logged in!',
        logout: '👋 Successfully logged out!',
        transfer: '✅ Transfer completed successfully!',
        settings: '✅ Settings updated successfully!'
    },

    errors: {
        invalidEmail: '❌ Invalid email format. Please try again.',
        invalidAmount: '❌ Invalid amount. Please enter a positive number.',
        invalidAddress: '❌ Invalid wallet address. Please check and try again.',
        insufficientFunds: '❌ Insufficient funds for this transfer.',
        unauthorized: '🔒 Please login first using /login',
        apiError: '❌ An error occurred. Please try again later.',
        rateLimit: '⚠️ Too many requests. Please wait a moment.',
        csvFormat: '❌ Invalid CSV format. Please check the template.',
        maxTransfers: '❌ Maximum 50 transfers per file allowed.'
    }
};

// Common currency configurations
export const Currencies = {
    USD: { symbol: '$', decimals: 2, name: 'US Dollar' },
    BTC: { symbol: '₿', decimals: 8, name: 'Bitcoin' },
    ETH: { symbol: 'Ξ', decimals: 18, name: 'Ethereum' },
    USDT: { symbol: '₮', decimals: 6, name: 'Tether' }
} as const;

export type CurrencyCode = keyof typeof Currencies;

// Validation helpers
export const isValidAmount = (amount: string): boolean => {
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0 && /^\d+(\.\d+)?$/.test(amount);
};

export const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export function formatTransferHistory(transfer: Transfer): string {
    let message = `💸 Transfer ${transfer.id}\n`;
    message += `Type: ${transfer.type.toUpperCase()}\n`;
    message += `Amount: ${formatAmount(transfer.amount, transfer.currency as CurrencyCode)} ${transfer.currency}\n`;
    message += `Status: ${transfer.status}\n`;
    message += `Date: ${formatDate(transfer.createdAt)}\n`;

    if (transfer.totalFee !== '0') {
        message += `Fee: ${formatAmount(transfer.totalFee, transfer.feeCurrency as CurrencyCode)} ${transfer.feeCurrency}\n`;
    }

    // Add recipient details based on the destination account
    if (transfer.destinationAccount) {
        if (transfer.destinationAccount.type === 'email' && transfer.destinationAccount.payeeEmail) {
            message += `To: ${transfer.destinationAccount.payeeEmail}\n`;
        } else if (transfer.destinationAccount.type === 'web3_wallet' && transfer.destinationAccount.walletAddress) {
            message += `To: ${formatAddress(transfer.destinationAccount.walletAddress)}\n`;
            if (transfer.destinationAccount.network) {
                message += `Network: ${transfer.destinationAccount.network}\n`;
            }
        } else if (transfer.destinationAccount.type === 'bank_account') {
            message += `To: ${transfer.destinationAccount.bankName || 'Bank Account'}\n`;
        }
    }

    // Add payment URL if available
    if (transfer.paymentUrl) {
        message += `Payment Link: ${transfer.paymentUrl}\n`;
    }

    return message;
}

export function formatError(error: any): string {
    if (typeof error === 'string') {
        return `❌ ${error}`;
    }
    
    if (error.message) {
        return `❌ ${error.message}`;
    }
    
    return Messages.errors.apiError;
}

export function formatBalance(balances: Record<string, string>): string {
    let message = '💰 Your current balance:\n\n';
    
    for (const [currency, amount] of Object.entries(balances)) {
        if (currency in Currencies) {
            message += `${formatAmount(amount, currency as CurrencyCode)} ${currency}\n`;
        }
    }
    
    return message;
}

export function formatTransfer(data: {
    amount: string;
    currency: CurrencyCode;
    recipient: string;
    network?: string;
}): string {
    return `
Transfer Details:
Amount: ${formatAmount(data.amount, data.currency)} ${data.currency}
To: ${data.recipient}
${data.network ? `Network: ${data.network}` : ''}

Please verify all details before confirming.`;
}

export function formatHistory(transactions: any[], page: number, totalPages: number): string {
    if (transactions.length === 0) {
        return '📊 No transactions found.';
    }

    let message = '📊 Transaction History:\n\n';
    
    for (const tx of transactions) {
        const date = new Date(tx.timestamp).toLocaleString();
        const amount = formatAmount(tx.amount, tx.currency as CurrencyCode);
        const type = tx.type === 'in' ? '📥' : '📤';
        
        message += `${type} ${amount} ${tx.currency}\n`;
        message += `📅 ${date}\n`;
        message += `🔍 ${tx.id}\n\n`;
    }
    
    message += `Page ${page}/${totalPages}`;
    return message;
}

export function formatWalletAddress(address: string): string {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

export function formatNetworkFee(fee: string, currency: CurrencyCode): string {
    return `Network Fee: ${formatAmount(fee, currency)} ${currency}`;
}

export function formatCSVTemplate(type: 'email' | 'wallet'): string {
    if (type === 'email') {
        return 'email,amount,currency\nuser@example.com,100,USD\nother@example.com,50,USDT';
    } else {
        return 'address,amount,currency,network\n0x1234...,0.1,ETH,ethereum\nbc1...,0.01,BTC,bitcoin';
    }
}

export function formatWalletBalances(balances: WalletBalance[]): string {
    if (!balances.length) return 'No balances found';

    return balances.map(wallet => {
        const balanceStr = wallet.balances.map(bal => 
            `${formatAmount(bal.balance, bal.symbol)}`
        ).join('\n');

        return `${wallet.network} ${wallet.isDefault ? '(Default)' : ''}\n${balanceStr}`;
    }).join('\n\n');
}

export function formatWalletDetails(wallet: Wallet): string {
    return `🏦 Wallet Details
Network: ${wallet.network}
Address: ${formatAddress(wallet.walletAddress)}
Type: ${wallet.walletType}
Default: ${wallet.isDefault ? 'Yes' : 'No'}
Created: ${formatDate(wallet.createdAt)}`;
}
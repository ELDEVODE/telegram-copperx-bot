# CopperX Telegram Bot

A secure and feature-rich Telegram bot for the CopperX platform that enables users to manage crypto assets, perform transfers, and track transactions in real-time.

## Features

### Authentication & Security
- **Email-based OTP Authentication**
  - Secure login with email verification
  - Rate-limited OTP requests to prevent abuse
  - Auto-logout for inactive sessions
- **Session Management**
  - Persistent session storage
  - Token-based authentication with auto-refresh
  - Secure session cleanup for inactive users
- **KYC Integration**
  - KYC status verification
  - Direct links to complete KYC process
  - Real-time KYC status updates

### Wallet Management
- **Multi-Currency Support**
  - USD, BTC, ETH, USDT balances
  - Real-time balance updates via Pusher
  - Custom currency display preferences
- **Wallet Features**
  - Multiple wallet support
  - Default wallet selection
  - QR code generation for addresses
  - One-click address copying
- **Deposit & Withdrawal**
  - Network-specific deposit addresses
  - Support for multiple blockchain networks
  - Fee calculation and previews

### Transfer Capabilities
- **P2P Transfers**
  - Send to email addresses
  - Internal wallet transfers
  - Transfer confirmation flow
  - Fee calculation and preview
- **External Transfers**
  - Withdraw to external wallets
  - Multi-network support (Ethereum, Bitcoin, etc.)
  - Address validation by network
- **Bulk Operations**
  - CSV-based bulk transfers (up to 50 transfers)
  - Email and wallet transfer templates
  - Batch processing with detailed results
  - Transfer validation and error reporting

### Transaction Management
- **History & Tracking**
  - Paginated transaction history
  - Real-time status updates
  - Detailed transfer information
  - Transaction search and filtering
- **Transfer States**
  - Pending/Processing/Completed states
  - Error handling and notifications
  - Cancellation support where applicable

### User Preferences
- **Customization Options**
  - Default currency selection
  - Display format (detailed/compact)
  - Language preferences
  - Timezone settings
- **Notification Settings**
  - Deposit notifications
  - Transfer status updates
  - Custom alert preferences

### Technical Features
- **Rate Limiting**
  - Configurable request limits
  - Per-action rate limiting
  - Automatic cooldown periods
- **Error Handling**
  - Graceful error recovery
  - User-friendly error messages
  - Detailed error logging
- **Real-time Updates**
  - Pusher integration for live updates
  - Balance change notifications
  - Transaction status updates

## Setup

### Prerequisites
- Node.js 16+ or Bun runtime
- CopperX API credentials
- Telegram Bot Token
- Pusher account (for real-time features)

### Environment Configuration
Create a `.env` file with these settings:
```env
# Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
COPPERX_API_URL=https://income-api.copperx.io/api
PLATFORM_URL=https://payout.copperx.io/app

# Real-time Updates
PUSHER_KEY=your_pusher_key
PUSHER_CLUSTER=ap1

# Logging Configuration
LOG_LEVEL=DEBUG  # Options: DEBUG, INFO, WARN, ERROR
LOG_DIR=logs
LOG_MAX_FILES=7
LOG_MAX_SIZE=10485760  # 10MB

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=30
RATE_LIMIT_WINDOW_MS=60000
```

### Installation

```bash
# Using Bun (recommended)
bun install

# Using npm
npm install
```

### Running the Bot

```bash
# Development with Bun
bun run dev

# Development with npm
npm run dev

# Production build
bun run build
npm run build

# Start production server
bun run start
npm run start
```

## Command Reference

### Authentication Commands
- `/start` - Initialize bot and see welcome message
- `/login` - Start email authentication flow
- `/logout` - End current session
- `/kyc` - Check KYC status and get verification link

### Wallet Commands
- `/balance` (or `/b`) - Display current balances
- `/wallets` (or `/w`) - List all linked wallets
- `/default_wallet` - View/change default wallet
- `/deposit` - Show deposit addresses

### Transfer Commands
- `/send` (or `/s`) - Initiate new transfer
  - Email transfer option
  - Wallet transfer option
- `/withdraw` - Start external withdrawal
  - Crypto withdrawal
  - Bank withdrawal (requires KYC)
- `/history` (or `/h`) - View transaction history
- `/bulk_transfer` - Start bulk transfer process
- `/bulk_template` - Download CSV templates

### Settings Commands
- `/settings` (or `/set`) - Access preferences menu
- `/help` - View available commands
- `/support` - Get support information

## Project Structure

```
src/
├── auth/           # Authentication & KYC handlers
├── commands/       # Command implementations
├── handlers/       # Menu & interaction handlers
├── middleware/     # Auth & rate limiting
├── transfers/      # Transfer & bulk transfer logic
├── types/         # TypeScript definitions
├── utils/         # Shared utilities
├── wallet/        # Wallet management
└── config.ts      # Configuration
```

## Development

### Architecture
- **Command Pattern**: Modular command handlers for each feature
- **Middleware**: Authentication and rate limiting
- **Services**: API communication layer
- **Utils**: Shared formatting, validation, and logging

### Key Components
- **Session Store**: Manages user sessions and tokens
- **Preferences Manager**: Handles user preferences
- **Menu Builder**: Constructs interactive menus
- **Transfer State Machine**: Manages transfer flows

### Error Handling
- Comprehensive error tracking
- Rate limit violation handling
- Session expiration management
- API error recovery

### Logging
- Multi-level logging (DEBUG, INFO, WARN, ERROR)
- Automatic log rotation
- Separate error logs
- Structured logging with metadata

## Contributing
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to your branch
5. Open a pull request

## License
This project is proprietary software. All rights reserved.
See LICENSE file for details.

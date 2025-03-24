# CopperX Telegram Bot 🤖

<p align="center">
  <img src="https://copperx.io/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Ffooter-logo.4356bc27.svg&w=96&q=75" alt="CopperX Logo" />
</p>

A secure and feature-rich Telegram bot for the CopperX platform that enables users to manage crypto assets, perform transfers, and track transactions in real-time.

## ✨ Features

### 🔐 Authentication & Security
- **Email-based OTP Authentication**
  - Secure login with email verification
  - Session token management
  - Auto-logout for inactive sessions
- **Session Management**
  - Persistent session storage
  - Token-based authentication
  - Automatic session cleanup
- **KYC Integration**
  - KYC status verification
  - Direct links to complete KYC process
  - Real-time status display

### 💼 Wallet Management
- **Multi-Currency Support**
  - USD, BTC, ETH, USDT balances
  - Real-time balance updates via Pusher
  - Currency display preferences
- **Wallet Features**
  - Multiple wallet management
  - Default wallet selection
  - QR code address display
  - Address copy functionality
- **Deposit & Withdrawal**
  - Network-specific addresses
  - Multi-network support
  - Fee preview and calculation

### 💸 Transfer Capabilities
- **P2P Transfers**
  - Send to email addresses
  - Internal wallet transfers
  - Transfer confirmation flow
- **External Transfers**
  - Withdraw to external wallets
  - Support for ETH, BTC, USDT networks
  - Address validation
- **Bulk Operations**
  - CSV-based transfers
  - Email and wallet templates
  - Batch processing (up to 50 transfers)
  - Error reporting

### 📊 Transaction Management
- **History & Tracking**
  - Paginated history display
  - Transfer status updates
  - Detailed transaction info
  - Status filtering
- **Transfer States**
  - Pending/Processing/Completed states
  - Error handling
  - Support for cancellation

### ⚙️ User Preferences
- **Display Options**
  - Default currency setting
  - Detailed/Compact view modes
  - Language selection
- **Notifications**
  - Toggle notifications
  - Transfer status alerts
  - Balance updates

### 🛠️ Technical Features
- **Rate Limiting**
  - Configurable request limits
  - Per-action limiting
  - Cooldown periods
- **Error Handling**
  - User-friendly messages
  - Error logging
  - Error recovery
- **Real-time Updates**
  - Pusher integration
  - Balance notifications
  - Transfer updates

## 🚀 Setup

### 📋 Prerequisites
- Node.js 16+ or Bun runtime
- CopperX API credentials
- Telegram Bot Token
- Pusher account (optional)

### 🔧 Environment Configuration
Create a `.env` file with these settings:
```env
# Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
COPPERX_API_URL=https://income-api.copperx.io/api

# Real-time Updates (Optional)
PUSHER_KEY=your_pusher_key
PUSHER_CLUSTER=mt1

# Logging Configuration
LOG_LEVEL=INFO  # DEBUG, INFO, WARN, ERROR
LOG_DIR=logs
LOG_MAX_FILES=7
LOG_MAX_SIZE=10485760  # 10MB

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=30
RATE_LIMIT_WINDOW_MS=60000
```

### 📦 Installation

```bash
# Using Bun (recommended)
bun install

# Using npm
npm install
```

### 🏃‍♂️ Running the Bot

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

## 📝 Command Reference

### 🔑 Authentication Commands
- `/start` - Start bot and get welcome message
- `/login` - Begin authentication flow
- `/logout` - End your session
- `/kyc` - Check KYC verification status

### 👛 Wallet Commands
- `/balance` (or `/b`) - View balances
- `/wallets` (or `/w`) - List wallets
- `/default_wallet` - Set default wallet

### 📤 Transfer Commands
- `/send` (or `/s`) - Start new transfer
  - Send to email
  - Send to wallet
- `/withdraw` - External withdrawal
- `/history` (or `/h`) - View transfers
- `/bulk_transfer` - Bulk transfer mode
- `/bulk_template` - Get CSV templates

### ⚙️ Settings Commands
- `/settings` - Change preferences
- `/help` - Show commands
- `/support` - Get help

## 📁 Project Structure

```
src/
├── auth/           # Auth & KYC logic
├── commands/       # Command handlers
├── handlers/       # Menu handlers
├── middleware/     # Auth & rate limiting
├── transfers/      # Transfer logic
├── types/         # Type definitions
├── utils/         # Shared utilities
├── wallet/        # Wallet logic
└── config.ts      # Configuration
```

## 💻 Development

### 🔧 Core Components
- **Handlers**: Command and menu interaction logic
- **Services**: API communication layer
- **Utils**: Formatting, validation, logging
- **Middleware**: Auth and rate limiting

### 🎯 Key Features
- Session management
- User preferences
- Interactive menus
- Transfer processing

### ⚠️ Error Handling
- Error tracking
- Rate limit handling
- Session management
- Recovery logic

### 📋 Logging
- Multiple log levels
- Automatic rotation
- Error logging
- Metadata support

## 🤝 Contributing
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to your branch
5. Open a pull request

## 📄 License
This project is proprietary software. All rights reserved.
See LICENSE file for details.

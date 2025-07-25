# GiveFi Admin Access Control System

## Overview

Your GiveFi platform now has a robust admin access control system that ensures only authorized wallets can create and manage raffles. Here's how it works:

## Security Features

### 🔒 Wallet-Based Access Control
- Only wallets in the `AUTHORIZED_ADMIN_WALLETS` array can access admin functions
- All admin actions require wallet connection AND authorization verification
- Unauthorized wallets see an "Access Denied" screen

### 🛡️ Protected Admin Functions
The following functions now require admin authorization:
- `createRaffle()` - Create new raffles
- `selectWinner()` - Select raffle winners
- `endRaffle()` - End raffles early
- `pauseRaffle()` - Pause active raffles
- `withdrawFunds()` - Withdraw accumulated funds
- `viewParticipants()` - View participant lists
- `exportParticipants()` - Export participant data

## Setup Instructions

### Method 1: Automatic Setup (Recommended)
1. Run the setup script:
   ```bash
   ./setup-admin.sh
   ```
2. Enter your Solana wallet address when prompted
3. Confirm the address
4. The script will automatically update both admin files

### Method 2: Manual Setup
1. Open `admin.html` and `deploy/admin.html`
2. Find this line (around line 790):
   ```javascript
   const AUTHORIZED_ADMIN_WALLETS = [
       'YOUR_WALLET_ADDRESS_HERE',
   ];
   ```
3. Replace `'YOUR_WALLET_ADDRESS_HERE'` with your actual Solana wallet address
4. Save both files

### Method 3: Multiple Admins
To add multiple admin wallets, edit the array like this:
```javascript
const AUTHORIZED_ADMIN_WALLETS = [
    'YourMainWalletAddress123...',
    'YourBackupWalletAddress456...',
    'AnotherAdminWalletAddress789...',
];
```

## How It Works

### 1. Connection Process
1. User visits admin panel (`admin.html`)
2. Clicks "Connect Wallet"
3. System checks if connected wallet is in `AUTHORIZED_ADMIN_WALLETS`
4. If authorized: Full admin access granted
5. If unauthorized: "Access Denied" screen shown

### 2. Access Control Flow
```
User connects wallet
       ↓
checkAdminAccess(walletAddress)
       ↓
Is wallet in AUTHORIZED_ADMIN_WALLETS?
       ↓                    ↓
     YES                   NO
       ↓                    ↓
Admin Interface      Access Denied Screen
```

### 3. Runtime Protection
- Every admin function checks `isAuthorizedAdmin` flag
- Functions return early with error if not authorized
- User sees appropriate error messages

## Configuration States

### ⚠️ Unconfigured (Default)
- Red warning banner appears: "SETUP REQUIRED"
- Placeholder address `YOUR_WALLET_ADDRESS_HERE` is present
- Console warning logged

### ✅ Configured
- No warning banner
- Your actual wallet address is in the authorized list
- Full admin functionality available

## Getting Your Wallet Address

### Phantom Wallet
1. Open Phantom wallet
2. Click your wallet name at the top
3. Click "Copy Address"
4. This is your wallet address

### Solflare Wallet
1. Open Solflare wallet
2. Click the copy icon next to your address
3. This is your wallet address

### Other Wallets
- Look for "Copy Address", "Copy Public Key", or similar option
- The address should be 32-44 characters long

## Security Best Practices

### ✅ Do's
- Use a dedicated admin wallet for managing the platform
- Keep your private keys secure and never share them
- Regularly backup your wallet
- Consider using a hardware wallet for admin functions
- Test with small amounts first

### ❌ Don'ts
- Never share your wallet's private key or seed phrase
- Don't use the same wallet for high-risk activities
- Don't store large amounts of SOL in your admin wallet
- Don't give admin access to untrusted wallets

## Troubleshooting

### "Access Denied" Error
**Problem**: Can't access admin panel after connecting wallet
**Solution**: 
1. Verify your wallet address is correctly added to `AUTHORIZED_ADMIN_WALLETS`
2. Check for typos in the wallet address
3. Ensure you're connecting with the correct wallet

### "Admin access required" Messages
**Problem**: Admin functions show access errors
**Solution**:
1. Disconnect and reconnect your wallet
2. Refresh the page
3. Verify your wallet is authorized

### Configuration Warning Won't Go Away
**Problem**: Red warning banner still appears
**Solution**:
1. Check that you replaced `YOUR_WALLET_ADDRESS_HERE` with your actual address
2. Ensure the address is in quotes: `'YourActualAddress123...'`
3. Refresh the page

## Example Configuration

Here's what a properly configured admin section looks like:

```javascript
// ADMIN ACCESS CONTROL - Add your wallet address here
const AUTHORIZED_ADMIN_WALLETS = [
    // Replace this with your actual wallet address
    'B1aU7TkJ8yVvQ2sF9dN3mR7eX4pL6hK5nW8zT1qY3oI2',
    // You can add multiple admin wallets if needed
    // 'ANOTHER_ADMIN_WALLET_ADDRESS',
];
```

## Admin Panel URL

Once configured, access your admin panel at:
- Local: `file:///path/to/your/project/admin.html`
- Live: `https://givefi.fun/admin.html`

## Need Help?

If you encounter issues:
1. Check the browser console for error messages
2. Verify your wallet address format
3. Ensure your wallet has some SOL for transaction fees
4. Try disconnecting and reconnecting your wallet

Your GiveFi platform is now secured with proper admin access controls! 🚀

#!/bin/bash

echo "🔧 GiveFi Admin Setup Script"
echo "=============================="
echo ""
echo "This script will help you configure your admin wallet address."
echo ""

# Get user's wallet address
read -p "Enter your Solana wallet address (the one you want to use as admin): " WALLET_ADDRESS

# Validate the input (basic check)
if [ ${#WALLET_ADDRESS} -lt 32 ]; then
    echo "❌ Error: Wallet address seems too short. Please check and try again."
    exit 1
fi

echo ""
echo "📋 You entered: $WALLET_ADDRESS"
read -p "Is this correct? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "❌ Setup cancelled."
    exit 1
fi

echo ""
echo "🔧 Updating admin configuration..."

# Update both admin.html files
sed -i "s/YOUR_WALLET_ADDRESS_HERE/$WALLET_ADDRESS/g" admin.html
sed -i "s/YOUR_WALLET_ADDRESS_HERE/$WALLET_ADDRESS/g" deploy/admin.html

echo "✅ Admin configuration updated!"
echo ""
echo "🎯 Next steps:"
echo "1. Your wallet address has been set as the authorized admin"
echo "2. Only your wallet can now access the admin panel functions"
echo "3. Visit admin.html and connect your wallet to start creating raffles"
echo ""
echo "🔒 Security Note: Keep your wallet secure and never share your private keys!"
echo ""
echo "🚀 You can now manage your GiveFi platform at: givefi.fun/admin.html"

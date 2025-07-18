#!/bin/bash
# GiveFi Deployment Script
# Usage: ./scripts/deploy.sh [devnet|mainnet]

set -e

NETWORK=${1:-devnet}
PROJECT_ROOT=$(pwd)
SCRIPTS_DIR="$PROJECT_ROOT/scripts"
SMART_CONTRACTS_DIR="$PROJECT_ROOT/smart-contracts"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 GiveFi Deployment Script${NC}"
echo -e "${BLUE}Network: ${NETWORK}${NC}"
echo ""

# Validate network
if [[ "$NETWORK" != "devnet" && "$NETWORK" != "mainnet" ]]; then
    echo -e "${RED}❌ Invalid network. Use 'devnet' or 'mainnet'${NC}"
    exit 1
fi

# Check prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

command -v anchor >/dev/null 2>&1 || { echo -e "${RED}❌ Anchor CLI not found. Please install: npm install -g @coral-xyz/anchor-cli${NC}"; exit 1; }
command -v solana >/dev/null 2>&1 || { echo -e "${RED}❌ Solana CLI not found. Please install from https://docs.solana.com/cli/install-solana-cli-tools${NC}"; exit 1; }

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Set Solana config
echo -e "${YELLOW}⚙️ Configuring Solana CLI...${NC}"
if [[ "$NETWORK" == "mainnet" ]]; then
    solana config set --url mainnet-beta
else
    solana config set --url devnet
fi

# Check wallet balance
BALANCE=$(solana balance --lamports 2>/dev/null || echo "0")
if [[ "$BALANCE" -lt 100000000 ]]; then # Less than 0.1 SOL
    echo -e "${YELLOW}⚠️ Low SOL balance. You may need more SOL for deployment.${NC}"
    if [[ "$NETWORK" == "devnet" ]]; then
        echo -e "${BLUE}💰 Requesting devnet airdrop...${NC}"
        solana airdrop 2 || echo -e "${YELLOW}⚠️ Airdrop failed, continuing anyway...${NC}"
    fi
fi

# Build the smart contract
echo -e "${YELLOW}🔨 Building smart contract...${NC}"
cd "$SMART_CONTRACTS_DIR"

# Clean previous builds
rm -rf target/

# Build
anchor build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"

# Deploy the program
echo -e "${YELLOW}🚀 Deploying to ${NETWORK}...${NC}"

if [[ "$NETWORK" == "mainnet" ]]; then
    read -p "⚠️ You're about to deploy to MAINNET. Are you sure? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        echo -e "${YELLOW}Deployment cancelled${NC}"
        exit 0
    fi
fi

# Deploy
anchor deploy

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

# Extract program ID
PROGRAM_ID=$(solana address -k target/deploy/givefi_contract-keypair.json)
echo -e "${GREEN}✅ Program deployed successfully${NC}"
echo -e "${BLUE}Program ID: ${PROGRAM_ID}${NC}"

# Generate IDL and update configs
echo -e "${YELLOW}📝 Updating configuration files...${NC}"

# Copy IDL to frontend
cp target/idl/givefi_contract.json "$FRONTEND_DIR/utils/"

# Update frontend config
node "$SCRIPTS_DIR/update-config.js" "$PROGRAM_ID" "$NETWORK"

echo -e "${GREEN}✅ Configuration updated${NC}"

# Run tests
echo -e "${YELLOW}🧪 Running deployment tests...${NC}"
anchor test --skip-local-validator

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Tests passed${NC}"
else
    echo -e "${YELLOW}⚠️ Some tests failed, but deployment was successful${NC}"
fi

# Initialize program if needed
echo -e "${YELLOW}🔧 Checking program initialization...${NC}"
node "$SCRIPTS_DIR/check-and-initialize.js" "$PROGRAM_ID" "$NETWORK"

# Final summary
echo ""
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Network: ${NETWORK}${NC}"
echo -e "${BLUE}Program ID: ${PROGRAM_ID}${NC}"
echo -e "${BLUE}Frontend Config: Updated${NC}"
echo -e "${BLUE}IDL: Generated${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "1. Test the frontend locally: cd frontend && python -m http.server 8000"
echo -e "2. Create a test giveaway using the admin panel"
echo -e "3. Test wallet connection and giveaway entry"
echo -e "4. Deploy frontend to production when ready"
echo ""
echo -e "${GREEN}🔗 Useful Links:${NC}"
echo -e "Explorer: https://explorer.solana.com/address/${PROGRAM_ID}?cluster=${NETWORK}"
echo -e "Frontend: http://localhost:8000/pages/"
echo -e "Admin: http://localhost:8000/pages/admin.html"
#!/bin/bash

# GiveFi Local Test Runner
# Runs comprehensive tests against local validator

set -e

PROJECT_ROOT=$(pwd)
SMART_CONTRACTS_DIR="$PROJECT_ROOT/smart-contracts"
TESTS_DIR="$PROJECT_ROOT/tests"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧪 GiveFi Local Test Suite${NC}"
echo -e "${BLUE}=========================${NC}"
echo ""

# Check if local validator is running
echo -e "${YELLOW}📡 Checking local validator...${NC}"

if ! solana cluster-version -u http://127.0.0.1:8899 >/dev/null 2>&1; then
    echo -e "${RED}❌ Local validator not running${NC}"
    echo -e "${YELLOW}💡 Starting local validator...${NC}"
    
    # Start validator in background
    solana-test-validator --reset --quiet &
    VALIDATOR_PID=$!
    
    # Wait for validator to be ready
    echo -e "${YELLOW}⏳ Waiting for validator to start...${NC}"
    sleep 5
    
    # Check if it's now running
    if ! solana cluster-version -u http://127.0.0.1:8899 >/dev/null 2>&1; then
        echo -e "${RED}❌ Failed to start local validator${NC}"
        kill $VALIDATOR_PID 2>/dev/null || true
        exit 1
    fi
    
    echo -e "${GREEN}✅ Local validator started${NC}"
    STARTED_VALIDATOR=true
else
    echo -e "${GREEN}✅ Local validator is running${NC}"
    STARTED_VALIDATOR=false
fi

# Configure Solana CLI for local
echo -e "${YELLOW}⚙️ Configuring Solana CLI...${NC}"
solana config set --url http://127.0.0.1:8899 --commitment confirmed

# Build the smart contract
echo -e "${YELLOW}🔨 Building smart contract...${NC}"
cd "$SMART_CONTRACTS_DIR"

# Clean and build
rm -rf target/
anchor build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    if [ "$STARTED_VALIDATOR" = true ]; then
        kill $VALIDATOR_PID 2>/dev/null || true
    fi
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"

# Deploy to local validator
echo -e "${YELLOW}🚀 Deploying to local validator...${NC}"
anchor deploy

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Deployment failed${NC}"
    if [ "$STARTED_VALIDATOR" = true ]; then
        kill $VALIDATOR_PID 2>/dev/null || true
    fi
    exit 1
fi

echo -e "${GREEN}✅ Deployment successful${NC}"

# Install test dependencies
echo -e "${YELLOW}📦 Installing test dependencies...${NC}"
cd "$TESTS_DIR"

if [ ! -f "package.json" ]; then
    cat > package.json << EOF
{
  "name": "givefi-tests",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@coral-xyz/anchor": "^0.29.0",
    "@solana/web3.js": "^1.87.6",
    "@solana/spl-token": "^0.3.9"
  }
}
EOF
fi

npm install --silent

# Run the test suite
echo -e "${YELLOW}🧪 Running test suite...${NC}"
echo ""

node local-test-suite.js

# Test results
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    echo -e "${GREEN}✅ Contract is ready for deployment${NC}"
    TEST_SUCCESS=true
else
    echo ""
    echo -e "${RED}❌ TESTS FAILED${NC}"
    echo -e "${RED}🔧 Please fix issues before deploying${NC}"
    TEST_SUCCESS=false
fi

# Cleanup
echo ""
echo -e "${YELLOW}🧹 Cleaning up...${NC}"

# Stop validator if we started it
if [ "$STARTED_VALIDATOR" = true ]; then
    echo -e "${YELLOW}🛑 Stopping local validator...${NC}"
    kill $VALIDATOR_PID 2>/dev/null || true
    wait $VALIDATOR_PID 2>/dev/null || true
fi

# Reset Solana config to devnet
solana config set --url devnet

echo -e "${GREEN}✅ Cleanup complete${NC}"

# Final status
echo ""
echo -e "${BLUE}📋 Test Summary${NC}"
echo -e "${BLUE}===============${NC}"

if [ "$TEST_SUCCESS" = true ]; then
    echo -e "${GREEN}Status: ✅ PASSED${NC}"
    echo -e "${GREEN}Ready for: Production deployment${NC}"
    exit 0
else
    echo -e "${RED}Status: ❌ FAILED${NC}"
    echo -e "${RED}Action: Fix issues and rerun tests${NC}"
    exit 1
fi
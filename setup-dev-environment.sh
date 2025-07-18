#!/bin/bash

# GiveFi Development Environment Setup
# Sets up everything needed for local development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🛠️ GiveFi Development Environment Setup${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

PROJECT_ROOT=$(pwd)

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install via package manager
install_with_manager() {
    if command_exists apt-get; then
        sudo apt-get update && sudo apt-get install -y "$1"
    elif command_exists yum; then
        sudo yum install -y "$1"
    elif command_exists brew; then
        brew install "$1"
    elif command_exists choco; then
        choco install -y "$1"
    else
        echo -e "${YELLOW}⚠️ Could not detect package manager. Please install $1 manually.${NC}"
        return 1
    fi
}

# Check and install prerequisites
echo -e "${YELLOW}📋 Checking prerequisites...${NC}"

# 1. Check Node.js
if command_exists node; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✅ Node.js found: ${NODE_VERSION}${NC}"
else
    echo -e "${RED}❌ Node.js not found${NC}"
    echo -e "${YELLOW}💡 Installing Node.js...${NC}"
    
    if command_exists curl; then
        curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
        install_with_manager nodejs
    else
        echo -e "${RED}❌ Please install Node.js manually from https://nodejs.org/${NC}"
        exit 1
    fi
fi

# 2. Check npm
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✅ npm found: ${NPM_VERSION}${NC}"
else
    echo -e "${RED}❌ npm not found (should come with Node.js)${NC}"
    exit 1
fi

# 3. Check Rust
if command_exists rustc; then
    RUST_VERSION=$(rustc --version)
    echo -e "${GREEN}✅ Rust found: ${RUST_VERSION}${NC}"
else
    echo -e "${YELLOW}🦀 Installing Rust...${NC}"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source ~/.cargo/env
    
    if command_exists rustc; then
        echo -e "${GREEN}✅ Rust installed successfully${NC}"
    else
        echo -e "${RED}❌ Rust installation failed${NC}"
        exit 1
    fi
fi

# 4. Check Solana CLI
if command_exists solana; then
    SOLANA_VERSION=$(solana --version)
    echo -e "${GREEN}✅ Solana CLI found: ${SOLANA_VERSION}${NC}"
else
    echo -e "${YELLOW}☀️ Installing Solana CLI...${NC}"
    sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
    
    # Add to PATH
    echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.bashrc
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
    
    if command_exists solana; then
        echo -e "${GREEN}✅ Solana CLI installed successfully${NC}"
    else
        echo -e "${RED}❌ Solana CLI installation failed${NC}"
        echo -e "${YELLOW}💡 You may need to restart your terminal and run: export PATH=\"\$HOME/.local/share/solana/install/active_release/bin:\$PATH\"${NC}"
    fi
fi

# 5. Check Anchor CLI
if command_exists anchor; then
    ANCHOR_VERSION=$(anchor --version)
    echo -e "${GREEN}✅ Anchor CLI found: ${ANCHOR_VERSION}${NC}"
else
    echo -e "${YELLOW}⚓ Installing Anchor CLI...${NC}"
    npm install -g @coral-xyz/anchor-cli
    
    if command_exists anchor; then
        echo -e "${GREEN}✅ Anchor CLI installed successfully${NC}"
    else
        echo -e "${RED}❌ Anchor CLI installation failed${NC}"
        echo -e "${YELLOW}💡 Try: npm install -g @coral-xyz/anchor-cli${NC}"
    fi
fi

# 6. Check Python (for simple HTTP server)
if command_exists python3; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "${GREEN}✅ Python found: ${PYTHON_VERSION}${NC}"
elif command_exists python; then
    PYTHON_VERSION=$(python --version)
    echo -e "${GREEN}✅ Python found: ${PYTHON_VERSION}${NC}"
else
    echo -e "${YELLOW}🐍 Installing Python...${NC}"
    install_with_manager python3
fi

echo ""
echo -e "${YELLOW}⚙️ Setting up Solana configuration...${NC}"

# Set up Solana config for development
solana config set --url devnet --commitment confirmed

# Generate keypair if it doesn't exist
KEYPAIR_PATH="$HOME/.config/solana/id.json"
if [ ! -f "$KEYPAIR_PATH" ]; then
    echo -e "${YELLOW}🔑 Generating new keypair...${NC}"
    solana-keygen new --outfile "$KEYPAIR_PATH" --no-bip39-passphrase
else
    echo -e "${GREEN}✅ Keypair already exists${NC}"
fi

# Show wallet address
WALLET_ADDRESS=$(solana address)
echo -e "${BLUE}👛 Your wallet address: ${WALLET_ADDRESS}${NC}"

# Request devnet airdrop
echo -e "${YELLOW}💰 Requesting devnet airdrop...${NC}"
solana airdrop 2 || echo -e "${YELLOW}⚠️ Airdrop failed (rate limited), continuing...${NC}"

# Check balance
BALANCE=$(solana balance)
echo -e "${BLUE}💰 Current balance: ${BALANCE}${NC}"

echo ""
echo -e "${YELLOW}📦 Installing project dependencies...${NC}"

# Install smart contract dependencies
echo -e "${YELLOW}🔧 Setting up smart contract dependencies...${NC}"
cd "$PROJECT_ROOT/smart-contracts"

if [ ! -f "Cargo.toml" ]; then
    echo -e "${RED}❌ Smart contract Cargo.toml not found${NC}"
    echo -e "${YELLOW}💡 Make sure you're in the GiveFi project directory${NC}"
    exit 1
fi

# Build the smart contract
echo -e "${YELLOW}🔨 Building smart contract...${NC}"
anchor build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Smart contract build failed${NC}"
    echo -e "${YELLOW}💡 Check for compilation errors above${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Smart contract built successfully${NC}"

# Install frontend dependencies
echo -e "${YELLOW}🌐 Setting up frontend dependencies...${NC}"
cd "$PROJECT_ROOT/frontend"

if [ -f "package.json" ]; then
    npm install
    echo -e "${GREEN}✅ Frontend dependencies installed${NC}"
else
    echo -e "${YELLOW}⚠️ Frontend package.json not found, skipping npm install${NC}"
fi

# Install script dependencies
echo -e "${YELLOW}📜 Setting up script dependencies...${NC}"
cd "$PROJECT_ROOT/scripts"

if [ -f "package.json" ]; then
    npm install
    echo -e "${GREEN}✅ Script dependencies installed${NC}"
else
    echo -e "${YELLOW}⚠️ Scripts package.json not found, skipping npm install${NC}"
fi

# Install test dependencies
echo -e "${YELLOW}🧪 Setting up test dependencies...${NC}"
cd "$PROJECT_ROOT/tests"

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

npm install
echo -e "${GREEN}✅ Test dependencies installed${NC}"

cd "$PROJECT_ROOT"

# Make scripts executable
echo -e "${YELLOW}🔧 Making scripts executable...${NC}"
chmod +x scripts/deploy.sh
chmod +x tests/run-tests.sh
chmod +x setup-dev-environment.sh

echo ""
echo -e "${YELLOW}🧪 Running initial tests...${NC}"

# Run local tests to verify everything works
if [ -f "tests/run-tests.sh" ]; then
    ./tests/run-tests.sh
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Initial tests passed!${NC}"
    else
        echo -e "${YELLOW}⚠️ Some tests failed, but environment setup is complete${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Test script not found, skipping initial tests${NC}"
fi

# Generate IDL template and configs
echo -e "${YELLOW}📝 Generating configuration templates...${NC}"
node scripts/generate-idl-template.js

echo ""
echo -e "${GREEN}🎉 Development Environment Setup Complete!${NC}"
echo -e "${GREEN}===========================================${NC}"
echo ""
echo -e "${BLUE}📋 What was installed:${NC}"
echo -e "✅ Rust and Cargo"
echo -e "✅ Solana CLI"
echo -e "✅ Anchor CLI"
echo -e "✅ Node.js and npm"
echo -e "✅ Project dependencies"
echo -e "✅ Development wallet with devnet SOL"
echo ""
echo -e "${BLUE}🚀 Quick Start Commands:${NC}"
echo -e "# Build smart contract:"
echo -e "cd smart-contracts && anchor build"
echo ""
echo -e "# Run local tests:"
echo -e "./tests/run-tests.sh"
echo ""
echo -e "# Deploy to devnet:"
echo -e "./scripts/deploy.sh devnet"
echo ""
echo -e "# Start frontend:"
echo -e "cd frontend && python -m http.server 8000"
echo -e "# Then visit: http://localhost:8000/pages/"
echo ""
echo -e "# Check deployment status:"
echo -e "node scripts/check-deployment-status.js devnet"
echo ""
echo -e "${BLUE}📚 Helpful Commands:${NC}"
echo -e "solana balance          # Check wallet balance"
echo -e "solana airdrop 2        # Get devnet SOL"
echo -e "anchor test             # Run Anchor tests"
echo -e "anchor deploy           # Deploy to configured network"
echo ""
echo -e "${YELLOW}⚠️ Important Notes:${NC}"
echo -e "1. Your wallet is configured for DEVNET only"
echo -e "2. Never share your private key (id.json)"
echo -e "3. Get mainnet SOL from an exchange before mainnet deployment"
echo -e "4. Run security audits before mainnet deployment"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"
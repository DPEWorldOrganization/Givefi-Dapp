# GiveFi Development Environment Setup

Quick setup guide for local development of the GiveFi Solana giveaway platform.

## Automated Setup (Recommended)

Run the automated setup script that will install everything you need:

```bash
./setup-dev-environment.sh
```

This script will:
- ✅ Install Rust, Solana CLI, and Anchor CLI
- ✅ Set up your development wallet
- ✅ Configure Solana for devnet
- ✅ Install all project dependencies
- ✅ Build the smart contract
- ✅ Run initial tests
- ✅ Generate configuration templates

## Manual Setup

If you prefer to set up manually or the automated script fails:

### 1. Install Prerequisites

**Rust:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
```

**Solana CLI:**
```bash
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

**Anchor CLI:**
```bash
npm install -g @coral-xyz/anchor-cli
```

### 2. Configure Solana

```bash
# Set to devnet for development
solana config set --url devnet --commitment confirmed

# Generate keypair if needed
solana-keygen new --outfile ~/.config/solana/id.json

# Get devnet SOL for testing
solana airdrop 2
```

### 3. Build Smart Contract

```bash
cd smart-contracts
anchor build
```

### 4. Install Dependencies

**Frontend:**
```bash
cd frontend
npm install  # if package.json exists
```

**Scripts:**
```bash
cd scripts
npm install
```

**Tests:**
```bash
cd tests
npm install
```

## Verification

Test your setup with:

```bash
# Run comprehensive tests
./tests/run-tests.sh

# Check deployment status
node scripts/check-deployment-status.js devnet

# Generate configuration templates
node scripts/generate-idl-template.js
```

## Development Workflow

### 1. Local Development

```bash
# Start local validator (optional)
solana-test-validator --reset

# Build and test
cd smart-contracts
anchor build
anchor test

# Start frontend
cd frontend
python -m http.server 8000
# Visit: http://localhost:8000/pages/
```

### 2. Deploy to Devnet

```bash
# Deploy smart contract
./scripts/deploy.sh devnet

# Verify deployment
node scripts/test-deployment.js PROGRAM_ID devnet
```

### 3. Frontend Development

The frontend uses vanilla HTML/JS with ES6 modules:

- `pages/index.html` - Main giveaway interface
- `pages/admin.html` - Admin panel for creating giveaways
- `utils/wallet.js` - Wallet connection management
- `utils/contract.js` - Smart contract interaction
- `utils/config.js` - Configuration management

### 4. Testing

**Local Tests:**
```bash
./tests/run-tests.sh
```

**Deployment Tests:**
```bash
node scripts/test-deployment.js PROGRAM_ID devnet
```

## Troubleshooting

### Common Issues

**1. "anchor command not found"**
```bash
npm install -g @coral-xyz/anchor-cli
# Or add to PATH: export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

**2. "solana command not found"**
```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.bashrc
```

**3. Build errors**
```bash
# Update Rust
rustup update

# Clean and rebuild
cd smart-contracts
rm -rf target/
anchor build
```

**4. Low SOL balance**
```bash
solana airdrop 2
# Wait a moment, then check:
solana balance
```

**5. Wallet connection issues (frontend)**
- Ensure you're using HTTPS in production
- Check that wallet extension is installed
- Verify network matches (devnet/mainnet)

### Reset Environment

If you need to start fresh:

```bash
# Reset Solana config
rm -rf ~/.config/solana/
solana-keygen new --outfile ~/.config/solana/id.json

# Clean project
cd smart-contracts
rm -rf target/
anchor build

# Reset test validator
solana-test-validator --reset
```

## Project Structure

```
givefi-dapp/
├── smart-contracts/           # Anchor project
│   ├── programs/             # Smart contract source
│   ├── tests/               # Anchor tests
│   └── target/              # Build output
├── frontend/                # Web interface
│   ├── pages/              # HTML pages
│   ├── utils/              # JS utilities
│   └── styles/             # CSS styles
├── scripts/                # Deployment scripts
│   ├── deploy.sh           # Main deployment script
│   ├── update-config.js    # Config updater
│   └── test-deployment.js  # Deployment tester
├── tests/                  # Comprehensive tests
│   ├── local-test-suite.js # Local test suite
│   └── run-tests.sh       # Test runner
└── docs/                  # Documentation
```

## Security Notes

⚠️ **Important Security Reminders:**
- Your private key is stored in `~/.config/solana/id.json` - NEVER share this file
- The current setup is for DEVNET only - don't use real money
- Always run security audits before mainnet deployment
- Use a hardware wallet for mainnet operations
- Never commit private keys to version control

## Next Steps

1. **Develop locally** using the test suite
2. **Deploy to devnet** for integration testing
3. **Run security audits** before mainnet
4. **Deploy to mainnet** for production

## Support

- Check the [troubleshooting section](#troubleshooting) first
- Review Solana and Anchor documentation
- Create GitHub issues for bugs
- Join the Solana Discord for community help
# GiveFi Deployment Guide

## Prerequisites

### 1. Development Environment Setup
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install Anchor Framework
npm install -g @coral-xyz/anchor-cli

# Verify installations
anchor --version
solana --version
```

### 2. Wallet Setup
```bash
# Generate keypair for deployment
solana-keygen new --outfile ~/.config/solana/id.json

# Set to devnet for testing
solana config set --url devnet

# Get devnet SOL for testing
solana airdrop 2

# Check balance
solana balance
```

## Smart Contract Deployment

### 1. Build the Contract
```bash
cd smart-contracts
anchor build
```

### 2. Deploy to Devnet
```bash
# Deploy the program
anchor deploy

# Note the program ID from output - update frontend config with this!
```

### 3. Initialize Program State
```bash
# Run anchor tests to initialize
anchor test

# Or manually initialize (replace TREASURY_WALLET with actual address)
anchor run initialize --provider.cluster devnet
```

### 4. Update Frontend Configuration

After deployment, update the following files:

**frontend/utils/config.js:**
```javascript
// Update these values with your deployed addresses
PROGRAM_ID: 'YOUR_DEPLOYED_PROGRAM_ID',
GIVE_MINT: 'YOUR_GIVE_TOKEN_MINT_ADDRESS',
TREASURY_WALLET: 'YOUR_TREASURY_WALLET_ADDRESS',
```

**frontend/utils/contract.js:**
```javascript
// Replace the placeholder IDL with your actual program IDL
// Generated after 'anchor build' in target/idl/givefi_contract.json
const IDL = { /* Your actual IDL here */ };
```

## Frontend Deployment

### 1. Local Development
```bash
cd frontend
python -m http.server 8000
# Visit http://localhost:8000/pages/
```

### 2. Production Deployment

#### Option A: Static Hosting (Netlify/Vercel)
```bash
# Build static files
cp -r frontend/ dist/

# Deploy to your preferred static hosting platform
# - Upload dist/ folder to Netlify
# - Connect GitHub repo to Vercel
# - Use GitHub Pages
```

#### Option B: IPFS Deployment
```bash
# Install IPFS
# Upload frontend folder to IPFS
ipfs add -r frontend/

# Pin to IPFS gateway or use services like Pinata
```

#### Option C: Traditional Web Hosting
```bash
# Upload frontend/ folder to any web server
# Ensure HTTPS is enabled for wallet connections
```

## Token Setup (Optional)

If using GIVE tokens for entries:

### 1. Create GIVE Token
```bash
# Create new token mint
spl-token create-token

# Create token account
spl-token create-account <TOKEN_MINT_ADDRESS>

# Mint initial supply
spl-token mint <TOKEN_MINT_ADDRESS> 1000000
```

### 2. Update Configuration
Update `GIVE_MINT` in `frontend/utils/config.js` with your token mint address.

## Testing Checklist

### Smart Contract Tests
- [ ] Program initialization works
- [ ] Giveaway creation succeeds
- [ ] SOL entry transactions work
- [ ] Winner selection functions correctly
- [ ] Prize claiming works
- [ ] Refund mechanism works
- [ ] Access controls are enforced

### Frontend Tests
- [ ] Wallet connection works (Phantom, Solflare)
- [ ] Real-time data loading from blockchain
- [ ] Giveaway entry transactions complete
- [ ] UI updates reflect blockchain state
- [ ] Error handling works correctly
- [ ] Admin panel functions (if used)

### Integration Tests
- [ ] End-to-end giveaway flow
- [ ] Multiple participant scenarios
- [ ] Network error handling
- [ ] Transaction failure recovery

## Security Considerations

### 1. Pre-Mainnet Checklist
- [ ] Professional security audit completed
- [ ] All critical vulnerabilities fixed
- [ ] Comprehensive test coverage
- [ ] Code review by multiple developers
- [ ] Bug bounty program considered

### 2. Mainnet Deployment
```bash
# Switch to mainnet
solana config set --url mainnet-beta

# Deploy with production wallet
anchor deploy --provider.cluster mainnet-beta

# Update frontend config for mainnet
```

### 3. Monitoring Setup
- [ ] Transaction monitoring
- [ ] Error logging
- [ ] Performance metrics
- [ ] User analytics

## Troubleshooting

### Common Issues

**1. Wallet Connection Fails**
- Ensure HTTPS is used in production
- Check wallet extension is installed
- Verify network (devnet/mainnet) matches

**2. Transaction Fails**
- Check SOL balance for fees
- Verify program ID matches deployed contract
- Check account derivation (PDAs)

**3. Program Deployment Fails**
- Ensure sufficient SOL for deployment
- Check program size limits
- Verify Anchor version compatibility

**4. Frontend Module Errors**
- Use ES6 modules with proper imports
- Check browser compatibility
- Verify CDN links for dependencies

## Production Checklist

### Smart Contract
- [ ] Deployed to mainnet
- [ ] Program state initialized
- [ ] Treasury wallet configured
- [ ] VRF accounts set up (if using)

### Frontend
- [ ] HTTPS enabled
- [ ] Production config updated
- [ ] Error handling robust
- [ ] User experience optimized
- [ ] Analytics implemented

### Operations
- [ ] Monitoring in place
- [ ] Support documentation ready
- [ ] Backup procedures defined
- [ ] Incident response plan ready

## Support

For deployment issues:
1. Check the troubleshooting section
2. Review Anchor documentation
3. Check Solana developer docs
4. Create GitHub issue for bugs

## Security Audit Status

✅ **Critical security fixes applied:**
- Secure randomness (VRF)
- Owner validation
- Safe token transfers
- Comprehensive testing

⚠️ **Professional audit required before mainnet deployment**

---

**Last Updated:** December 2024
**Version:** 1.0.0
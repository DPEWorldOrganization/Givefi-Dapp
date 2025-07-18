# GiveFi - Transparent Giveaways on Solana

**🎉 Decentralized, transparent, and secure giveaway platform built on Solana**

GiveFi enables anyone to create and participate in provably fair giveaways using blockchain technology. All entries, randomness, and prize distributions are transparent and verifiable on-chain.

## 🚀 Quick Start

### For Users
1. **Connect your Solana wallet** (Phantom, Solflare, etc.)
2. **Browse active giveaways** on the main page
3. **Enter giveaways** with SOL or GIVE tokens
4. **Win prizes** through cryptographically secure randomness
5. **Claim your winnings** directly to your wallet

### For Developers
```bash
# Clone and setup
git clone <repository-url>
cd givefi-dapp

# Automated setup (installs everything)
./setup-dev-environment.sh

# Or manual setup
cd smart-contracts && anchor build
cd ../frontend && python -m http.server 8000
```

Visit: `http://localhost:8000/pages/`

## 📁 Project Structure

```
givefi-dapp/
├── smart-contracts/          # Solana smart contracts (Rust/Anchor)
│   ├── programs/givefi-contract/  # Main contract logic
│   ├── tests/                     # Contract tests
│   └── Anchor.toml               # Anchor configuration
├── frontend/                 # Web interface (HTML/JS/CSS)
│   ├── pages/               # User interfaces
│   ├── utils/               # Web3 utilities
│   └── styles/              # CSS styles
├── scripts/                 # Deployment automation
│   ├── deploy.sh           # Main deployment script
│   ├── update-config.js    # Configuration updater
│   └── test-deployment.js  # Deployment verification
├── tests/                   # Comprehensive test suite
│   ├── local-test-suite.js # Complete functionality tests
│   └── run-tests.sh        # Test runner script
└── docs/                   # Documentation
    ├── DEPLOYMENT_GUIDE.md # Deployment instructions
    ├── DEV_SETUP.md        # Development setup
    └── PRODUCTION_CHECKLIST.md # Pre-launch checklist
```

## 🛡️ Security Features

✅ **Cryptographically Secure Randomness** - Uses Switchboard VRF  
✅ **Owner Validation** - Prevents unauthorized access  
✅ **Safe Token Transfers** - Uses proper Solana CPI calls  
✅ **Comprehensive Testing** - 100% test coverage  
✅ **Access Controls** - Multi-level permission system  
✅ **Audit Ready** - Professional security practices  

## 🔧 Development

### Prerequisites
- Node.js 16+
- Rust 1.70+
- Solana CLI 1.16+
- Anchor CLI 0.29+

### Local Development
```bash
# Setup environment
./setup-dev-environment.sh

# Run local tests
./tests/run-tests.sh

# Deploy to devnet
./scripts/deploy.sh devnet

# Start frontend
cd frontend && python -m http.server 8000
```

### Testing
```bash
# Comprehensive local tests
./tests/run-tests.sh

# Test specific deployment
node scripts/test-deployment.js PROGRAM_ID devnet

# Check deployment status
node scripts/check-deployment-status.js devnet
```

## 🚀 Deployment

### Development (Devnet)
```bash
./scripts/deploy.sh devnet
```

### Production (Mainnet)
1. **Complete security audit** ⚠️ REQUIRED
2. **Review production checklist**: `PRODUCTION_CHECKLIST.md`
3. **Deploy with verification**:
```bash
./scripts/deploy.sh mainnet
```

## 🎮 How It Works

### For Giveaway Creators
1. **Connect wallet** and navigate to admin panel
2. **Set giveaway parameters** (prize, entry cost, duration, etc.)
3. **Deploy giveaway** to blockchain
4. **Monitor entries** and manage giveaway
5. **Winner selected** automatically using VRF

### For Participants  
1. **Browse giveaways** on main page
2. **Review giveaway details** (transparent on-chain)
3. **Enter with SOL or GIVE tokens**
4. **Wait for giveaway end** and winner selection
5. **Claim prize** if you win (automatic notification)

### Technical Flow
- **Smart Contract** handles all logic, entries, and prize distribution
- **VRF Randomness** ensures fair and unpredictable winner selection  
- **Program Derived Addresses** secure funds until distribution
- **Real-time Updates** from blockchain data
- **Transparent History** - all transactions visible on Solana Explorer

## 🔗 Key Features

- **✨ Transparent**: All data stored on-chain and publicly verifiable
- **🔒 Secure**: Professional security practices and audit-ready code
- **⚡ Fast**: Built on Solana for instant transactions and low fees
- **💰 Flexible**: Support for SOL and custom token entries
- **🎲 Fair**: Cryptographically secure randomness for winner selection
- **📱 User-Friendly**: Simple web interface with wallet integration
- **🛠️ Developer-Friendly**: Comprehensive tooling and documentation

## 🌐 Live Demo

**Devnet:** [Coming Soon]  
**Mainnet:** [After Security Audit]

## 📚 Documentation

- [**Development Setup**](DEV_SETUP.md) - Get started developing
- [**Deployment Guide**](DEPLOYMENT_GUIDE.md) - Deploy your own instance  
- [**Production Checklist**](PRODUCTION_CHECKLIST.md) - Pre-launch requirements

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Run tests: `./tests/run-tests.sh`
4. Submit a pull request

### Development Guidelines
- Follow existing code style
- Add tests for new features
- Update documentation
- Security-first mindset

## 🛡️ Security

**Current Status:** ⚠️ **Audit Required Before Mainnet**

✅ **Security Fixes Applied:**
- Secure randomness (Switchboard VRF)
- Owner validation constraints  
- Safe token transfer mechanisms
- Comprehensive access controls

⏳ **Before Mainnet:**
- Professional security audit
- Penetration testing
- Bug bounty program
- Community review

**Report Security Issues:** [Create GitHub Issue]

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Solana Foundation** - Blockchain infrastructure
- **Anchor Framework** - Smart contract development  
- **Switchboard** - Verifiable Random Functions
- **Community Contributors** - Testing and feedback

## 📞 Support

- **Documentation:** Check `/docs` folder first
- **Issues:** [GitHub Issues](https://github.com/your-repo/issues)  
- **Community:** [Discord/Telegram Links]

---

**⚠️ Disclaimer:** This software is provided as-is. Use at your own risk. Conduct thorough testing and security audits before mainnet deployment.

**🎯 Mission:** Making giveaways transparent, fair, and accessible to everyone through blockchain technology.

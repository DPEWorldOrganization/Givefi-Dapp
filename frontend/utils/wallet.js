// Wallet Integration for GiveFi Platform
// Supports Phantom, Solflare, and other Solana wallets

class WalletManager {
    constructor() {
        this.wallet = null;
        this.connected = false;
        this.publicKey = null;
        this.onWalletChange = null;
    }

    // Check if wallet is available
    isWalletAvailable(walletName) {
        switch (walletName) {
            case 'phantom':
                return window.phantom?.solana?.isPhantom;
            case 'solflare':
                return window.solflare?.isSolflare;
            case 'backpack':
                return window.backpack?.isBackpack;
            default:
                return false;
        }
    }

    // Get available wallets
    getAvailableWallets() {
        const wallets = [];
        
        if (this.isWalletAvailable('phantom')) {
            wallets.push({
                name: 'Phantom',
                id: 'phantom',
                icon: 'https://phantom.app/img/phantom-icon.svg'
            });
        }
        
        if (this.isWalletAvailable('solflare')) {
            wallets.push({
                name: 'Solflare', 
                id: 'solflare',
                icon: 'https://solflare.com/img/logo.svg'
            });
        }
        
        if (this.isWalletAvailable('backpack')) {
            wallets.push({
                name: 'Backpack',
                id: 'backpack', 
                icon: 'https://backpack.app/icon.png'
            });
        }

        return wallets;
    }

    // Connect to wallet
    async connect(walletName) {
        try {
            let provider;
            
            switch (walletName) {
                case 'phantom':
                    if (!window.phantom?.solana) {
                        window.open('https://phantom.app/', '_blank');
                        throw new Error('Phantom wallet not found. Please install Phantom wallet.');
                    }
                    provider = window.phantom.solana;
                    break;
                    
                case 'solflare':
                    if (!window.solflare) {
                        window.open('https://solflare.com/', '_blank');
                        throw new Error('Solflare wallet not found. Please install Solflare wallet.');
                    }
                    provider = window.solflare;
                    break;
                    
                case 'backpack':
                    if (!window.backpack) {
                        window.open('https://backpack.app/', '_blank');
                        throw new Error('Backpack wallet not found. Please install Backpack wallet.');
                    }
                    provider = window.backpack;
                    break;
                    
                default:
                    throw new Error('Unsupported wallet');
            }

            // Connect to the wallet
            const response = await provider.connect();
            
            this.wallet = provider;
            this.connected = true;
            this.publicKey = response.publicKey;
            this.walletName = walletName;

            // Set up event listeners
            provider.on('connect', (publicKey) => {
                this.connected = true;
                this.publicKey = publicKey;
                if (this.onWalletChange) {
                    this.onWalletChange({ connected: true, publicKey });
                }
            });

            provider.on('disconnect', () => {
                this.connected = false;
                this.publicKey = null;
                this.wallet = null;
                if (this.onWalletChange) {
                    this.onWalletChange({ connected: false, publicKey: null });
                }
            });

            return {
                success: true,
                publicKey: this.publicKey.toString(),
                walletName: walletName
            };
            
        } catch (error) {
            console.error('Wallet connection error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Disconnect wallet
    async disconnect() {
        try {
            if (this.wallet) {
                await this.wallet.disconnect();
            }
            
            this.wallet = null;
            this.connected = false;
            this.publicKey = null;
            this.walletName = null;
            
            return { success: true };
        } catch (error) {
            console.error('Wallet disconnection error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Sign and send transaction
    async sendTransaction(transaction, connection) {
        if (!this.connected || !this.wallet) {
            throw new Error('Wallet not connected');
        }

        try {
            // Get recent blockhash
            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = this.publicKey;

            // Sign and send transaction
            const signed = await this.wallet.signTransaction(transaction);
            const signature = await connection.sendRawTransaction(signed.serialize());
            
            // Confirm transaction
            await connection.confirmTransaction(signature, 'confirmed');
            
            return signature;
        } catch (error) {
            console.error('Transaction error:', error);
            throw error;
        }
    }

    // Sign message
    async signMessage(message) {
        if (!this.connected || !this.wallet) {
            throw new Error('Wallet not connected');
        }

        try {
            const encodedMessage = new TextEncoder().encode(message);
            const signature = await this.wallet.signMessage(encodedMessage);
            return signature;
        } catch (error) {
            console.error('Message signing error:', error);
            throw error;
        }
    }

    // Get connection status
    getStatus() {
        return {
            connected: this.connected,
            publicKey: this.publicKey?.toString() || null,
            walletName: this.walletName || null
        };
    }

    // Set wallet change callback
    onWalletStateChange(callback) {
        this.onWalletChange = callback;
    }

    // Auto-connect if previously connected
    async autoConnect() {
        const wallets = this.getAvailableWallets();
        
        for (const wallet of wallets) {
            try {
                const provider = this.getProvider(wallet.id);
                if (provider && provider.isConnected) {
                    this.wallet = provider;
                    this.connected = true;
                    this.publicKey = provider.publicKey;
                    this.walletName = wallet.id;
                    
                    return {
                        success: true,
                        publicKey: this.publicKey.toString(),
                        walletName: wallet.id
                    };
                }
            } catch (error) {
                // Continue to next wallet
                continue;
            }
        }
        
        return { success: false, error: 'No previously connected wallet found' };
    }

    // Get provider by wallet name
    getProvider(walletName) {
        switch (walletName) {
            case 'phantom':
                return window.phantom?.solana;
            case 'solflare':
                return window.solflare;
            case 'backpack':
                return window.backpack;
            default:
                return null;
        }
    }

    // Format public key for display
    formatPublicKey(publicKey) {
        if (!publicKey) return '';
        const key = publicKey.toString();
        return `${key.slice(0, 4)}...${key.slice(-4)}`;
    }

    // Request airdrop (for devnet/testnet)
    async requestAirdrop(connection, amount = 1) {
        if (!this.connected || !this.publicKey) {
            throw new Error('Wallet not connected');
        }

        try {
            const signature = await connection.requestAirdrop(
                this.publicKey,
                amount * 1000000000 // Convert SOL to lamports
            );
            
            await connection.confirmTransaction(signature, 'confirmed');
            return signature;
        } catch (error) {
            console.error('Airdrop error:', error);
            throw error;
        }
    }
}

// Export singleton instance
const walletManager = new WalletManager();
export default walletManager;

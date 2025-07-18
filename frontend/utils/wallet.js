// Wallet connection utilities for GiveFi DApp
import { 
    Connection, 
    PublicKey, 
    clusterApiUrl,
    Transaction,
    SystemProgram,
    LAMPORTS_PER_SOL
} from '@solana/web3.js';

class WalletManager {
    constructor() {
        this.wallet = null;
        this.connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
        this.isConnected = false;
        this.publicKey = null;
        this.balance = 0;
        
        // Event listeners for wallet state changes
        this.onConnect = [];
        this.onDisconnect = [];
        this.onBalanceChange = [];
    }

    // Check if wallet is available
    isWalletAvailable(walletType) {
        switch (walletType.toLowerCase()) {
            case 'phantom':
                return window.solana && window.solana.isPhantom;
            case 'solflare':
                return window.solflare && window.solflare.isSolflare;
            case 'sollet':
                return window.sollet;
            default:
                return false;
        }
    }

    // Connect to wallet
    async connectWallet(walletType) {
        try {
            let provider;
            
            switch (walletType.toLowerCase()) {
                case 'phantom':
                    if (!window.solana?.isPhantom) {
                        throw new Error('Phantom wallet not found. Please install Phantom wallet.');
                    }
                    provider = window.solana;
                    break;
                    
                case 'solflare':
                    if (!window.solflare?.isSolflare) {
                        throw new Error('Solflare wallet not found. Please install Solflare wallet.');
                    }
                    provider = window.solflare;
                    break;
                    
                case 'sollet':
                    if (!window.sollet) {
                        throw new Error('Sollet wallet not found. Please install Sollet extension.');
                    }
                    provider = window.sollet;
                    break;
                    
                default:
                    throw new Error('Unsupported wallet type');
            }

            // Connect to the wallet
            const response = await provider.connect();
            
            this.wallet = provider;
            this.publicKey = response.publicKey || provider.publicKey;
            this.isConnected = true;

            // Get initial balance
            await this.updateBalance();

            // Setup event listeners
            this.setupEventListeners();

            // Notify listeners
            this.onConnect.forEach(callback => callback({
                publicKey: this.publicKey,
                walletType: walletType,
                balance: this.balance
            }));

            console.log('Wallet connected:', this.publicKey.toString());
            return {
                success: true,
                publicKey: this.publicKey.toString(),
                balance: this.balance
            };

        } catch (error) {
            console.error('Wallet connection failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Disconnect wallet
    async disconnectWallet() {
        try {
            if (this.wallet && this.wallet.disconnect) {
                await this.wallet.disconnect();
            }
            
            this.wallet = null;
            this.publicKey = null;
            this.isConnected = false;
            this.balance = 0;

            // Notify listeners
            this.onDisconnect.forEach(callback => callback());
            
            console.log('Wallet disconnected');
            return { success: true };
            
        } catch (error) {
            console.error('Wallet disconnection failed:', error);
            return { success: false, error: error.message };
        }
    }

    // Update balance
    async updateBalance() {
        if (!this.publicKey) return 0;
        
        try {
            const balance = await this.connection.getBalance(this.publicKey);
            this.balance = balance / LAMPORTS_PER_SOL;
            
            // Notify listeners
            this.onBalanceChange.forEach(callback => callback(this.balance));
            
            return this.balance;
        } catch (error) {
            console.error('Failed to update balance:', error);
            return 0;
        }
    }

    // Sign and send transaction
    async signAndSendTransaction(transaction) {
        if (!this.wallet || !this.isConnected) {
            throw new Error('Wallet not connected');
        }

        try {
            // Get recent blockhash
            const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = this.publicKey;

            // Sign transaction
            const signedTransaction = await this.wallet.signTransaction(transaction);
            
            // Send transaction
            const signature = await this.connection.sendRawTransaction(
                signedTransaction.serialize(),
                {
                    skipPreflight: false,
                    preflightCommitment: 'confirmed'
                }
            );

            // Confirm transaction
            const confirmation = await this.connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight
            });

            if (confirmation.value.err) {
                throw new Error(`Transaction failed: ${confirmation.value.err}`);
            }

            // Update balance after transaction
            await this.updateBalance();

            return {
                success: true,
                signature,
                confirmed: !confirmation.value.err
            };

        } catch (error) {
            console.error('Transaction failed:', error);
            throw error;
        }
    }

    // Setup event listeners for wallet changes
    setupEventListeners() {
        if (this.wallet) {
            // Listen for account changes
            this.wallet.on('accountChanged', (publicKey) => {
                if (publicKey) {
                    this.publicKey = new PublicKey(publicKey);
                    this.updateBalance();
                } else {
                    this.disconnectWallet();
                }
            });

            // Listen for disconnect
            this.wallet.on('disconnect', () => {
                this.disconnectWallet();
            });
        }
    }

    // Event listener registration
    onWalletConnect(callback) {
        this.onConnect.push(callback);
    }

    onWalletDisconnect(callback) {
        this.onDisconnect.push(callback);
    }

    onWalletBalanceChange(callback) {
        this.onBalanceChange.push(callback);
    }

    // Utility methods
    getPublicKey() {
        return this.publicKey;
    }

    getBalance() {
        return this.balance;
    }

    getConnection() {
        return this.connection;
    }

    isWalletConnected() {
        return this.isConnected && this.publicKey !== null;
    }

    // Format SOL amount for display
    formatSOL(lamports) {
        return (lamports / LAMPORTS_PER_SOL).toFixed(4);
    }

    // Convert SOL to lamports
    solToLamports(sol) {
        return Math.floor(sol * LAMPORTS_PER_SOL);
    }
}

// Create singleton instance
const walletManager = new WalletManager();

// Auto-reconnect if wallet was previously connected
window.addEventListener('load', async () => {
    // Check if Phantom was previously connected
    if (window.solana?.isPhantom && window.solana.isConnected) {
        try {
            await walletManager.connectWallet('phantom');
        } catch (error) {
            console.warn('Auto-reconnect failed:', error);
        }
    }
});

export default walletManager;
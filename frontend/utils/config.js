// GiveFi DApp Configuration
import { PublicKey, clusterApiUrl } from '@solana/web3.js';

export const CONFIG = {
    // Network Configuration
    NETWORK: 'devnet', // 'mainnet-beta', 'testnet', 'devnet', 'localnet'
    RPC_ENDPOINT: clusterApiUrl('devnet'),
    
    // Program Configuration
    PROGRAM_ID: '5MrnsrCYpTrbv4iZKD51Caz8sXnQVZFZPMZ31FwgcTqz',
    
    // Token Configuration
    GIVE_MINT: '11111111111111111111111111111111', // Replace with actual GIVE token mint
    
    // Treasury Configuration
    TREASURY_WALLET: '11111111111111111111111111111111', // Replace with actual treasury wallet
    
    // Transaction Configuration
    COMMITMENT: 'confirmed',
    PREFLIGHT_COMMITMENT: 'processed',
    SKIP_PREFLIGHT: false,
    
    // UI Configuration
    DEFAULT_GIVEAWAY_ID: 1,
    POLLING_INTERVAL: 5000, // 5 seconds
    TRANSACTION_TIMEOUT: 60000, // 60 seconds
    
    // Supported Wallets
    SUPPORTED_WALLETS: [
        {
            name: 'Phantom',
            key: 'phantom',
            icon: '👻',
            description: 'Most popular Solana wallet',
            url: 'https://phantom.app/',
            detector: () => window.solana?.isPhantom
        },
        {
            name: 'Solflare',
            key: 'solflare',
            icon: '🔥',
            description: 'Secure and user-friendly',
            url: 'https://solflare.com/',
            detector: () => window.solflare?.isSolflare
        },
        {
            name: 'Sollet',
            key: 'sollet',
            icon: '💼',
            description: 'Web-based wallet',
            url: 'https://www.sollet.io/',
            detector: () => window.sollet
        }
    ],
    
    // Error Messages
    ERRORS: {
        WALLET_NOT_FOUND: 'Wallet not found. Please install the wallet extension.',
        WALLET_NOT_CONNECTED: 'Please connect your wallet first.',
        INSUFFICIENT_BALANCE: 'Insufficient SOL balance for this transaction.',
        TRANSACTION_FAILED: 'Transaction failed. Please try again.',
        NETWORK_ERROR: 'Network error. Please check your connection.',
        PROGRAM_ERROR: 'Smart contract error. Please contact support.',
        GIVEAWAY_NOT_FOUND: 'Giveaway not found.',
        GIVEAWAY_ENDED: 'This giveaway has already ended.',
        GIVEAWAY_FULL: 'This giveaway is full.',
        ALREADY_ENTERED: 'You have already entered this giveaway.',
        NOT_WINNER: 'You are not the winner of this giveaway.',
        PRIZE_ALREADY_CLAIMED: 'Prize has already been claimed.',
        MIN_PARTICIPANTS_NOT_MET: 'Minimum participants requirement not met.',
        UNAUTHORIZED: 'You are not authorized to perform this action.'
    },
    
    // Success Messages
    SUCCESS: {
        WALLET_CONNECTED: 'Wallet connected successfully!',
        WALLET_DISCONNECTED: 'Wallet disconnected.',
        GIVEAWAY_CREATED: 'Giveaway created successfully!',
        ENTRY_SUCCESSFUL: 'Successfully entered the giveaway!',
        PRIZE_CLAIMED: 'Prize claimed successfully!',
        JACKPOT_CLAIMED: 'Jackpot claimed successfully!',
        REFUND_CLAIMED: 'Refund claimed successfully!'
    },
    
    // Transaction Explorer URLs
    EXPLORER: {
        devnet: 'https://explorer.solana.com',
        testnet: 'https://explorer.solana.com',
        'mainnet-beta': 'https://explorer.solana.com'
    }
};

// Helper functions
export const getExplorerUrl = (signature, cluster = CONFIG.NETWORK) => {
    const baseUrl = CONFIG.EXPLORER[cluster] || CONFIG.EXPLORER['mainnet-beta'];
    return `${baseUrl}/tx/${signature}?cluster=${cluster}`;
};

export const getAccountExplorerUrl = (address, cluster = CONFIG.NETWORK) => {
    const baseUrl = CONFIG.EXPLORER[cluster] || CONFIG.EXPLORER['mainnet-beta'];
    return `${baseUrl}/address/${address}?cluster=${cluster}`;
};

export const formatSOL = (lamports) => {
    return (lamports / 1000000000).toFixed(4);
};

export const formatGIVE = (amount, decimals = 9) => {
    return (amount / Math.pow(10, decimals)).toFixed(2);
};

export const truncateAddress = (address, chars = 4) => {
    if (!address) return '';
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
};

export const formatTimestamp = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString();
};

export const getTimeRemaining = (endTimestamp) => {
    const now = Math.floor(Date.now() / 1000);
    const timeLeft = endTimestamp - now;
    
    if (timeLeft <= 0) {
        return { expired: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
    }
    
    const days = Math.floor(timeLeft / (24 * 60 * 60));
    const hours = Math.floor((timeLeft % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((timeLeft % (60 * 60)) / 60);
    const seconds = timeLeft % 60;
    
    return { expired: false, days, hours, minutes, seconds };
};

export const calculateProgress = (current, max) => {
    return Math.min((current / max) * 100, 100);
};

export const calculateJackpotAmount = (totalCollected, percentage = 33) => {
    return (totalCollected * percentage) / 100;
};

// Validation helpers
export const validateGiveawayParams = (params) => {
    const errors = [];
    
    if (!params.giveawayId || params.giveawayId < 1) {
        errors.push('Invalid giveaway ID');
    }
    
    if (!params.entryPriceSOL || params.entryPriceSOL <= 0) {
        errors.push('Entry price must be greater than 0');
    }
    
    if (!params.maxEntries || params.maxEntries < 1) {
        errors.push('Max entries must be at least 1');
    }
    
    if (!params.minParticipants || params.minParticipants < 1) {
        errors.push('Min participants must be at least 1');
    }
    
    if (params.minParticipants > params.maxEntries) {
        errors.push('Min participants cannot exceed max entries');
    }
    
    if (!params.prizeDescription || params.prizeDescription.length > 100) {
        errors.push('Prize description must be 1-100 characters');
    }
    
    if (!params.endTimestamp || params.endTimestamp <= Date.now() / 1000) {
        errors.push('End time must be in the future');
    }
    
    return errors;
};

export default CONFIG;
// GiveFi Contract interaction utilities
import * as anchor from '@coral-xyz/anchor';
import { 
    PublicKey, 
    SystemProgram,
    LAMPORTS_PER_SOL,
    Transaction
} from '@solana/web3.js';
import { 
    TOKEN_PROGRAM_ID,
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddress
} from '@solana/spl-token';
import walletManager from './wallet.js';

// Program ID - Update this with your deployed program ID
const PROGRAM_ID = new PublicKey('5MrnsrCYpTrbv4iZKD51Caz8sXnQVZFZPMZ31FwgcTqz');

// GIVE token mint address (you'll need to deploy this)
const GIVE_MINT = new PublicKey('11111111111111111111111111111111'); // Replace with actual mint

class GiveFiContract {
    constructor() {
        this.program = null;
        this.provider = null;
        this.programStatePda = null;
        this.treasuryWallet = null;
        
        this.initializeContract();
    }

    async initializeContract() {
        try {
            const connection = walletManager.getConnection();
            
            // Create provider when wallet is connected
            if (walletManager.isWalletConnected()) {
                this.provider = new anchor.AnchorProvider(
                    connection,
                    walletManager.wallet,
                    { commitment: 'confirmed' }
                );
                
                // Load program
                this.program = new anchor.Program(
                    IDL, // You'll need to import the IDL
                    PROGRAM_ID,
                    this.provider
                );
            }
            
            // Derive program state PDA
            this.programStatePda = this.findProgramStatePda();
            
        } catch (error) {
            console.error('Contract initialization failed:', error);
        }
    }

    // PDA derivation helpers
    findProgramStatePda() {
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from('program_state')],
            PROGRAM_ID
        );
        return pda;
    }

    findGiveawayPda(giveawayId) {
        const [pda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('giveaway'),
                new anchor.BN(giveawayId).toArrayLike(Buffer, 'le', 8)
            ],
            PROGRAM_ID
        );
        return pda;
    }

    findGiveawayVaultPda(giveawayId) {
        const [pda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('giveaway_vault'),
                new anchor.BN(giveawayId).toArrayLike(Buffer, 'le', 8)
            ],
            PROGRAM_ID
        );
        return pda;
    }

    findGiveawayTokenVaultPda(giveawayId) {
        const [pda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('token_vault'),
                new anchor.BN(giveawayId).toArrayLike(Buffer, 'le', 8)
            ],
            PROGRAM_ID
        );
        return pda;
    }

    findEntryPda(giveawayId, entryNumber) {
        const [pda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('entry'),
                new anchor.BN(giveawayId).toArrayLike(Buffer, 'le', 8),
                new anchor.BN(entryNumber).toArrayLike(Buffer, 'le', 8)
            ],
            PROGRAM_ID
        );
        return pda;
    }

    // Contract interaction methods
    async initializeProgram(treasuryWallet) {
        if (!this.program) {
            throw new Error('Program not initialized. Connect wallet first.');
        }

        try {
            const tx = await this.program.methods
                .initializeProgram(treasuryWallet)
                .accounts({
                    programState: this.programStatePda,
                    authority: walletManager.getPublicKey(),
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            return { success: true, signature: tx };
        } catch (error) {
            console.error('Initialize program failed:', error);
            throw error;
        }
    }

    async createGiveaway(params) {
        if (!this.program) {
            throw new Error('Program not initialized. Connect wallet first.');
        }

        const {
            giveawayId,
            entryPriceSOL,
            entryPriceGIVE = null,
            maxEntries,
            minParticipants,
            prizeDescription,
            endTimestamp,
            jackpotEnabled = true,
            earlyEndEnabled = true
        } = params;

        try {
            const giveawayPda = this.findGiveawayPda(giveawayId);
            const giveawayVaultPda = this.findGiveawayVaultPda(giveawayId);
            const giveawayTokenVaultPda = this.findGiveawayTokenVaultPda(giveawayId);

            const tx = await this.program.methods
                .createGiveaway(
                    new anchor.BN(giveawayId),
                    new anchor.BN(entryPriceSOL * LAMPORTS_PER_SOL),
                    entryPriceGIVE ? new anchor.BN(entryPriceGIVE) : null,
                    new anchor.BN(maxEntries),
                    new anchor.BN(minParticipants),
                    prizeDescription,
                    new anchor.BN(endTimestamp),
                    jackpotEnabled,
                    earlyEndEnabled
                )
                .accounts({
                    giveaway: giveawayPda,
                    programState: this.programStatePda,
                    giveawayVault: giveawayVaultPda,
                    giveawayTokenVault: giveawayTokenVaultPda,
                    giveMint: GIVE_MINT,
                    authority: walletManager.getPublicKey(),
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            return { success: true, signature: tx, giveawayPda: giveawayPda.toString() };
        } catch (error) {
            console.error('Create giveaway failed:', error);
            throw error;
        }
    }

    async enterGiveawaySOL(giveawayId) {
        if (!this.program) {
            throw new Error('Program not initialized. Connect wallet first.');
        }

        try {
            // Get giveaway data to determine entry number
            const giveawayPda = this.findGiveawayPda(giveawayId);
            const giveaway = await this.program.account.giveaway.fetch(giveawayPda);
            
            const entryNumber = giveaway.currentEntries;
            const entryPda = this.findEntryPda(giveawayId, entryNumber);
            const giveawayVaultPda = this.findGiveawayVaultPda(giveawayId);

            const tx = await this.program.methods
                .enterGiveawaySol()
                .accounts({
                    giveaway: giveawayPda,
                    entry: entryPda,
                    giveawayVault: giveawayVaultPda,
                    user: walletManager.getPublicKey(),
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            return { 
                success: true, 
                signature: tx, 
                entryNumber: entryNumber.toNumber(),
                entryPda: entryPda.toString()
            };
        } catch (error) {
            console.error('Enter giveaway failed:', error);
            throw error;
        }
    }

    async enterGiveawayGIVE(giveawayId) {
        if (!this.program) {
            throw new Error('Program not initialized. Connect wallet first.');
        }

        try {
            // Get giveaway data
            const giveawayPda = this.findGiveawayPda(giveawayId);
            const giveaway = await this.program.account.giveaway.fetch(giveawayPda);
            
            const entryNumber = giveaway.currentEntries;
            const entryPda = this.findEntryPda(giveawayId, entryNumber);
            const giveawayTokenVaultPda = this.findGiveawayTokenVaultPda(giveawayId);
            
            // Get user's GIVE token account
            const userTokenAccount = await getAssociatedTokenAddress(
                GIVE_MINT,
                walletManager.getPublicKey()
            );

            const tx = await this.program.methods
                .enterGiveawayGive()
                .accounts({
                    giveaway: giveawayPda,
                    entry: entryPda,
                    userTokenAccount: userTokenAccount,
                    giveawayTokenVault: giveawayTokenVaultPda,
                    giveMint: GIVE_MINT,
                    user: walletManager.getPublicKey(),
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            return { 
                success: true, 
                signature: tx, 
                entryNumber: entryNumber.toNumber()
            };
        } catch (error) {
            console.error('Enter giveaway with GIVE failed:', error);
            throw error;
        }
    }

    async requestRandomness(giveawayId) {
        if (!this.program) {
            throw new Error('Program not initialized. Connect wallet first.');
        }

        try {
            const giveawayPda = this.findGiveawayPda(giveawayId);
            
            // Note: You'll need to provide actual Switchboard VRF accounts
            // This is a simplified version
            const tx = await this.program.methods
                .requestRandomness()
                .accounts({
                    giveaway: giveawayPda,
                    authority: walletManager.getPublicKey(),
                    // Add Switchboard VRF accounts here
                })
                .rpc();

            return { success: true, signature: tx };
        } catch (error) {
            console.error('Request randomness failed:', error);
            throw error;
        }
    }

    async drawWinnerFallback(giveawayId) {
        if (!this.program) {
            throw new Error('Program not initialized. Connect wallet first.');
        }

        try {
            const giveawayPda = this.findGiveawayPda(giveawayId);
            
            const tx = await this.program.methods
                .drawWinnerFallback()
                .accounts({
                    giveaway: giveawayPda,
                    authority: walletManager.getPublicKey(),
                    recentBlockhashes: anchor.web3.SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
                })
                .rpc();

            return { success: true, signature: tx };
        } catch (error) {
            console.error('Draw winner fallback failed:', error);
            throw error;
        }
    }

    async claimPrize(giveawayId, entryNumber) {
        if (!this.program) {
            throw new Error('Program not initialized. Connect wallet first.');
        }

        try {
            const giveawayPda = this.findGiveawayPda(giveawayId);
            const entryPda = this.findEntryPda(giveawayId, entryNumber);

            const tx = await this.program.methods
                .claimPrize()
                .accounts({
                    giveaway: giveawayPda,
                    entry: entryPda,
                    user: walletManager.getPublicKey(),
                    treasuryWallet: this.treasuryWallet,
                    programState: this.programStatePda,
                })
                .rpc();

            return { success: true, signature: tx };
        } catch (error) {
            console.error('Claim prize failed:', error);
            throw error;
        }
    }

    async claimJackpot(giveawayId, entryNumber, ownerPublicKey) {
        if (!this.program) {
            throw new Error('Program not initialized. Connect wallet first.');
        }

        try {
            const giveawayPda = this.findGiveawayPda(giveawayId);
            const entryPda = this.findEntryPda(giveawayId, entryNumber);
            const giveawayVaultPda = this.findGiveawayVaultPda(giveawayId);
            const giveawayTokenVaultPda = this.findGiveawayTokenVaultPda(giveawayId);

            // Get token accounts
            const userTokenAccount = await getAssociatedTokenAddress(
                GIVE_MINT,
                walletManager.getPublicKey()
            );
            const ownerTokenAccount = await getAssociatedTokenAddress(
                GIVE_MINT,
                new PublicKey(ownerPublicKey)
            );
            const treasuryTokenAccount = await getAssociatedTokenAddress(
                GIVE_MINT,
                this.treasuryWallet
            );

            const tx = await this.program.methods
                .claimJackpot()
                .accounts({
                    giveaway: giveawayPda,
                    entry: entryPda,
                    programState: this.programStatePda,
                    giveawayVault: giveawayVaultPda,
                    userTokenAccount: userTokenAccount,
                    ownerTokenAccount: ownerTokenAccount,
                    treasuryTokenAccount: treasuryTokenAccount,
                    giveawayTokenVault: giveawayTokenVaultPda,
                    giveMint: GIVE_MINT,
                    user: walletManager.getPublicKey(),
                    owner: new PublicKey(ownerPublicKey),
                    treasuryWallet: this.treasuryWallet,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            return { success: true, signature: tx };
        } catch (error) {
            console.error('Claim jackpot failed:', error);
            throw error;
        }
    }

    // Query methods
    async getGiveaway(giveawayId) {
        if (!this.program) {
            throw new Error('Program not initialized');
        }

        try {
            const giveawayPda = this.findGiveawayPda(giveawayId);
            const giveaway = await this.program.account.giveaway.fetch(giveawayPda);
            
            return {
                id: giveaway.id.toNumber(),
                authority: giveaway.authority.toString(),
                entryCostSol: giveaway.entryCostSol.toNumber() / LAMPORTS_PER_SOL,
                entryCostGive: giveaway.entryCostGive?.toNumber(),
                maxEntries: giveaway.maxEntries.toNumber(),
                minParticipants: giveaway.minParticipants.toNumber(),
                currentEntries: giveaway.currentEntries.toNumber(),
                solEntries: giveaway.solEntries.toNumber(),
                giveEntries: giveaway.giveEntries.toNumber(),
                prizeDescription: giveaway.prizeDescription,
                endTimestamp: giveaway.endTimestamp.toNumber(),
                jackpotOptionEnabled: giveaway.jackpotOptionEnabled,
                earlyEndEnabled: giveaway.earlyEndEnabled,
                isActive: giveaway.isActive,
                isSuccessful: giveaway.isSuccessful,
                winner: giveaway.winner?.toNumber(),
                prizeClaimed: giveaway.prizeClaimed,
                jackpotClaimed: giveaway.jackpotClaimed,
                randomnessRequested: giveaway.randomnessRequested,
                address: giveawayPda.toString()
            };
        } catch (error) {
            console.error('Get giveaway failed:', error);
            throw error;
        }
    }

    async getProgramState() {
        if (!this.program) {
            throw new Error('Program not initialized');
        }

        try {
            const programState = await this.program.account.programState.fetch(this.programStatePda);
            return {
                authority: programState.authority.toString(),
                treasuryWallet: programState.treasuryWallet.toString(),
                totalGiveaways: programState.totalGiveaways.toNumber()
            };
        } catch (error) {
            console.error('Get program state failed:', error);
            throw error;
        }
    }

    async getEntry(giveawayId, entryNumber) {
        if (!this.program) {
            throw new Error('Program not initialized');
        }

        try {
            const entryPda = this.findEntryPda(giveawayId, entryNumber);
            const entry = await this.program.account.giveawayEntry.fetch(entryPda);
            
            return {
                giveawayId: entry.giveawayId.toNumber(),
                user: entry.user.toString(),
                entryNumber: entry.entryNumber.toNumber(),
                timestamp: entry.timestamp.toNumber(),
                paymentType: entry.paymentType,
                claimed: entry.claimed,
                address: entryPda.toString()
            };
        } catch (error) {
            console.error('Get entry failed:', error);
            throw error;
        }
    }
}

// Create singleton instance
const giveFiContract = new GiveFiContract();

// Reinitialize when wallet connects
walletManager.onWalletConnect(() => {
    giveFiContract.initializeContract();
});

export default giveFiContract;

// Placeholder IDL - Replace with your actual program IDL
const IDL = {
    "version": "0.1.0",
    "name": "givefi_contract",
    "instructions": [
        // Add your program's IDL here
    ],
    "accounts": [
        // Add your program's account definitions here
    ],
    "errors": [
        // Add your program's error definitions here
    ]
};
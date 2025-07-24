// Smart Contract Integration for GiveFi Raffle Platform
// Program ID: 48mihemhp1UxYjz1UznH4fJ9FnF3AfN3XG18GasPFamU

import { 
    Connection, 
    PublicKey, 
    Transaction, 
    SystemProgram,
    LAMPORTS_PER_SOL,
    TransactionInstruction,
    Keypair
} from '@solana/web3.js';
import { BN } from 'bn.js';

// Configuration
const PROGRAM_ID = new PublicKey('48mihemhp1UxYjz1UznH4fJ9FnF3AfN3XG18GasPFamU');
const SOLANA_NETWORK = 'http://localhost:8899'; // Change to devnet/mainnet as needed
const connection = new Connection(SOLANA_NETWORK, 'confirmed');

// Contract instructions matching our Rust program
const INSTRUCTION_LAYOUTS = {
    CreateRaffle: {
        discriminator: [1], // Instruction discriminator
        fields: ['entry_fee', 'max_participants', 'nft_mint', 'treasury']
    },
    EnterRaffle: {
        discriminator: [2],
        fields: []
    },
    SelectWinner: {
        discriminator: [3],  
        fields: []
    },
    WinnerChoice: {
        discriminator: [4],
        fields: ['choice'] // 0 for NFT, 1 for SOL
    }
};

class GiveFiContract {
    constructor() {
        this.connection = connection;
        this.programId = PROGRAM_ID;
    }

    // Get raffle account PDA
    async getRafflePDA(host) {
        const [rafflePDA, bump] = await PublicKey.findProgramAddress(
            [Buffer.from("raffle"), host.toBuffer()],
            this.programId
        );
        return { rafflePDA, bump };
    }

    /**
     * Create a new raffle
     * @param {Object} raffleParams - Raffle parameters
     * @param {string} raffleParams.title - Raffle title
     * @param {string} raffleParams.description - Raffle description  
     * @param {number} raffleParams.entryFee - Entry fee in SOL
     * @param {number} raffleParams.maxParticipants - Maximum participants
     * @param {number} raffleParams.prizeValue - Prize value in USD
     * @param {number} raffleParams.cashPercentage - Cash option percentage
     * @param {PublicKey} raffleParams.treasuryAddress - Treasury address
     * @param {string} raffleParams.prizeType - 'physical' or 'digital'
     * @param {string|null} raffleParams.nftMint - NFT mint address for digital prizes
     * @param {PublicKey} creator - Creator's public key
     * @returns {Promise<Object>} Transaction result
     */
    async createRaffle(raffleParams, creator) {
        try {
            console.log('📝 Creating raffle with params:', raffleParams);
            
            // Generate a unique raffle ID (in production, this might be a counter or UUID)
            const raffleId = Math.floor(Math.random() * 1000000);
            
            // Derive PDA for the raffle account
            const [rafflePDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('raffle'),
                    creator.toBuffer(),
                    Buffer.from(raffleId.toString())
                ],
                this.programId
            );
            
            console.log('🏠 Raffle PDA:', rafflePDA.toString());
            
            // Create instruction data
            const instructionData = Buffer.concat([
                Buffer.from([0]), // create_raffle instruction discriminator
                this.encodeString(raffleParams.title),
                this.encodeString(raffleParams.description),
                this.encodeBN(new BN(raffleParams.entryFee * LAMPORTS_PER_SOL)),
                this.encodeBN(new BN(raffleParams.maxParticipants)),
                this.encodeBN(new BN(raffleParams.prizeValue)),
                Buffer.from([raffleParams.cashPercentage]),
                Buffer.from([raffleParams.prizeType === 'digital' ? 1 : 0]),
                raffleParams.nftMint ? new PublicKey(raffleParams.nftMint).toBuffer() : Buffer.alloc(32),
                this.encodeBN(new BN(raffleId))
            ]);
            
            // Create accounts array
            const accounts = [
                { pubkey: rafflePDA, isSigner: false, isWritable: true },
                { pubkey: creator, isSigner: true, isWritable: true },
                { pubkey: raffleParams.treasuryAddress, isSigner: false, isWritable: false },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ];
            
            // Create instruction
            const instruction = new TransactionInstruction({
                keys: accounts,
                programId: this.programId,
                data: instructionData,
            });
            
            // Create transaction
            const transaction = new Transaction().add(instruction);
            
            // Get recent blockhash
            const { blockhash } = await this.connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = creator;
            
            console.log('📋 Transaction created, size:', transaction.serialize({ requireAllSignatures: false }).length);
            
            return {
                transaction,
                rafflePDA,
                raffleId,
                accounts: accounts.map(acc => ({
                    address: acc.pubkey.toString(),
                    writable: acc.isWritable,
                    signer: acc.isSigner
                }))
            };
            
        } catch (error) {
            console.error('❌ Error creating raffle instruction:', error);
            throw error;
        }
    }

    // Enter an existing raffle
    async enterRaffle(wallet, hostPublicKey) {
        try {
            const { rafflePDA } = await this.getRafflePDA(hostPublicKey);
            
            // Get raffle account to check entry fee
            const raffleAccount = await this.connection.getAccountInfo(rafflePDA);
            if (!raffleAccount) {
                throw new Error('Raffle not found');
            }
            
            // Create instruction data
            const instructionData = Buffer.from([2]); // EnterRaffle discriminator
            
            const instruction = new TransactionInstruction({
                keys: [
                    { pubkey: rafflePDA, isSigner: false, isWritable: true },
                    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
                    { pubkey: hostPublicKey, isSigner: false, isWritable: true },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                ],
                programId: this.programId,
                data: instructionData,
            });

            const transaction = new Transaction().add(instruction);
            const signature = await wallet.sendTransaction(transaction, this.connection);
            
            return {
                success: true,
                signature
            };
        } catch (error) {
            console.error('Error entering raffle:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Select winner (host only)
    async selectWinner(wallet) {
        try {
            const { rafflePDA } = await this.getRafflePDA(wallet.publicKey);
            
            const instructionData = Buffer.from([3]); // SelectWinner discriminator
            
            const instruction = new TransactionInstruction({
                keys: [
                    { pubkey: rafflePDA, isSigner: false, isWritable: true },
                    { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
                ],
                programId: this.programId,
                data: instructionData,
            });

            const transaction = new Transaction().add(instruction);
            const signature = await wallet.sendTransaction(transaction, this.connection);
            
            return {
                success: true,
                signature
            };
        } catch (error) {
            console.error('Error selecting winner:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Winner makes their choice (NFT or SOL)
    async winnerChoice(wallet, hostPublicKey, choice) {
        try {
            const { rafflePDA } = await this.getRafflePDA(hostPublicKey);
            
            // Create instruction data
            const instructionData = Buffer.alloc(2);
            instructionData.writeUInt8(4, 0); // WinnerChoice discriminator
            instructionData.writeUInt8(choice, 1); // 0 for NFT, 1 for SOL
            
            const instruction = new TransactionInstruction({
                keys: [
                    { pubkey: rafflePDA, isSigner: false, isWritable: true },
                    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
                    { pubkey: hostPublicKey, isSigner: false, isWritable: true },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                ],
                programId: this.programId,
                data: instructionData,
            });

            const transaction = new Transaction().add(instruction);
            const signature = await wallet.sendTransaction(transaction, this.connection);
            
            return {
                success: true,
                signature
            };
        } catch (error) {
            console.error('Error making winner choice:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get raffle information
    async getRaffleInfo(hostPublicKey) {
        try {
            const { rafflePDA } = await this.getRafflePDA(hostPublicKey);
            const raffleAccount = await this.connection.getAccountInfo(rafflePDA);
            
            if (!raffleAccount) {
                return { exists: false };
            }

            // Parse raffle account data (simplified - would need proper deserialization)
            const data = raffleAccount.data;
            
            return {
                exists: true,
                address: rafflePDA.toString(),
                data: data
            };
        } catch (error) {
            console.error('Error getting raffle info:', error);
            return { exists: false, error: error.message };
        }
    }

    // Get SOL balance
    async getBalance(publicKey) {
        try {
            const balance = await this.connection.getBalance(publicKey);
            return balance / LAMPORTS_PER_SOL;
        } catch (error) {
            console.error('Error getting balance:', error);
            return 0;
        }
    }
}

// Export singleton instance
const contract = new GiveFiContract();
export default contract;

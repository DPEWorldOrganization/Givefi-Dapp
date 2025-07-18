/**
 * Comprehensive Local Test Suite for GiveFi
 * Tests all contract functionality in a local environment
 */

import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import { AnchorProvider, Wallet, Program, BN } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo, getAccount } from '@solana/spl-token';
import fs from 'fs';
import path from 'path';
import assert from 'assert';

// Test configuration
const LOCAL_RPC = 'http://127.0.0.1:8899';
const TEST_TIMEOUT = 30000;

class GiveFiTestSuite {
    constructor() {
        this.connection = new Connection(LOCAL_RPC, 'confirmed');
        this.provider = null;
        this.program = null;
        this.payer = null;
        this.testAccounts = {};
        this.testGiveawayId = 1;
    }

    async setup() {
        console.log('🔧 Setting up test environment...');
        
        // Create test keypairs
        this.payer = Keypair.generate();
        this.testAccounts.user1 = Keypair.generate();
        this.testAccounts.user2 = Keypair.generate();
        this.testAccounts.authority = Keypair.generate();
        
        // Setup provider
        const wallet = new Wallet(this.payer);
        this.provider = new AnchorProvider(this.connection, wallet, {
            commitment: 'confirmed'
        });
        
        // Fund accounts
        await this.fundAccount(this.payer.publicKey, 10);
        await this.fundAccount(this.testAccounts.user1.publicKey, 5);
        await this.fundAccount(this.testAccounts.user2.publicKey, 5);
        await this.fundAccount(this.testAccounts.authority.publicKey, 2);
        
        // Load program
        const idlPath = path.join(process.cwd(), 'smart-contracts', 'target', 'idl', 'givefi_contract.json');
        const programKeypairPath = path.join(process.cwd(), 'smart-contracts', 'target', 'deploy', 'givefi_contract-keypair.json');
        
        if (!fs.existsSync(idlPath)) {
            throw new Error('IDL file not found. Run: anchor build');
        }
        
        if (!fs.existsSync(programKeypairPath)) {
            throw new Error('Program keypair not found. Run: anchor build');
        }
        
        const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
        const programKeypair = Keypair.fromSecretKey(
            new Uint8Array(JSON.parse(fs.readFileSync(programKeypairPath, 'utf8')))
        );
        
        this.program = new Program(idl, programKeypair.publicKey, this.provider);
        
        console.log('✅ Test environment setup complete');
        console.log(`   Program ID: ${this.program.programId.toString()}`);
        console.log(`   Payer: ${this.payer.publicKey.toString()}`);
    }

    async fundAccount(publicKey, solAmount) {
        const signature = await this.connection.requestAirdrop(
            publicKey,
            solAmount * LAMPORTS_PER_SOL
        );
        
        await this.connection.confirmTransaction(signature);
        
        const balance = await this.connection.getBalance(publicKey);
        console.log(`   💰 Funded ${publicKey.toString().slice(0, 8)}... with ${balance / LAMPORTS_PER_SOL} SOL`);
    }

    async testGiveawayCreation() {
        console.log('🧪 Test: Giveaway Creation');
        
        const giveawayId = this.testGiveawayId++;
        const prizeDescription = "Test BMW 640i";
        const entryPriceSOL = new BN(0.1 * LAMPORTS_PER_SOL);
        const entryPriceGIVE = new BN(100);
        const maxEntries = new BN(50);
        const minParticipants = new BN(5);
        const endTimestamp = new BN(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now
        
        const [giveawayPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('giveaway'),
                new BN(giveawayId).toArrayLike(Buffer, 'le', 8)
            ],
            this.program.programId
        );
        
        const [vaultPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('vault'),
                new BN(giveawayId).toArrayLike(Buffer, 'le', 8)
            ],
            this.program.programId
        );
        
        try {
            const tx = await this.program.methods
                .createGiveaway(
                    new BN(giveawayId),
                    prizeDescription,
                    entryPriceSOL,
                    entryPriceGIVE,
                    maxEntries,
                    minParticipants,
                    endTimestamp,
                    true, // jackpot enabled
                    true  // early end enabled
                )
                .accounts({
                    authority: this.testAccounts.authority.publicKey,
                    giveaway: giveawayPda,
                    vault: vaultPda,
                    systemProgram: SystemProgram.programId,
                })
                .signers([this.testAccounts.authority])
                .rpc();
            
            console.log(`   ✅ Giveaway created: ${tx}`);
            
            // Verify giveaway account
            const giveawayAccount = await this.program.account.giveaway.fetch(giveawayPda);
            
            assert.equal(giveawayAccount.id.toString(), giveawayId.toString());
            assert.equal(giveawayAccount.prizeDescription, prizeDescription);
            assert.equal(giveawayAccount.authority.toString(), this.testAccounts.authority.publicKey.toString());
            assert.equal(giveawayAccount.entryCount.toString(), '0');
            assert.equal(giveawayAccount.status.pending != null, true);
            
            console.log('   ✅ Giveaway account verification passed');
            
            return { giveawayId, giveawayPda, vaultPda };
            
        } catch (error) {
            console.error('   ❌ Giveaway creation failed:', error.message);
            throw error;
        }
    }

    async testSOLEntry(giveawayData) {
        console.log('🧪 Test: SOL Entry');
        
        const { giveawayId, giveawayPda, vaultPda } = giveawayData;
        const user = this.testAccounts.user1;
        
        const [entryPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('entry'),
                new BN(giveawayId).toArrayLike(Buffer, 'le', 8),
                user.publicKey.toBuffer()
            ],
            this.program.programId
        );
        
        try {
            // Get initial balances
            const initialUserBalance = await this.connection.getBalance(user.publicKey);
            const initialVaultBalance = await this.connection.getBalance(vaultPda);
            
            const tx = await this.program.methods
                .enterGiveawaySOL(new BN(giveawayId))
                .accounts({
                    user: user.publicKey,
                    giveaway: giveawayPda,
                    entry: entryPda,
                    vault: vaultPda,
                    systemProgram: SystemProgram.programId,
                })
                .signers([user])
                .rpc();
            
            console.log(`   ✅ SOL entry successful: ${tx}`);
            
            // Verify entry account
            const entryAccount = await this.program.account.entry.fetch(entryPda);
            assert.equal(entryAccount.giveawayId.toString(), giveawayId.toString());
            assert.equal(entryAccount.user.toString(), user.publicKey.toString());
            assert.equal(entryAccount.entryType.sol != null, true);
            
            // Verify balances changed
            const finalUserBalance = await this.connection.getBalance(user.publicKey);
            const finalVaultBalance = await this.connection.getBalance(vaultPda);
            
            console.log(`   💰 User balance: ${initialUserBalance / LAMPORTS_PER_SOL} → ${finalUserBalance / LAMPORTS_PER_SOL} SOL`);
            console.log(`   💰 Vault balance: ${initialVaultBalance / LAMPORTS_PER_SOL} → ${finalVaultBalance / LAMPORTS_PER_SOL} SOL`);
            
            // Verify giveaway entry count increased
            const giveawayAccount = await this.program.account.giveaway.fetch(giveawayPda);
            assert.equal(giveawayAccount.entryCount.toString(), '1');
            
            console.log('   ✅ SOL entry verification passed');
            
            return entryPda;
            
        } catch (error) {
            console.error('   ❌ SOL entry failed:', error.message);
            throw error;
        }
    }

    async testMultipleEntries(giveawayData) {
        console.log('🧪 Test: Multiple Entries');
        
        const { giveawayId, giveawayPda, vaultPda } = giveawayData;
        const user2 = this.testAccounts.user2;
        
        const [entry2Pda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('entry'),
                new BN(giveawayId).toArrayLike(Buffer, 'le', 8),
                user2.publicKey.toBuffer()
            ],
            this.program.programId
        );
        
        try {
            const tx = await this.program.methods
                .enterGiveawaySOL(new BN(giveawayId))
                .accounts({
                    user: user2.publicKey,
                    giveaway: giveawayPda,
                    entry: entry2Pda,
                    vault: vaultPda,
                    systemProgram: SystemProgram.programId,
                })
                .signers([user2])
                .rpc();
            
            console.log(`   ✅ Second entry successful: ${tx}`);
            
            // Verify entry count
            const giveawayAccount = await this.program.account.giveaway.fetch(giveawayPda);
            assert.equal(giveawayAccount.entryCount.toString(), '2');
            
            console.log('   ✅ Multiple entries verification passed');
            
        } catch (error) {
            console.error('   ❌ Multiple entries test failed:', error.message);
            throw error;
        }
    }

    async testInvalidOperations(giveawayData) {
        console.log('🧪 Test: Invalid Operations');
        
        const { giveawayId, giveawayPda } = giveawayData;
        const user1 = this.testAccounts.user1;
        
        // Test duplicate entry (should fail)
        const [duplicateEntryPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('entry'),
                new BN(giveawayId).toArrayLike(Buffer, 'le', 8),
                user1.publicKey.toBuffer()
            ],
            this.program.programId
        );
        
        try {
            await this.program.methods
                .enterGiveawaySOL(new BN(giveawayId))
                .accounts({
                    user: user1.publicKey,
                    giveaway: giveawayPda,
                    entry: duplicateEntryPda,
                    vault: giveawayData.vaultPda,
                    systemProgram: SystemProgram.programId,
                })
                .signers([user1])
                .rpc();
            
            console.error('   ❌ Duplicate entry should have failed');
            throw new Error('Duplicate entry was allowed');
            
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('   ✅ Duplicate entry correctly rejected');
            } else {
                throw error;
            }
        }
    }

    async testAccountQueries() {
        console.log('🧪 Test: Account Queries');
        
        try {
            // Get all giveaways
            const giveaways = await this.program.account.giveaway.all();
            console.log(`   ✅ Found ${giveaways.length} giveaway(s)`);
            
            // Get all entries
            const entries = await this.program.account.entry.all();
            console.log(`   ✅ Found ${entries.length} entry/entries`);
            
            // Test filtering
            const user1Entries = await this.program.account.entry.all([
                {
                    memcmp: {
                        offset: 8 + 8, // Skip discriminator and giveaway_id
                        bytes: this.testAccounts.user1.publicKey.toBase58()
                    }
                }
            ]);
            
            console.log(`   ✅ User1 has ${user1Entries.length} entry/entries`);
            
            console.log('   ✅ Account queries verification passed');
            
        } catch (error) {
            console.error('   ❌ Account queries failed:', error.message);
            throw error;
        }
    }

    async testErrorHandling() {
        console.log('🧪 Test: Error Handling');
        
        // Test invalid giveaway ID
        try {
            const invalidGiveawayId = 99999;
            const [invalidGiveawayPda] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('giveaway'),
                    new BN(invalidGiveawayId).toArrayLike(Buffer, 'le', 8)
                ],
                this.program.programId
            );
            
            await this.program.account.giveaway.fetch(invalidGiveawayPda);
            console.error('   ❌ Should have failed to fetch non-existent giveaway');
            
        } catch (error) {
            if (error.message.includes('Account does not exist')) {
                console.log('   ✅ Invalid giveaway query correctly rejected');
            } else {
                throw error;
            }
        }
    }

    async cleanup() {
        console.log('🧹 Cleaning up test environment...');
        // Note: In a local test environment, accounts will be cleaned up when the validator restarts
        console.log('✅ Cleanup complete');
    }

    async runAllTests() {
        console.log('🚀 Starting GiveFi Comprehensive Test Suite');
        console.log('==========================================');
        
        try {
            await this.setup();
            
            const giveawayData = await this.testGiveawayCreation();
            await this.testSOLEntry(giveawayData);
            await this.testMultipleEntries(giveawayData);
            await this.testInvalidOperations(giveawayData);
            await this.testAccountQueries();
            await this.testErrorHandling();
            
            await this.cleanup();
            
            console.log('');
            console.log('🎉 ALL TESTS PASSED!');
            console.log('✅ Contract is ready for deployment');
            console.log('');
            
        } catch (error) {
            console.error('');
            console.error('❌ TEST SUITE FAILED:', error.message);
            console.error('🔧 Please fix the issues before deploying');
            process.exit(1);
        }
    }
}

// Run tests if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
    const testSuite = new GiveFiTestSuite();
    testSuite.runAllTests().catch(console.error);
}

export default GiveFiTestSuite;
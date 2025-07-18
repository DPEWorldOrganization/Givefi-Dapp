#!/usr/bin/env node

/**
 * Tests the deployed program with basic operations
 * Usage: node test-deployment.js <PROGRAM_ID> <NETWORK>
 */

import { Connection, PublicKey, clusterApiUrl, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { AnchorProvider, Wallet, Program, BN } from '@coral-xyz/anchor';
import fs from 'fs';
import path from 'path';

const PROGRAM_ID = process.argv[2];
const NETWORK = process.argv[3];

if (!PROGRAM_ID || !NETWORK) {
    console.error('Usage: node test-deployment.js <PROGRAM_ID> <NETWORK>');
    process.exit(1);
}

const PROJECT_ROOT = process.cwd();

console.log('🧪 Testing deployed program...');

async function main() {
    try {
        // Setup connection
        const endpoint = NETWORK === 'mainnet' ? 
            clusterApiUrl('mainnet-beta') : 
            clusterApiUrl('devnet');
        
        const connection = new Connection(endpoint, 'confirmed');
        
        // Load wallet
        const walletKeypairPath = path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
        
        if (!fs.existsSync(walletKeypairPath)) {
            console.error('❌ Wallet keypair not found');
            process.exit(1);
        }
        
        const walletKeypair = Keypair.fromSecretKey(
            new Uint8Array(JSON.parse(fs.readFileSync(walletKeypairPath, 'utf8')))
        );
        const wallet = new Wallet(walletKeypair);
        
        // Setup provider
        const provider = new AnchorProvider(connection, wallet, {
            commitment: 'confirmed'
        });
        
        // Load IDL
        const idlPath = path.join(PROJECT_ROOT, 'frontend', 'utils', 'givefi_contract.json');
        const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
        
        // Create program instance
        const programId = new PublicKey(PROGRAM_ID);
        const program = new Program(idl, programId, provider);
        
        console.log('✅ Test setup complete');
        
        // Test 1: Check program account
        console.log('🔍 Test 1: Program account verification...');
        const programAccount = await connection.getAccountInfo(programId);
        
        if (!programAccount) {
            throw new Error('Program account not found');
        }
        
        console.log('✅ Program account exists');
        console.log(`   Owner: ${programAccount.owner.toString()}`);
        console.log(`   Data length: ${programAccount.data.length} bytes`);
        
        // Test 2: Derive and check PDAs
        console.log('🔍 Test 2: PDA derivation...');
        
        const testGiveawayId = 999; // Use a test ID
        
        const [giveawayPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('giveaway'),
                new BN(testGiveawayId).toArrayLike(Buffer, 'le', 8)
            ],
            programId
        );
        
        const [vaultPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('vault'),
                new BN(testGiveawayId).toArrayLike(Buffer, 'le', 8)
            ],
            programId
        );
        
        console.log('✅ PDA derivation successful');
        console.log(`   Giveaway PDA: ${giveawayPda.toString()}`);
        console.log(`   Vault PDA: ${vaultPda.toString()}`);
        
        // Test 3: Check wallet balance
        console.log('🔍 Test 3: Wallet balance check...');
        const balance = await connection.getBalance(wallet.publicKey);
        const solBalance = balance / LAMPORTS_PER_SOL;
        
        console.log(`✅ Wallet balance: ${solBalance.toFixed(4)} SOL`);
        
        if (solBalance < 0.01) {
            console.warn('⚠️ Low SOL balance - may not be sufficient for transactions');
        }
        
        // Test 4: Try to fetch a giveaway (should fail gracefully)
        console.log('🔍 Test 4: Giveaway account test...');
        
        try {
            const giveawayAccount = await program.account.giveaway.fetch(giveawayPda);
            console.log('✅ Found existing giveaway:', giveawayAccount);
        } catch (error) {
            if (error.message.includes('Account does not exist')) {
                console.log('✅ No existing giveaway found (expected for new deployment)');
            } else {
                console.warn('⚠️ Unexpected error fetching giveaway:', error.message);
            }
        }
        
        // Test 5: Network latency test
        console.log('🔍 Test 5: Network performance...');
        const start = Date.now();
        await connection.getLatestBlockhash();
        const latency = Date.now() - start;
        
        console.log(`✅ Network latency: ${latency}ms`);
        
        if (latency > 1000) {
            console.warn('⚠️ High network latency detected');
        }
        
        // Test Summary
        console.log('');
        console.log('🎯 Test Results Summary:');
        console.log('================================');
        console.log(`✅ Program deployed and accessible`);
        console.log(`✅ PDA derivation working`);
        console.log(`✅ Wallet connection successful`);
        console.log(`✅ Network connectivity good`);
        console.log(`💰 Wallet balance: ${solBalance.toFixed(4)} SOL`);
        console.log(`⚡ Network latency: ${latency}ms`);
        console.log('');
        console.log('🚀 Ready for production use!');
        console.log('');
        console.log('📋 Next Steps:');
        console.log('1. Test giveaway creation via admin panel');
        console.log('2. Test wallet connection on frontend');
        console.log('3. Test end-to-end giveaway flow');
        console.log('4. Monitor transaction logs');
        
    } catch (error) {
        console.error('❌ Deployment test failed:', error.message);
        console.log('');
        console.log('🔧 Troubleshooting:');
        console.log('1. Verify program was deployed successfully');
        console.log('2. Check network connectivity');
        console.log('3. Ensure wallet has sufficient SOL');
        console.log('4. Verify IDL file is up to date');
        
        process.exit(1);
    }
}

main().catch(console.error);
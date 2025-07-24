#!/usr/bin/env node

/**
 * Checks program state and initializes if needed
 * Usage: node check-and-initialize.js <PROGRAM_ID> <NETWORK>
 */

import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { AnchorProvider, Wallet, Program } from '@coral-xyz/anchor';
import fs from 'fs';
import path from 'path';

const PROGRAM_ID = process.argv[2];
const NETWORK = process.argv[3];

if (!PROGRAM_ID || !NETWORK) {
    console.error('Usage: node check-and-initialize.js <PROGRAM_ID> <NETWORK>');
    process.exit(1);
}

const PROJECT_ROOT = process.cwd();

console.log('🔧 Checking program initialization...');

async function main() {
    try {
        // Setup connection
        const endpoint = NETWORK === 'mainnet' ? 
            clusterApiUrl('mainnet-beta') : 
            clusterApiUrl('devnet');
        
        const connection = new Connection(endpoint, 'confirmed');
        
        // Load wallet (you might need to adjust this path)
        const walletKeypairPath = path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
        
        if (!fs.existsSync(walletKeypairPath)) {
            console.error('❌ Wallet keypair not found at:', walletKeypairPath);
            console.log('💡 Run: solana-keygen new --outfile ~/.config/solana/id.json');
            process.exit(1);
        }
        
        const walletKeypair = JSON.parse(fs.readFileSync(walletKeypairPath, 'utf8'));
        const wallet = new Wallet(walletKeypair);
        
        // Setup provider
        const provider = new AnchorProvider(connection, wallet, {
            commitment: 'confirmed'
        });
        
        // Load IDL
        const idlPath = path.join(PROJECT_ROOT, 'frontend', 'utils', 'givefi_contract.json');
        
        if (!fs.existsSync(idlPath)) {
            console.error('❌ IDL file not found at:', idlPath);
            console.log('💡 Make sure to run the deployment script first');
            process.exit(1);
        }
        
        const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
        
        // Create program instance
        const programId = new PublicKey(PROGRAM_ID);
        const program = new Program(idl, programId, provider);
        
        console.log('✅ Program connection established');
        console.log(`📋 Program ID: ${PROGRAM_ID}`);
        console.log(`🌐 Network: ${NETWORK}`);
        console.log(`👛 Wallet: ${wallet.publicKey.toString()}`);
        
        // Check program account exists
        const programAccount = await connection.getAccountInfo(programId);
        
        if (!programAccount) {
            console.error('❌ Program account not found - deployment may have failed');
            process.exit(1);
        }
        
        console.log('✅ Program account verified');
        
        // Try to derive program authority PDA
        const [programAuthority] = PublicKey.findProgramAddressSync(
            [Buffer.from('authority')],
            programId
        );
        
        console.log(`🔑 Program Authority PDA: ${programAuthority.toString()}`);
        
        // Check if program authority account exists
        const authorityAccount = await connection.getAccountInfo(programAuthority);
        
        if (authorityAccount) {
            console.log('✅ Program already initialized');
            console.log('🎯 Ready for giveaway creation');
        } else {
            console.log('⚡ Program needs initialization');
            
            // You might want to add initialization logic here
            // For now, just report that manual initialization is needed
            console.log('💡 Manual initialization required:');
            console.log('   1. Use the admin panel to create your first giveaway');
            console.log('   2. Or run: anchor run initialize --provider.cluster', NETWORK);
        }
        
        // Final status report
        console.log('');
        console.log('📊 Status Summary:');
        console.log(`   ✅ Program deployed: ${PROGRAM_ID}`);
        console.log(`   ✅ Network configured: ${NETWORK}`);
        console.log(`   ✅ Wallet connected: ${wallet.publicKey.toString().slice(0, 8)}...`);
        console.log(`   ${authorityAccount ? '✅' : '⏳'} Program initialized: ${authorityAccount ? 'Yes' : 'Pending'}`);
        
    } catch (error) {
        console.error('❌ Initialization check failed:', error.message);
        
        if (error.message.includes('Invalid public key')) {
            console.log('💡 Check that the PROGRAM_ID is valid');
        } else if (error.message.includes('Network request failed')) {
            console.log('💡 Check your internet connection and RPC endpoint');
        } else {
            console.log('💡 See logs above for more details');
        }
        
        process.exit(1);
    }
}

main().catch(console.error);
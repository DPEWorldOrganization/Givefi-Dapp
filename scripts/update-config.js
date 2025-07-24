#!/usr/bin/env node

/**
 * Updates frontend configuration with deployed program details
 * Usage: node update-config.js <PROGRAM_ID> <NETWORK>
 */

import fs from 'fs';
import path from 'path';

const PROGRAM_ID = process.argv[2];
const NETWORK = process.argv[3];

if (!PROGRAM_ID || !NETWORK) {
    console.error('Usage: node update-config.js <PROGRAM_ID> <NETWORK>');
    process.exit(1);
}

const PROJECT_ROOT = process.cwd();
const FRONTEND_DIR = path.join(PROJECT_ROOT, 'frontend');

// Update frontend config.js
const configPath = path.join(FRONTEND_DIR, 'utils', 'config.js');

console.log('📝 Updating frontend configuration...');

try {
    let configContent = fs.readFileSync(configPath, 'utf8');
    
    // Update program ID
    configContent = configContent.replace(
        /PROGRAM_ID:\s*['"`].*?['"`]/,
        `PROGRAM_ID: '${PROGRAM_ID}'`
    );
    
    // Update network
    configContent = configContent.replace(
        /NETWORK:\s*['"`].*?['"`]/,
        `NETWORK: '${NETWORK}'`
    );
    
    // Update RPC endpoint based on network
    const rpcEndpoint = NETWORK === 'mainnet' ? 
        'https://api.mainnet-beta.solana.com' : 
        'https://api.devnet.solana.com';
    
    configContent = configContent.replace(
        /RPC_ENDPOINT:\s*['"`].*?['"`]/,
        `RPC_ENDPOINT: '${rpcEndpoint}'`
    );
    
    fs.writeFileSync(configPath, configContent);
    console.log('✅ Frontend config updated successfully');
    
} catch (error) {
    console.error('❌ Failed to update frontend config:', error.message);
    process.exit(1);
}

// Update contract.js with new IDL if it exists
const contractPath = path.join(FRONTEND_DIR, 'utils', 'contract.js');
const idlPath = path.join(FRONTEND_DIR, 'utils', 'givefi_contract.json');

if (fs.existsSync(idlPath)) {
    try {
        const idlContent = fs.readFileSync(idlPath, 'utf8');
        const idlObject = JSON.parse(idlContent);
        
        let contractContent = fs.readFileSync(contractPath, 'utf8');
        
        // Replace IDL object
        const idlRegex = /const\s+IDL\s*=\s*{[\s\S]*?};/;
        const newIdlString = `const IDL = ${JSON.stringify(idlObject, null, 2)};`;
        
        if (idlRegex.test(contractContent)) {
            contractContent = contractContent.replace(idlRegex, newIdlString);
        } else {
            // Add IDL at the beginning if not found
            contractContent = `${newIdlString}\n\n${contractContent}`;
        }
        
        fs.writeFileSync(contractPath, contractContent);
        console.log('✅ Contract IDL updated successfully');
        
    } catch (error) {
        console.warn('⚠️ Could not update contract IDL:', error.message);
    }
}

// Create environment-specific config file
const envConfigPath = path.join(FRONTEND_DIR, 'utils', `config.${NETWORK}.js`);
const envConfig = {
    PROGRAM_ID,
    NETWORK,
    RPC_ENDPOINT: NETWORK === 'mainnet' ? 
        'https://api.mainnet-beta.solana.com' : 
        'https://api.devnet.solana.com',
    COMMITMENT: 'confirmed',
    CLUSTER: NETWORK === 'mainnet' ? 'mainnet-beta' : 'devnet'
};

try {
    const envConfigContent = `// Auto-generated configuration for ${NETWORK}
export default ${JSON.stringify(envConfig, null, 2)};
`;
    
    fs.writeFileSync(envConfigPath, envConfigContent);
    console.log(`✅ Environment config created: config.${NETWORK}.js`);
    
} catch (error) {
    console.warn('⚠️ Could not create environment config:', error.message);
}

console.log('📋 Configuration Update Summary:');
console.log(`  Program ID: ${PROGRAM_ID}`);
console.log(`  Network: ${NETWORK}`);
console.log(`  RPC Endpoint: ${envConfig.RPC_ENDPOINT}`);
console.log('');
#!/usr/bin/env node

/**
 * Generates IDL template and updates configuration files
 * Usage: node generate-idl-template.js
 */

import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const SMART_CONTRACTS_DIR = path.join(PROJECT_ROOT, 'smart-contracts');
const FRONTEND_DIR = path.join(PROJECT_ROOT, 'frontend');

console.log('📝 Generating IDL template and updating configs...');

// Template IDL structure for GiveFi contract
const IDL_TEMPLATE = {
    "version": "0.1.0",
    "name": "givefi_contract",
    "instructions": [
        {
            "name": "createGiveaway",
            "accounts": [
                {
                    "name": "authority",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "giveaway",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "vault",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "systemProgram",
                    "isMut": false,
                    "isSigner": false
                }
            ],
            "args": [
                {
                    "name": "id",
                    "type": "u64"
                },
                {
                    "name": "prizeDescription",
                    "type": "string"
                },
                {
                    "name": "entryPriceSOL",
                    "type": "u64"
                },
                {
                    "name": "entryPriceGIVE",
                    "type": "u64"
                },
                {
                    "name": "maxEntries",
                    "type": "u64"
                },
                {
                    "name": "minParticipants",
                    "type": "u64"
                },
                {
                    "name": "endTimestamp",
                    "type": "i64"
                },
                {
                    "name": "jackpotEnabled",
                    "type": "bool"
                },
                {
                    "name": "earlyEndEnabled",
                    "type": "bool"
                }
            ]
        },
        {
            "name": "enterGiveawaySOL",
            "accounts": [
                {
                    "name": "user",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "giveaway",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "entry",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "vault",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "systemProgram",
                    "isMut": false,
                    "isSigner": false
                }
            ],
            "args": [
                {
                    "name": "giveawayId",
                    "type": "u64"
                }
            ]
        },
        {
            "name": "claimPrize",
            "accounts": [
                {
                    "name": "winner",
                    "isMut": true,
                    "isSigner": true
                },
                {
                    "name": "giveaway",
                    "isMut": true,
                    "isSigner": false
                },
                {
                    "name": "vault",
                    "isMut": true,
                    "isSigner": false
                }
            ],
            "args": [
                {
                    "name": "giveawayId",
                    "type": "u64"
                }
            ]
        }
    ],
    "accounts": [
        {
            "name": "Giveaway",
            "type": {
                "kind": "struct",
                "fields": [
                    {
                        "name": "id",
                        "type": "u64"
                    },
                    {
                        "name": "authority",
                        "type": "publicKey"
                    },
                    {
                        "name": "prizeDescription",
                        "type": "string"
                    },
                    {
                        "name": "entryPriceSOL",
                        "type": "u64"
                    },
                    {
                        "name": "entryPriceGIVE",
                        "type": "u64"
                    },
                    {
                        "name": "maxEntries",
                        "type": "u64"
                    },
                    {
                        "name": "minParticipants",
                        "type": "u64"
                    },
                    {
                        "name": "entryCount",
                        "type": "u64"
                    },
                    {
                        "name": "endTimestamp",
                        "type": "i64"
                    },
                    {
                        "name": "winner",
                        "type": {
                            "option": "publicKey"
                        }
                    },
                    {
                        "name": "status",
                        "type": {
                            "defined": "GiveawayStatus"
                        }
                    },
                    {
                        "name": "jackpotEnabled",
                        "type": "bool"
                    },
                    {
                        "name": "earlyEndEnabled",
                        "type": "bool"
                    },
                    {
                        "name": "totalPrizePool",
                        "type": "u64"
                    },
                    {
                        "name": "createdAt",
                        "type": "i64"
                    }
                ]
            }
        },
        {
            "name": "Entry",
            "type": {
                "kind": "struct",
                "fields": [
                    {
                        "name": "giveawayId",
                        "type": "u64"
                    },
                    {
                        "name": "user",
                        "type": "publicKey"
                    },
                    {
                        "name": "entryType",
                        "type": {
                            "defined": "EntryType"
                        }
                    },
                    {
                        "name": "amount",
                        "type": "u64"
                    },
                    {
                        "name": "timestamp",
                        "type": "i64"
                    }
                ]
            }
        }
    ],
    "types": [
        {
            "name": "GiveawayStatus",
            "type": {
                "kind": "enum",
                "variants": [
                    {
                        "name": "Pending"
                    },
                    {
                        "name": "Active"
                    },
                    {
                        "name": "Ended"
                    },
                    {
                        "name": "Cancelled"
                    },
                    {
                        "name": "PrizeClaimed"
                    }
                ]
            }
        },
        {
            "name": "EntryType",
            "type": {
                "kind": "enum",
                "variants": [
                    {
                        "name": "SOL"
                    },
                    {
                        "name": "GIVE"
                    }
                ]
            }
        }
    ],
    "errors": [
        {
            "code": 6000,
            "name": "InvalidGiveawayState",
            "msg": "Invalid giveaway state for this operation"
        },
        {
            "code": 6001,
            "name": "GiveawayNotEnded",
            "msg": "Giveaway has not ended yet"
        },
        {
            "code": 6002,
            "name": "GiveawayFull",
            "msg": "Giveaway is full"
        },
        {
            "code": 6003,
            "name": "InvalidOwner",
            "msg": "Invalid owner"
        },
        {
            "code": 6004,
            "name": "InsufficientFunds",
            "msg": "Insufficient funds"
        },
        {
            "code": 6005,
            "name": "AlreadyEntered",
            "msg": "User has already entered this giveaway"
        }
    ]
};

function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`   📁 Created directory: ${dirPath}`);
    }
}

function createIDLTemplate() {
    console.log('📄 Creating IDL template...');
    
    const templatePath = path.join(FRONTEND_DIR, 'utils', 'givefi_contract_template.json');
    ensureDirectoryExists(path.dirname(templatePath));
    
    fs.writeFileSync(templatePath, JSON.stringify(IDL_TEMPLATE, null, 2));
    console.log(`   ✅ IDL template created: ${templatePath}`);
    
    return templatePath;
}

function updateContractJSTemplate() {
    console.log('🔧 Updating contract.js template...');
    
    const contractPath = path.join(FRONTEND_DIR, 'utils', 'contract.js');
    
    if (!fs.existsSync(contractPath)) {
        console.warn('   ⚠️ contract.js not found, skipping update');
        return;
    }
    
    try {
        let contractContent = fs.readFileSync(contractPath, 'utf8');
        
        // Add comment indicating where IDL should be updated
        const idlComment = `// IDL will be automatically updated by deployment scripts
// Template IDL structure - replace with actual IDL after 'anchor build'
const IDL = ${JSON.stringify(IDL_TEMPLATE, null, 2)};`;
        
        // Replace existing IDL or add it
        const idlRegex = /const\s+IDL\s*=\s*{[\s\S]*?};/;
        
        if (idlRegex.test(contractContent)) {
            contractContent = contractContent.replace(idlRegex, idlComment);
        } else {
            // Add at the beginning
            contractContent = `${idlComment}\n\n${contractContent}`;
        }
        
        fs.writeFileSync(contractPath, contractContent);
        console.log('   ✅ contract.js updated with IDL template');
        
    } catch (error) {
        console.warn('   ⚠️ Could not update contract.js:', error.message);
    }
}

function createConfigurationHelper() {
    console.log('⚙️ Creating configuration helper...');
    
    const configHelperPath = path.join(FRONTEND_DIR, 'utils', 'config-helper.js');
    
    const configHelperContent = `/**
 * Configuration Helper for GiveFi
 * Provides utilities for managing configuration across environments
 */

// Default configuration values
export const DEFAULT_CONFIG = {
    PROGRAM_ID: 'YOUR_PROGRAM_ID_HERE', // Will be updated by deployment scripts
    NETWORK: 'devnet',
    RPC_ENDPOINT: 'https://api.devnet.solana.com',
    COMMITMENT: 'confirmed',
    
    // Treasury and token addresses (update these for your deployment)
    TREASURY_WALLET: 'YOUR_TREASURY_WALLET_HERE',
    GIVE_MINT: 'YOUR_GIVE_TOKEN_MINT_HERE', // Optional, for GIVE token entries
    
    // UI Configuration
    MAX_DESCRIPTION_LENGTH: 100,
    MIN_ENTRY_PRICE_SOL: 0.001, // 0.001 SOL minimum
    MAX_ENTRY_PRICE_SOL: 10,    // 10 SOL maximum
    DEFAULT_GIVEAWAY_DURATION: 24 * 60 * 60, // 24 hours in seconds
    
    // Network endpoints
    EXPLORER_BASE_URL: {
        'devnet': 'https://explorer.solana.com',
        'mainnet': 'https://explorer.solana.com'
    }
};

// Environment-specific configurations
export const NETWORK_CONFIGS = {
    devnet: {
        ...DEFAULT_CONFIG,
        NETWORK: 'devnet',
        RPC_ENDPOINT: 'https://api.devnet.solana.com',
        CLUSTER: 'devnet'
    },
    
    mainnet: {
        ...DEFAULT_CONFIG,
        NETWORK: 'mainnet',
        RPC_ENDPOINT: 'https://api.mainnet-beta.solana.com',
        CLUSTER: 'mainnet-beta'
    }
};

/**
 * Get configuration for specified network
 * @param {string} network - 'devnet' or 'mainnet'
 * @returns {object} Configuration object
 */
export function getNetworkConfig(network = 'devnet') {
    const config = NETWORK_CONFIGS[network];
    if (!config) {
        throw new Error(\`Unknown network: \${network}\`);
    }
    return { ...config };
}

/**
 * Validate configuration object
 * @param {object} config - Configuration to validate
 * @returns {string[]} Array of validation errors
 */
export function validateConfig(config) {
    const errors = [];
    
    if (!config.PROGRAM_ID || config.PROGRAM_ID === 'YOUR_PROGRAM_ID_HERE') {
        errors.push('PROGRAM_ID is not set');
    }
    
    if (!config.RPC_ENDPOINT) {
        errors.push('RPC_ENDPOINT is required');
    }
    
    if (!config.NETWORK || !['devnet', 'mainnet'].includes(config.NETWORK)) {
        errors.push('NETWORK must be either "devnet" or "mainnet"');
    }
    
    return errors;
}

/**
 * Update configuration with new values
 * @param {object} updates - Configuration updates
 * @returns {object} Updated configuration
 */
export function updateConfig(baseConfig, updates) {
    return {
        ...baseConfig,
        ...updates
    };
}

/**
 * Get explorer URL for a given address
 * @param {string} address - Address to explore
 * @param {string} network - Network name
 * @returns {string} Explorer URL
 */
export function getExplorerUrl(address, network = 'devnet') {
    const baseUrl = DEFAULT_CONFIG.EXPLORER_BASE_URL[network];
    const cluster = network === 'mainnet' ? '' : \`?cluster=\${network}\`;
    return \`\${baseUrl}/address/\${address}\${cluster}\`;
}

/**
 * Get transaction explorer URL
 * @param {string} signature - Transaction signature
 * @param {string} network - Network name
 * @returns {string} Explorer URL
 */
export function getTransactionUrl(signature, network = 'devnet') {
    const baseUrl = DEFAULT_CONFIG.EXPLORER_BASE_URL[network];
    const cluster = network === 'mainnet' ? '' : \`?cluster=\${network}\`;
    return \`\${baseUrl}/tx/\${signature}\${cluster}\`;
}

export default {
    DEFAULT_CONFIG,
    NETWORK_CONFIGS,
    getNetworkConfig,
    validateConfig,
    updateConfig,
    getExplorerUrl,
    getTransactionUrl
};`;
    
    fs.writeFileSync(configHelperPath, configHelperContent);
    console.log(`   ✅ Configuration helper created: ${configHelperPath}`);
}

function createDeploymentStatusChecker() {
    console.log('📊 Creating deployment status checker...');
    
    const statusCheckerPath = path.join(PROJECT_ROOT, 'scripts', 'check-deployment-status.js');
    
    const statusCheckerContent = `#!/usr/bin/env node

/**
 * Checks deployment status and configuration
 * Usage: node check-deployment-status.js [network]
 */

import { Connection, PublicKey } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

const NETWORK = process.argv[2] || 'devnet';
const PROJECT_ROOT = process.cwd();

console.log(\`🔍 Checking deployment status for \${NETWORK}...\`);

async function checkDeploymentStatus() {
    const errors = [];
    const warnings = [];
    const status = {};
    
    try {
        // 1. Check if smart contract is built
        const buildPath = path.join(PROJECT_ROOT, 'smart-contracts', 'target', 'deploy');
        const keypairPath = path.join(buildPath, 'givefi_contract-keypair.json');
        const idlPath = path.join(PROJECT_ROOT, 'smart-contracts', 'target', 'idl', 'givefi_contract.json');
        
        if (!fs.existsSync(keypairPath)) {
            errors.push('Smart contract not built - run: anchor build');
        } else {
            status.contractBuilt = true;
            
            // Get program ID
            const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf8'));
            const programKeypair = keypairData;
            status.programId = new PublicKey(programKeypair).toString();
        }
        
        if (!fs.existsSync(idlPath)) {
            errors.push('IDL not generated - run: anchor build');
        } else {
            status.idlGenerated = true;
        }
        
        // 2. Check network connection
        const endpoint = NETWORK === 'mainnet' ? 
            'https://api.mainnet-beta.solana.com' : 
            'https://api.devnet.solana.com';
        
        const connection = new Connection(endpoint, 'confirmed');
        
        try {
            await connection.getVersion();
            status.networkConnected = true;
        } catch (error) {
            errors.push(\`Cannot connect to \${NETWORK}: \${error.message}\`);
        }
        
        // 3. Check if program is deployed
        if (status.programId && status.networkConnected) {
            try {
                const programId = new PublicKey(status.programId);
                const accountInfo = await connection.getAccountInfo(programId);
                
                if (accountInfo) {
                    status.programDeployed = true;
                    status.programOwner = accountInfo.owner.toString();
                } else {
                    warnings.push('Program not deployed to ' + NETWORK);
                }
            } catch (error) {
                warnings.push('Could not check program deployment: ' + error.message);
            }
        }
        
        // 4. Check frontend configuration
        const frontendConfigPath = path.join(PROJECT_ROOT, 'frontend', 'utils', 'config.js');
        
        if (fs.existsSync(frontendConfigPath)) {
            const configContent = fs.readFileSync(frontendConfigPath, 'utf8');
            
            if (configContent.includes('YOUR_PROGRAM_ID_HERE')) {
                warnings.push('Frontend config contains placeholder values');
            } else {
                status.frontendConfigured = true;
            }
        } else {
            errors.push('Frontend config.js not found');
        }
        
        // 5. Check IDL in frontend
        const frontendIdlPath = path.join(PROJECT_ROOT, 'frontend', 'utils', 'givefi_contract.json');
        
        if (fs.existsSync(frontendIdlPath)) {
            status.frontendIdlExists = true;
        } else {
            warnings.push('IDL not copied to frontend');
        }
        
        // Print results
        console.log('');
        console.log('📋 Deployment Status Report');
        console.log('============================');
        console.log(\`Network: \${NETWORK}\`);
        
        if (status.programId) {
            console.log(\`Program ID: \${status.programId}\`);
        }
        
        console.log('');
        console.log('✅ Completed Steps:');
        
        if (status.contractBuilt) console.log('  ✅ Smart contract built');
        if (status.idlGenerated) console.log('  ✅ IDL generated');
        if (status.networkConnected) console.log(\`  ✅ Connected to \${NETWORK}\`);
        if (status.programDeployed) console.log(\`  ✅ Program deployed to \${NETWORK}\`);
        if (status.frontendConfigured) console.log('  ✅ Frontend configured');
        if (status.frontendIdlExists) console.log('  ✅ Frontend IDL exists');
        
        if (warnings.length > 0) {
            console.log('');
            console.log('⚠️ Warnings:');
            warnings.forEach(warning => console.log(\`  ⚠️ \${warning}\`));
        }
        
        if (errors.length > 0) {
            console.log('');
            console.log('❌ Errors:');
            errors.forEach(error => console.log(\`  ❌ \${error}\`));
            
            console.log('');
            console.log('🔧 Next Steps:');
            console.log('1. Fix the errors listed above');
            console.log('2. Run the deployment script: ./scripts/deploy.sh ' + NETWORK);
            console.log('3. Test the deployment: node scripts/test-deployment.js');
            
            process.exit(1);
        } else {
            console.log('');
            console.log('🎉 Deployment looks good!');
            
            if (warnings.length === 0) {
                console.log('✅ Ready for production use');
            } else {
                console.log('⚠️ Consider addressing warnings above');
            }
        }
        
    } catch (error) {
        console.error('❌ Status check failed:', error.message);
        process.exit(1);
    }
}

checkDeploymentStatus().catch(console.error);`;
    
    fs.writeFileSync(statusCheckerPath, statusCheckerContent);
    console.log(`   ✅ Deployment status checker created: ${statusCheckerPath}`);
}

async function main() {
    try {
        createIDLTemplate();
        updateContractJSTemplate();
        createConfigurationHelper();
        createDeploymentStatusChecker();
        
        console.log('');
        console.log('✅ IDL template and configuration utilities generated!');
        console.log('');
        console.log('📋 Generated Files:');
        console.log('- frontend/utils/givefi_contract_template.json (IDL template)');
        console.log('- frontend/utils/config-helper.js (Configuration utilities)');
        console.log('- scripts/check-deployment-status.js (Deployment status checker)');
        console.log('');
        console.log('🔧 Usage:');
        console.log('1. Build contract: anchor build');
        console.log('2. Deploy: ./scripts/deploy.sh devnet');
        console.log('3. Check status: node scripts/check-deployment-status.js devnet');
        console.log('4. Test deployment: node scripts/test-deployment.js PROGRAM_ID devnet');
        
    } catch (error) {
        console.error('❌ Generation failed:', error.message);
        process.exit(1);
    }
}

main().catch(console.error);
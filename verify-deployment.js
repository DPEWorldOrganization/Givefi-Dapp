#!/usr/bin/env node

/**
 * Production Deployment Verification Script
 * Verifies the DAO governance system is live and functional
 */

const https = require('https');
const fs = require('fs');

const PRODUCTION_URL = 'https://givefi.fun';
const LOCAL_URL = 'http://localhost:8000';

// Console colors
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkEndpoint(url, description) {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname,
            method: 'GET',
            timeout: 10000
        };

        const client = urlObj.protocol === 'https:' ? https : require('http');
        
        const req = client.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const hasDao = data.includes('DAO_CONFIG') && data.includes('createRaffleProposal');
                const hasGlassTheme = data.includes('--glass-bg') && data.includes('marketplace-grid');
                const hasLiveData = data.includes('ActivityFeed') && data.includes('live-data-card');
                
                const features = [];
                if (hasDao) features.push('DAO');
                if (hasGlassTheme) features.push('Glass Theme');
                if (hasLiveData) features.push('Live Data');
                
                const featureStr = features.length > 0 ? features.join(', ') : 'None';
                log(`✅ ${description}: ${res.statusCode} - Features: [${featureStr}]`, 
                    features.length >= 2 ? 'green' : 'yellow');
                resolve({ success: res.statusCode === 200, hasDao, hasGlassTheme, hasLiveData });
            });
        });

        req.on('error', (err) => {
            log(`❌ ${description}: Failed - ${err.message}`, 'red');
            resolve({ success: false, hasDao: false, hasGlassTheme: false, hasLiveData: false });
        });

        req.on('timeout', () => {
            log(`⏰ ${description}: Timeout`, 'yellow');
            req.destroy();
            resolve({ success: false, hasDao: false, hasGlassTheme: false, hasLiveData: false });
        });

        req.end();
    });
}

async function verifyDeployment() {
    log('\n🔍 PRODUCTION DEPLOYMENT VERIFICATION', 'cyan');
    log('Checking DAO governance system deployment...\n', 'yellow');

    // Check local development server
    log('📍 Local Development Server:', 'blue');
    const localMain = await checkEndpoint(`${LOCAL_URL}/admin.html`, 'Admin Panel (Local)');
    const localIndex = await checkEndpoint(`${LOCAL_URL}/index.html`, 'Main Site (Local)');

    // Check production deployment
    log('\n🌐 Production Deployment:', 'blue');
    const prodMain = await checkEndpoint(`${PRODUCTION_URL}/admin.html`, 'Admin Panel (Production)');
    const prodIndex = await checkEndpoint(`${PRODUCTION_URL}/index.html`, 'Main Site (Production)');

    // Summary
    log('\n📊 DEPLOYMENT STATUS SUMMARY:', 'cyan');
    
    const localDaoActive = localMain.success && localMain.hasDao;
    const localGlassActive = localIndex.success && localIndex.hasGlassTheme;
    const localLiveActive = localIndex.success && localIndex.hasLiveData;
    
    const prodDaoActive = prodMain.success && prodMain.hasDao;
    const prodGlassActive = prodIndex.success && prodIndex.hasGlassTheme;
    const prodLiveActive = prodIndex.success && prodIndex.hasLiveData;
    
    log(`🖥️  Local Development:`, 'blue');
    log(`   DAO System: ${localDaoActive ? '✅ Active' : '❌ Missing'}`, localDaoActive ? 'green' : 'red');
    log(`   Glass Theme: ${localGlassActive ? '✅ Active' : '❌ Missing'}`, localGlassActive ? 'green' : 'red');
    log(`   Live Data: ${localLiveActive ? '✅ Active' : '❌ Missing'}`, localLiveActive ? 'green' : 'red');
    
    log(`🌍 Production Site:`, 'blue');
    log(`   DAO System: ${prodDaoActive ? '✅ Active' : '❌ Missing'}`, prodDaoActive ? 'green' : 'red');
    log(`   Glass Theme: ${prodGlassActive ? '✅ Active' : '❌ Missing'}`, prodGlassActive ? 'green' : 'red');
    log(`   Live Data: ${prodLiveActive ? '✅ Active' : '❌ Missing'}`, prodLiveActive ? 'green' : 'red');

    const allLocalActive = localDaoActive && localGlassActive && localLiveActive;
    const allProdActive = prodDaoActive && prodGlassActive && prodLiveActive;

    if (allProdActive) {
        log('\n🎉 SUCCESS: Complete marketplace system is LIVE in production!', 'green');
        log('✅ DAO governance system with $GIVE token staking', 'green');
        log('✅ Glass dark theme with marketplace layout', 'green');
        log('✅ Live activity feeds and real-time data', 'green');
        log('✅ Community-driven raffle verification process', 'green');
    } else if (prodDaoActive) {
        log('\n⚠️  PARTIAL DEPLOYMENT: DAO system live, marketplace features need deployment', 'yellow');
    } else {
        log('\n❌ ISSUES DETECTED: Production deployment needs attention', 'red');
    }

    // Next steps
    log('\n📋 NEXT STEPS:', 'cyan');
    if (!allProdActive) {
        log('1. Deploy updated index.html with glass marketplace theme', 'yellow');
        log('2. Test new marketplace layout and live data feeds', 'yellow');
    }
    log('3. Test wallet connection on admin panel', 'yellow');
    log('4. Create a test raffle proposal through DAO', 'yellow');  
    log('5. Verify DAO voting functionality with $GIVE tokens', 'yellow');
    log('6. Monitor proposal approval workflow', 'yellow');
    log('7. Test marketplace search and filter functionality', 'yellow');

    return allProdActive;
}

if (require.main === module) {
    verifyDeployment().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = { verifyDeployment };

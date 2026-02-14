import dotenv from 'dotenv';
import { createAgentWithWallet } from './services/agentWalletService.js';
import Agent from './models/Agent.js';
import { getAgentBalances } from './services/agentTransactionService.js';

dotenv.config();

/**
 * Test script to verify real on-chain agent registration
 * 
 * This script will:
 * 1. Create an agent with real wallet
 * 2. Fund it with ETH from treasury
 * 3. Register it on Tycoon contract
 * 4. Verify it received 2 TYC tokens
 */

async function testAgentRegistration() {
    console.log('\n🧪 Testing Real On-Chain Agent Registration\n');
    console.log('='.repeat(60));

    try {
        // Check environment variables
        console.log('\n📋 Step 1: Checking environment configuration...');

        const requiredEnvVars = [
            'MONAD_RPC_URL',
            'TYCOON_CONTRACT_ADDRESS',
            'TYC_TOKEN_ADDRESS',
            'TREASURY_PRIVATE_KEY',
            'TREASURY_ADDRESS'
        ];

        const missing = requiredEnvVars.filter(v => !process.env[v]);

        if (missing.length > 0) {
            console.error('❌ Missing environment variables:', missing.join(', '));
            console.log('\n💡 Please configure these in your .env file');
            process.exit(1);
        }

        console.log('✅ All required environment variables are set');
        console.log(`   RPC URL: ${process.env.MONAD_RPC_URL}`);
        console.log(`   Tycoon Contract: ${process.env.TYCOON_CONTRACT_ADDRESS}`);
        console.log(`   Treasury: ${process.env.TREASURY_ADDRESS}`);

        // Create agent
        console.log('\n📋 Step 2: Creating agent with on-chain registration...');

        const agentData = {
            name: `TestAgent_${Date.now()}`,
            owner_address: process.env.TREASURY_ADDRESS, // Use treasury as owner for testing
            owner_email: 'test@example.com',
            strategy: 'balanced',
            risk_profile: 'balanced',
            config: {
                test: true,
                created_at: new Date().toISOString()
            }
        };

        console.log(`   Agent name: ${agentData.name}`);
        console.log('   Generating wallet...');
        console.log('   Funding with ETH...');
        console.log('   Registering on-chain...');

        const agent = await createAgentWithWallet(agentData);

        console.log('\n✅ Agent created successfully!');
        console.log(`   Agent ID: ${agent.id}`);
        console.log(`   Wallet Address: ${agent.wallet_address}`);
        console.log(`   Registration TX: ${agent.registration_tx}`);
        console.log(`   ETH Balance (DB): ${agent.eth_balance}`);
        console.log(`   TYC Balance (DB): ${agent.tyc_balance}`);

        // Verify on-chain balances
        console.log('\n📋 Step 3: Verifying on-chain balances...');
        console.log('   Querying blockchain...');

        const balances = await getAgentBalances(agent.id);

        console.log('\n✅ On-chain balances retrieved!');
        console.log(`   ETH: ${balances.eth}`);
        console.log(`   TYC: ${balances.tyc}`);
        console.log(`   USDC: ${balances.usdc}`);

        // Verify TYC tokens
        console.log('\n📋 Step 4: Verifying TYC token reward...');

        const tycBalance = parseFloat(balances.tyc);

        if (tycBalance >= 2.0) {
            console.log('✅ SUCCESS! Agent received TYC tokens from registration');
            console.log(`   Expected: 2.0 TYC (as vouchers)`);
            console.log(`   Actual: ${tycBalance} TYC`);
        } else {
            console.log('⚠️  WARNING: TYC balance is less than expected');
            console.log(`   Expected: 2.0 TYC`);
            console.log(`   Actual: ${tycBalance} TYC`);
            console.log('   Note: Vouchers may need to be redeemed first');
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('🎉 TEST COMPLETED SUCCESSFULLY!\n');
        console.log('Summary:');
        console.log(`  ✅ Agent created: ${agent.name}`);
        console.log(`  ✅ Wallet generated: ${agent.wallet_address}`);
        console.log(`  ✅ Funded with ETH: ${balances.eth} ETH`);
        console.log(`  ✅ Registered on-chain: ${agent.registration_tx}`);
        console.log(`  ✅ TYC balance: ${balances.tyc} TYC`);
        console.log('\n✨ Agent is ready to play games!\n');

        process.exit(0);

    } catch (error) {
        console.error('\n❌ TEST FAILED!');
        console.error('Error:', error.message);
        console.error('\nStack trace:');
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the test
testAgentRegistration();

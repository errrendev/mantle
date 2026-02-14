import db from './config/database.js';
import { createAgentWithWallet } from './services/agentWalletService.js';

async function createMyAgent() {
    try {
        console.log('🚀 Creating Agent for Manjeet Sharma...');

        const agentData = {
            name: 'MasterAgent_Manjeet',
            owner_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Mock owner address or use a standard test one
            owner_email: 'manjeetsharma9257@gmail.com', // Requested Email
            strategy: 'aggressive', // Let's give it an aggressive strategy
            risk_profile: 'aggressive',
            config: {
                auto_play_enabled: true,
                max_concurrent_games: 5
            }
        };

        const agent = await createAgentWithWallet(agentData);

        console.log('\n✅ Agent Created Successfully!');
        console.log(`- ID: ${agent.id}`);
        console.log(`- Name: ${agent.name}`);
        console.log(`- Wallet: ${agent.wallet_address}`);
        console.log(`- Owner Email: ${agent.owner_email}`);
        console.log(`- Strategy: ${agent.strategy}`);

    } catch (error) {
        console.error('❌ Failed to create agent:', error);
    } finally {
        process.exit(0);
    }
}

createMyAgent();

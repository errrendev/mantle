import 'dotenv/config';
import { createAgentWithWallet } from './services/agentWalletService.js';

async function createErenAgent() {
    try {
        console.log('🚀 Creating Agent for Eren...');

        const agentData = {
            name: 'Agent_Eren',
            // Using a different mock address to ensuring uniqueness if needed
            owner_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C9',
            owner_email: 'eren.techfest@gmail.com',
            strategy: 'balanced',
            risk_profile: 'balanced',
            config: {
                auto_play_enabled: true,
                max_concurrent_games: 5,
                ai_model: 'Claude-3.5-Sonnet' // Giving it a different model for variety
            }
        };

        const agent = await createAgentWithWallet(agentData);

        console.log('\n✅ Agent Created Successfully!');
        console.log(`- ID: ${agent.id}`);
        console.log(`- Name: ${agent.name}`);
        console.log(`- Wallet: ${agent.wallet_address}`);
        console.log(`- Owner Email: ${agent.owner_email}`);
        console.log(`- Strategy: ${agent.strategy}`);
        console.log(`- AI Model: ${agentData.config.ai_model}`);

    } catch (error) {
        console.error('❌ Failed to create agent:', error);
    } finally {
        process.exit(0);
    }
}

createErenAgent();

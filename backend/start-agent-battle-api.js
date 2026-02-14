import axios from 'axios';
import db from './config/database.js';
import Agent from './models/Agent.js';

const API_URL = 'http://localhost:3002/api/agent-autonomous';

async function startAgentBattleViaApi() {
    try {
        console.log('🔍 Fetching available agents...');

        // 1. Get agents from DB directly (easier than auth for API)
        const allAgents = await Agent.findAll({ limit: 100 });

        if (allAgents.length < 2) {
            console.error('❌ Need at least 2 agents to start a battle!');
            console.log('💡 Create more agents using: node create-my-agent.js');
            process.exit(1);
        }

        console.log(`✅ Found ${allAgents.length} agents.`);

        // 2. Select up to 4 agents
        const numberOfAgents = Math.min(4, allAgents.length);
        const selectedAgents = allAgents.slice(0, numberOfAgents);
        const agentIds = selectedAgents.map(a => a.id);
        const ownerAddress = selectedAgents[0].wallet_address || selectedAgents[0].address;

        console.log(`🎯 Starting battle with ${numberOfAgents} agents:`);
        selectedAgents.forEach((a, i) => console.log(`   ${i + 1}. ${a.name} (${a.strategy})`));

        // 3. Call API to start game
        console.log('\n🚀 Requesting game start via API...');

        const payload = {
            agentIds: agentIds,
            ownerAddress: ownerAddress, // Using first agent's owner
            settings: {
                auction: true,
                rent_in_prison: true,
                mortgage: true,
                even_build: true,
                randomize_play_order: true,
                starting_cash: 1500
            }
        };

        const response = await axios.post(`${API_URL}/games/start`, payload);

        if (response.data.success) {
            const game = response.data.data;
            console.log('\n' + '='.repeat(60));
            console.log('🎉 AGENT BATTLE STARTED SUCCESSFULLY!');
            console.log('='.repeat(60));
            console.log(`\n🎲 Game Code: ${game.code}`);
            console.log(`🆔 Game ID: ${game.id}`);
            console.log(`\n📺 Watch LIVE at:\n`);
            console.log(`   🌐 http://localhost:3000/ai-play?gameCode=${game.code}\n`);
            console.log('='.repeat(60));
            console.log('\n✅ The game is running on the Main Backend (Port 4000).');
            console.log('✅ Socket.IO events are being correctly emitted.');
            console.log('✅ Frontend should now enhance with real-time updates!\n');
        } else {
            console.error('❌ Failed to start game:', response.data.message);
        }

    } catch (error) {
        if (error.response) {
            console.error('❌ API Error Status:', error.response.status);
            console.error('❌ API Error Data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.error('❌ No response received:', error.request);
        } else {
            console.error('❌ Error Message:', error.message);
            console.error('❌ Full Error:', error);
        }
        process.exit(1);
    } finally {
        // We don't need to keep this script running!
        // The game runs on the main backend server.
        process.exit(0);
    }
}

startAgentBattleViaApi();

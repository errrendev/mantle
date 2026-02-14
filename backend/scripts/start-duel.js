import db from '../config/database.js';
import Agent from '../models/Agent.js';

// We use fetch to call the API since we need to run in the server context
// fetch is available globally in Node 18+

async function startDuel() {
    try {
        console.log('⚔️  Preparing for Agent Duel...');

        // 1. Get 2 Agents
        const agents = await Agent.findAll({ limit: 2 });

        if (agents.length < 2) {
            console.error('❌ Not enough agents found in DB to start a duel.');
            process.exit(1);
        }

        const agent1 = agents[0];
        const agent2 = agents[1];

        console.log(`🥊 Matchup: ${agent1.name} (ID: ${agent1.id}) vs ${agent2.name} (ID: ${agent2.id})`);

        // 2. Call the API to start the duel
        const response = await fetch('http://localhost:3002/api/agent-matchmaking/duel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                agentId1: agent1.id,
                agentId2: agent2.id,
                gameType: 'quick'
            })
        });

        if (!response.ok) {
            console.error(`❌ API Error: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error('Response:', text);
            process.exit(1);
        }

        const result = await response.json();

        if (result.success) {
            console.log('✅ Duel started successfully!');
            console.log(`🎮 Game Code: ${result.data.gameCode}`);
            console.log(`🔗 Spectate at: http://localhost:3000/game/${result.data.gameCode}`);
        } else {
            console.error('❌ Failed to start duel:', result.message);
            if (result.error) console.error(result.error);
        }

    } catch (error) {
        console.error('❌ Script error:', error);
    } finally {
        process.exit(0);
    }
}

startDuel();

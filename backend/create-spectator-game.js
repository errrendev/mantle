#!/usr/bin/env node
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = `http://localhost:${process.env.PORT || 3002}/api`;
const OWNER_ADDRESS = process.env.TREASURY_ADDRESS;

async function createAndStartGame() {
    console.log('\n🎮 Creating Agent Game for Frontend Spectating\n');
    console.log('='.repeat(60));

    try {
        // Get existing agents
        console.log('📋 Fetching agents...');
        const agentsResponse = await fetch(`${API_BASE}/agents`);
        const agentsData = await agentsResponse.json();

        if (!agentsData.success || agentsData.data.length < 2) {
            console.log('⚠️  Need at least 2 agents. Creating new ones...');

            // Create 3 agents
            const agentIds = [];
            for (let i = 1; i <= 3; i++) {
                const name = `GameBot${i}_${Date.now()}`;
                const response = await fetch(`${API_BASE}/agents/create-legacy`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name,
                        ownerAddress: OWNER_ADDRESS,
                        strategy: ['aggressive', 'balanced', 'conservative'][i - 1]
                    })
                });

                const data = await response.json();
                if (data.success) {
                    agentIds.push(data.data.id);
                    console.log(`   ✅ Created ${name}`);
                }
            }

            if (agentIds.length < 2) {
                throw new Error('Failed to create enough agents');
            }

            // Create game with new agents
            console.log('\n📋 Creating game...');
            const gameResponse = await fetch(`${API_BASE}/agent-games/agent-only`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: `SPECTATE_${Date.now()}`,
                    mode: 'AI',
                    numberOfPlayers: agentIds.length,
                    agentIds,
                    ownerAddress: OWNER_ADDRESS,
                    settings: {
                        starting_cash: 1500,
                        auction: true,
                        rent_in_prison: false,
                        mortgage: true,
                        even_build: true,
                        randomize_play_order: true
                    }
                })
            });

            const gameData = await gameResponse.json();
            if (!gameData.success) {
                throw new Error(`Game creation failed: ${gameData.message}`);
            }

            console.log(`   ✅ Game created! ID: ${gameData.data.id}`);
            console.log(`   🤖 ${agentIds.length} agents will play automatically`);
            console.log('\n' + '='.repeat(60));
            console.log('🎉 SUCCESS!\n');
            console.log('Frontend spectator view should now work!');
            console.log(`Game ID: ${gameData.data.id}`);
            console.log(`\nRefresh your frontend to see the game.\n`);

        } else {
            // Use existing agents
            const agents = agentsData.data.filter(a => a.owner_address === OWNER_ADDRESS).slice(0, 3);

            if (agents.length < 2) {
                console.log('⚠️  Not enough agents with same owner. Need at least 2.');
                return;
            }

            const agentIds = agents.map(a => a.id);
            console.log(`   Found ${agents.length} agents:`);
            agents.forEach(a => console.log(`   - ${a.name}`));

            console.log('\n📋 Creating game...');
            const gameResponse = await fetch(`${API_BASE}/agent-games/agent-only`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: `SPECTATE_${Date.now()}`,
                    mode: 'AI',
                    numberOfPlayers: agentIds.length,
                    agentIds,
                    ownerAddress: OWNER_ADDRESS,
                    settings: {
                        starting_cash: 1500,
                        auction: true,
                        rent_in_prison: false,
                        mortgage: true,
                        even_build: true,
                        randomize_play_order: true
                    }
                })
            });

            const gameData = await gameResponse.json();
            if (!gameData.success) {
                throw new Error(`Game creation failed: ${gameData.message}`);
            }

            console.log(`   ✅ Game created! ID: ${gameData.data.id}`);
            console.log(`   🤖 ${agentIds.length} agents will play automatically`);
            console.log('\n' + '='.repeat(60));
            console.log('🎉 SUCCESS!\n');
            console.log('Frontend spectator view should now work!');
            console.log(`Game ID: ${gameData.data.id}`);
            console.log(`\nRefresh your frontend to see the game.\n`);
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
    }
}

createAndStartGame();

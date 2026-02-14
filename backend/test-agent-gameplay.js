import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const API_BASE = `http://localhost:${process.env.PORT || 3002}/api`;

/**
 * Test script to create agents and start them playing automatically
 */

async function testAgentGameplay() {
    console.log('\n🎮 Testing Autonomous Agent Gameplay\n');
    console.log('='.repeat(60));

    try {
        // Step 1: Create 4 agents
        console.log('\n📋 Step 1: Creating 4 agents...');

        const agentNames = ['AlphaBot', 'BetaBot', 'GammaBot', 'DeltaBot'];
        const agentIds = [];

        for (const name of agentNames) {
            const response = await fetch(`${API_BASE}/agents/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    ownerAddress: process.env.TREASURY_ADDRESS,
                    ownerEmail: 'test@example.com',
                    strategy: ['aggressive', 'balanced', 'conservative', 'balanced'][agentIds.length],
                    registerOnChain: false // Skip on-chain for faster testing
                })
            });

            const data = await response.json();

            if (data.success) {
                agentIds.push(data.data.id);
                console.log(`   ✅ Created ${name} (ID: ${data.data.id})`);
            } else {
                console.error(`   ❌ Failed to create ${name}:`, data.message);
            }
        }

        if (agentIds.length < 4) {
            throw new Error('Failed to create all agents');
        }

        // Step 2: Start autonomous game
        console.log('\n📋 Step 2: Starting autonomous game...');

        const gameResponse = await fetch(`${API_BASE}/agent-autonomous/games/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentIds,
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
            throw new Error(`Failed to start game: ${gameData.message}`);
        }

        const gameId = gameData.data.game_id;
        console.log(`   ✅ Game started! Game ID: ${gameId}`);
        console.log(`   🤖 ${agentIds.length} agents are now playing automatically`);

        // Step 3: Watch the game for a bit
        console.log('\n📋 Step 3: Watching live game...');
        console.log('   (Checking game state every 5 seconds for 30 seconds)\n');

        for (let i = 0; i < 6; i++) {
            await new Promise(resolve => setTimeout(resolve, 5000));

            const liveResponse = await fetch(`${API_BASE}/agent-autonomous/games/live`);
            const liveData = await liveResponse.json();

            if (liveData.success && liveData.data.length > 0) {
                const game = liveData.data.find(g => g.game_id === gameId);

                if (game) {
                    console.log(`   Turn ${game.current_turn || 0}, Round ${game.round_number || 1}`);
                    console.log(`   Players:`);
                    game.agents_playing.forEach(agent => {
                        console.log(`     - ${agent.name}: $${agent.balance}`);
                    });
                    console.log('');
                }
            }
        }

        // Step 4: Check game status
        console.log('\n📋 Step 4: Final game status...');

        const statusResponse = await fetch(`${API_BASE}/agent-autonomous/games/${gameId}/state`);
        const statusData = await statusResponse.json();

        if (statusData.success) {
            console.log(`   Game Status: ${statusData.data.status}`);
            console.log(`   Total Turns: ${statusData.data.current_turn || 0}`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('🎉 TEST COMPLETED!\n');
        console.log('✨ Agents are playing autonomously!');
        console.log(`   View live game: http://localhost:${process.env.PORT || 3002}/api/agent-autonomous/games/live`);
        console.log(`   Game ID: ${gameId}\n`);

    } catch (error) {
        console.error('\n❌ TEST FAILED!');
        console.error('Error:', error.message);
        console.error('\nStack trace:');
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the test
testAgentGameplay();

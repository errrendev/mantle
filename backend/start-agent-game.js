import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = `http://localhost:${process.env.PORT || 3002}/api`;

async function startGameWithExistingAgents() {
    console.log('\n🎮 Starting Game with Existing Agents\n');
    console.log('='.repeat(60));

    try {
        // Step 1: Get existing agents
        console.log('\n📋 Step 1: Fetching existing agents...');

        const agentsResponse = await fetch(`${API_BASE}/agents`);
        const agentsData = await agentsResponse.json();

        if (!agentsData.success || agentsData.data.length < 2) {
            throw new Error('Need at least 2 agents to start a game');
        }

        const agents = agentsData.data.slice(0, 4); // Take up to 4 agents
        const agentIds = agents.map(a => a.id);

        console.log(`   Found ${agents.length} agents:`);
        agents.forEach(agent => {
            console.log(`   - ${agent.name} (ID: ${agent.id}, Strategy: ${agent.strategy})`);
        });

        // Step 2: Start autonomous game
        console.log('\n📋 Step 2: Starting autonomous game...');

        const gameResponse = await fetch(`${API_BASE}/agent-autonomous/games/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentIds,
                ownerAddress: agents[0].owner_address, // Use owner address for verification
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
            throw new Error(`Failed to start game: ${gameData.message || 'Unknown error'}`);
        }

        const gameId = gameData.data.game_id;
        console.log(`   ✅ Game started! Game ID: ${gameId}`);
        console.log(`   🤖 ${agentIds.length} agents are now playing automatically`);

        // Step 3: Watch the game
        console.log('\n📋 Step 3: Watching live game...');
        console.log('   (Checking every 5 seconds for 30 seconds)\n');

        for (let i = 0; i < 6; i++) {
            await new Promise(resolve => setTimeout(resolve, 5000));

            const liveResponse = await fetch(`${API_BASE}/agent-autonomous/games/live`);
            const liveData = await liveResponse.json();

            if (liveData.success && liveData.data.length > 0) {
                const game = liveData.data.find(g => g.game_id === gameId);

                if (game) {
                    console.log(`   📊 Turn ${game.current_turn || 0}, Round ${game.round_number || 1}`);
                    if (game.agents_playing) {
                        game.agents_playing.forEach(agent => {
                            console.log(`      ${agent.name}: $${agent.balance}`);
                        });
                    }
                    console.log('');
                } else {
                    console.log(`   ⏸️  Game ${gameId} not in live games (may have ended)`);
                }
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('🎉 GAME STARTED SUCCESSFULLY!\n');
        console.log('✨ Agents are playing autonomously!');
        console.log(`   Game ID: ${gameId}`);
        console.log(`   View live: http://localhost:${process.env.PORT || 3002}/api/agent-autonomous/games/live\n`);

    } catch (error) {
        console.error('\n❌ FAILED!');
        console.error('Error:', error.message);
    }
}

startGameWithExistingAgents();

import axios from 'axios';

const API_BASE = 'http://localhost:3002/api';
const AGENT_ID = 12;

async function watchBattle() {
    console.log('🎮 Watching AI Battle for Agent: BattleChamp\n');

    let gameId = null;
    let lastStatus = null;

    while (true) {
        try {
            // Get agent's active games
            const gamesRes = await axios.get(`${API_BASE}/agents/${AGENT_ID}/games`);
            const games = gamesRes.data.data || [];

            if (games.length === 0) {
                console.log('No games found for agent');
                break;
            }

            const game = games[0];
            gameId = game.id;

            console.log(`\n⏰ ${new Date().toLocaleTimeString()}`);
            console.log(`📊 Game ID: ${gameId}`);
            console.log(`🎯 Status: ${game.status}`);
            console.log(`👥 Players: ${game.joinedPlayers}/${game.numberOfPlayers}`);

            // Get agent's game player info
            const playerRes = await axios.get(`${API_BASE}/games/${gameId}/players`);
            const players = playerRes.data.data || [];

            const agent = players.find(p => p.agentId === AGENT_ID);
            if (agent) {
                console.log(`💰 Agent Balance: ${agent.balance || 'N/A'}`);
                console.log(`📍 Agent Position: ${agent.position || 'N/A'}`);
                console.log(`🏆 Agent Rank: ${agent.rank || 'N/A'}`);
            }

            // Check if game completed
            if (game.status === 'COMPLETED') {
                console.log('\n🎉 GAME COMPLETED!');

                // Get agent stats
                const statsRes = await axios.get(`${API_BASE}/agents/${AGENT_ID}/stats`);
                const stats = statsRes.data.data;

                console.log('\n📈 Final Stats:');
                console.log(`   Total Games: ${stats.totalGames}`);
                console.log(`   Wins: ${stats.wins}`);
                console.log(`   Win Rate: ${stats.winRate}%`);
                console.log(`   Total Revenue: ${stats.totalRevenue}`);

                break;
            }

            lastStatus = game.status;

            // Wait 10 seconds before next check
            await new Promise(resolve => setTimeout(resolve, 10000));

        } catch (error) {
            console.error('Error:', error.message);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

watchBattle().catch(console.error);

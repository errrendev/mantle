/**
 * Create a test game and monitor for completion
 */

const BASE_URL = 'http://localhost:3002';

async function createTestGame() {
    console.log('🎮 Creating Test Game for Completion Tracking\\n');

    // Get agent
    const agentsRes = await fetch(`${BASE_URL}/api/agents`);
    const agentsData = await agentsRes.json();
    const agent = agentsData.data.find(a => a.wallet_address);

    console.log(`Agent: ${agent.name} (ID: ${agent.id})`);
    console.log(`Wallet: ${agent.wallet_address}\\n`);

    // Try to create a game
    console.log('Creating AI game...');
    try {
        const createRes = await fetch(`${BASE_URL}/api/agents/${agent.id}/create-game`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'AlphaAgent',
                gameType: 'PUBLIC',
                playerSymbol: 'car',
                numberOfPlayers: 4,
                code: '',
                startingBalance: '1500',
                stakeAmount: '0',
                isAIGame: true,
            }),
        });

        const createData = await createRes.json();

        if (createData.success) {
            console.log('✅ Game created successfully!');
            console.log(`   TX Hash: ${createData.data.txHash}`);
            console.log('\\n⏳ Game is now running...');
            console.log('   The game monitor will detect completion automatically');
            console.log('   Check every 30 seconds for updates\\n');

            // Monitor for completion
            console.log('📊 Monitoring for completion (checking every 10 seconds)...\\n');

            let completed = false;
            let attempts = 0;
            const maxAttempts = 30; // 5 minutes max

            while (!completed && attempts < maxAttempts) {
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds

                // Check active games
                const gamesRes = await fetch(`${BASE_URL}/api/gameplay/agents/${agent.id}/active-games`);
                const gamesData = await gamesRes.json();

                // Check stats
                const statsRes = await fetch(`${BASE_URL}/api/gameplay/agents/${agent.id}/stats`);
                const statsData = await statsRes.json();

                console.log(`[${attempts}] Active games: ${gamesData.data.length}, Completed: ${statsData.data.completedGames}`);

                if (statsData.data.completedGames > 0) {
                    completed = true;
                    console.log('\\n🎉 GAME COMPLETED!\\n');

                    // Get final stats
                    console.log('📊 Final Statistics:');
                    console.log(`   Total games: ${statsData.data.totalGames}`);
                    console.log(`   Wins: ${statsData.data.wins}`);
                    console.log(`   Win rate: ${statsData.data.winRate}%`);
                    console.log(`   Total winnings: ${statsData.data.totalWinnings}`);

                    // Get completion decision
                    const decisionsRes = await fetch(`${BASE_URL}/api/gameplay/agents/${agent.id}/decisions?limit=1`);
                    const decisionsData = await decisionsRes.json();

                    if (decisionsData.data.length > 0) {
                        const decision = decisionsData.data[0];
                        const data = JSON.parse(decision.decision_data);
                        console.log('\\n🏆 Completion Details:');
                        console.log(`   Rank: ${data.rank}`);
                        console.log(`   Winnings: ${data.winnings}`);
                        console.log(`   Final Balance: ${data.finalBalance}`);
                        console.log(`   Reasoning: ${decision.reasoning}`);
                    }
                }
            }

            if (!completed) {
                console.log('\\n⏰ Timeout - game still running after 5 minutes');
                console.log('   Check back later or view server logs');
            }

        } else {
            console.error('❌ Failed to create game:', createData.message);
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

createTestGame().catch(console.error);

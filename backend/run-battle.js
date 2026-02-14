/**
 * Run Agent Battle - Use existing funded wallet
 */

const BASE_URL = 'http://localhost:3002';

async function runBattle() {
    console.log('🤖 AGENT BATTLE\\n');
    console.log('═══════════════════════════════════════\\n');

    // Get agent
    const agentsRes = await fetch(`${BASE_URL}/api/agents`);
    const agentsData = await agentsRes.json();
    const agent = agentsData.data.find(a => a.id === 9); // AlphaBot

    console.log(`Agent: ${agent.name} (ID: ${agent.id})`);
    console.log(`Wallet: ${agent.wallet_address}`);
    console.log(`Current Balance: 0.1 MON\\n`);

    // Create game
    console.log('🎮 Creating AI battle game (4 players)...');
    const gameRes = await fetch(`${BASE_URL}/api/agents/${agent.id}/create-game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'AlphaAgent', // Use registered username
            gameType: 'PUBLIC',
            playerSymbol: 'car',
            numberOfPlayers: 4,
            code: '',
            startingBalance: '1500',
            stakeAmount: '0',
            isAIGame: true,
        }),
    });
    const gameData = await gameRes.json();

    if (!gameData.success) {
        console.error('❌ Failed:', gameData.message);
        return;
    }

    console.log(`✅ Game created! TX: ${gameData.data.txHash}\\n`);
    console.log('═══════════════════════════════════════\\n');
    console.log('🎮 GAME IN PROGRESS!\\n');
    console.log('Monitoring every 10 seconds...\\n');

    // Monitor game
    let complete = false;
    let checkNum = 0;

    while (!complete && checkNum < 60) {
        checkNum++;
        await new Promise(resolve => setTimeout(resolve, 10000));

        const gamesRes = await fetch(`${BASE_URL}/api/gameplay/agents/${agent.id}/active-games`);
        const games = await gamesRes.json();

        const statsRes = await fetch(`${BASE_URL}/api/gameplay/agents/${agent.id}/stats`);
        const stats = await statsRes.json();

        console.log(`[${checkNum}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        if (games.data.length > 0) {
            const game = games.data[0];
            console.log(`   🎮 Game Status: ${game.status.toUpperCase()}`);
            console.log(`   💰 Balance: ${game.balance || 'Loading...'}`);
            console.log(`   📍 Position: ${game.position || 0}`);

            if (game.status === 'active') {
                console.log('   🔥 Agent is playing!');
            }
        } else {
            console.log('   ⏳ Waiting for game to start...');
        }

        console.log(`   📊 Completed: ${stats.data.completedGames} games`);

        if (stats.data.completedGames > 0) {
            complete = true;
            console.log('\\n═══════════════════════════════════════');
            console.log('🏁 GAME COMPLETE! 🏁');
            console.log('═══════════════════════════════════════\\n');

            console.log('📊 FINAL STATISTICS:\\n');
            console.log(`   Total Games Played: ${stats.data.totalGames}`);
            console.log(`   Wins: ${stats.data.wins}`);
            console.log(`   Win Rate: ${stats.data.winRate}%`);
            console.log(`   Total Winnings: ${stats.data.totalWinnings} MON\\n`);

            // Get completion details
            const decRes = await fetch(`${BASE_URL}/api/gameplay/agents/${agent.id}/decisions?limit=1`);
            const dec = await decRes.json();

            if (dec.data.length > 0) {
                const decision = dec.data[0];
                const data = JSON.parse(decision.decision_data);

                console.log('═══════════════════════════════════════');
                console.log('🏆 BATTLE RESULTS');
                console.log('═══════════════════════════════════════\\n');
                console.log(`   Final Rank: ${data.rank}${data.rank === 1 ? 'st' : data.rank === 2 ? 'nd' : data.rank === 3 ? 'rd' : 'th'} Place`);
                console.log(`   Final Balance: ${data.finalBalance} MON`);
                console.log(`   Winnings: ${data.winnings} MON\\n`);

                if (data.rank === 1) {
                    console.log('🎉🎉🎉 VICTORY! 🎉🎉🎉');
                    console.log('AlphaBot dominated the competition!');
                } else if (data.rank === 2) {
                    console.log('🥈 Second Place!');
                    console.log('Close battle! AlphaBot fought well!');
                } else if (data.rank === 3) {
                    console.log('🥉 Third Place');
                    console.log('Good effort! Room for improvement.');
                } else {
                    console.log('📊 Fourth Place');
                    console.log('Better luck next time!');
                }
            }
        }

        console.log('');
    }

    if (!complete) {
        console.log('⏰ Game still running after 10 minutes.');
        console.log('The backend will continue running the game.');
        console.log('Check back later with: curl http://localhost:3002/api/gameplay/agents/9/stats');
    }
}

runBattle().catch(console.error);

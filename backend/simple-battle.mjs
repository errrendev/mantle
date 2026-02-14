/**
 * Simple Agent Battle - Fund existing agent and create game
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const BASE_URL = 'http://localhost:3002';

// Source wallet with 9 MON
const SOURCE_WALLET = '0x85287B91121906771d4D9391A696a20aB0940C90';
const SOURCE_KEY = '0x9a6f8a97f897736e0c80942c54336165bb94df23975e9848f34da0eeccf324b8';

async function runBattle() {
    console.log('🤖 AGENT BATTLE SETUP\\n');
    console.log('═══════════════════════════════════════\\n');

    // Get existing agent with wallet
    console.log('1️⃣  Finding agent with wallet...');
    const agentsRes = await fetch(`${BASE_URL}/api/agents`);
    const agentsData = await agentsRes.json();

    let agent = agentsData.data.find(a => a.wallet_address);

    if (!agent) {
        console.log('   No agent with wallet found. Creating new one...');
        const createRes = await fetch(`${BASE_URL}/api/agents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'BattleBot',
                personality: 'Competitive',
                owner_address: SOURCE_WALLET,
                createWallet: true,
            }),
        });
        const createData = await createRes.json();
        agent = createData.data || createData;
    }

    console.log(`   ✅ Agent: ${agent.name} (ID: ${agent.id})`);
    console.log(`   📍 Wallet: ${agent.wallet_address}\\n`);

    // Fund the agent
    console.log('2️⃣  Funding agent with 4 MON...');
    try {
        const { stdout } = await execAsync(
            `cast send ${agent.wallet_address} --value 4ether --rpc-url https://testnet-rpc.monad.xyz --private-key ${SOURCE_KEY}`
        );
        console.log('   ✅ Funded!\\n');
    } catch (error) {
        console.log('   ⚠️  Funding command:', error.message);
        console.log('   Run manually:\\n');
        console.log(`   cast send ${agent.wallet_address} --value 4ether --rpc-url https://testnet-rpc.monad.xyz --private-key ${SOURCE_KEY}\\n`);
        return;
    }

    // Wait for confirmation
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check balance
    console.log('3️⃣  Checking balance...');
    const { stdout: balance } = await execAsync(
        `cast balance ${agent.wallet_address} --rpc-url https://testnet-rpc.monad.xyz`
    );
    console.log(`   💰 Balance: ${parseInt(balance) / 1e18} MON\\n`);

    // Register if not registered
    console.log('4️⃣  Registering agent on-chain...');
    try {
        const regRes = await fetch(`${BASE_URL}/api/agents/${agent.id}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'BattleBot' }),
        });
        const regData = await regRes.json();
        if (regData.success) {
            console.log(`   ✅ Registered! TX: ${regData.data.txHash}\\n`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
            console.log(`   ℹ️  ${regData.message}\\n`);
        }
    } catch (error) {
        console.log('   ℹ️  Already registered or error\\n');
    }

    // Create game
    console.log('5️⃣  Creating AI battle game...');
    const gameRes = await fetch(`${BASE_URL}/api/agents/${agent.id}/create-game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: 'BattleBot',
            gameType: 'PUBLIC',
            playerSymbol: 'car',
            numberOfPlayers: 4, // 4 AI players
            code: '',
            startingBalance: '1500',
            stakeAmount: '0',
            isAIGame: true,
        }),
    });
    const gameData = await gameRes.json();

    if (!gameData.success) {
        console.error('   ❌ Failed:', gameData.message);
        return;
    }

    console.log(`   ✅ Game created! TX: ${gameData.data.txHash}\\n`);
    console.log('═══════════════════════════════════════\\n');
    console.log('🎮 GAME STARTED! Monitoring progress...\\n');

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

        console.log(`[Check ${checkNum}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        if (games.data.length > 0) {
            const game = games.data[0];
            console.log(`   🎮 Status: ${game.status}`);
            console.log(`   💰 Balance: ${game.balance || 'N/A'}`);
            console.log(`   📍 Position: ${game.position || 0}`);
        }

        console.log(`   📊 Completed Games: ${stats.data.completedGames}`);

        if (stats.data.completedGames > 0) {
            complete = true;
            console.log('\\n🏁 GAME COMPLETE! 🏁\\n');
            console.log('═══════════════════════════════════════\\n');
            console.log('📊 FINAL RESULTS:\\n');
            console.log(`   Total Games: ${stats.data.totalGames}`);
            console.log(`   Wins: ${stats.data.wins}`);
            console.log(`   Win Rate: ${stats.data.winRate}%`);
            console.log(`   Total Winnings: ${stats.data.totalWinnings}\\n`);

            // Get completion details
            const decRes = await fetch(`${BASE_URL}/api/gameplay/agents/${agent.id}/decisions?limit=1`);
            const dec = await decRes.json();

            if (dec.data.length > 0) {
                const decision = dec.data[0];
                const data = JSON.parse(decision.decision_data);
                console.log('🏆 Game Details:');
                console.log(`   Final Rank: ${data.rank}`);
                console.log(`   Final Balance: ${data.finalBalance}`);
                console.log(`   Winnings: ${data.winnings}\\n`);

                if (data.rank === 1) {
                    console.log('🎉 VICTORY! Agent won the game! 🎉');
                } else {
                    console.log(`📊 Agent finished in ${data.rank}${data.rank === 2 ? 'nd' : data.rank === 3 ? 'rd' : 'th'} place`);
                }
            }
        }

        console.log('');
    }

    if (!complete) {
        console.log('⏰ Game still running after 10 minutes. Check back later!');
    }
}

runBattle().catch(console.error);

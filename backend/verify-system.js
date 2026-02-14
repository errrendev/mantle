import db from './config/database.js';
import { createPublicClient, http, formatEther } from 'viem';
import 'dotenv/config';

async function verifySystem() {
    console.log('🔍 System Verification Report\n');

    try {
        // 1. Check Database Connection
        console.log('1️⃣  Database Connection:');
        try {
            await db.raw('SELECT 1');
            console.log('   ✅ Connected');
        } catch (err) {
            console.error('   ❌ Failed:', err.message);
        }

        // 2. Check Agents & Wallet Balances
        console.log('\n2️⃣  Agent Status:');
        const agents = await db('agents').whereIn('id', [12, 13]).select('id', 'name', 'wallet_address');

        const client = createPublicClient({
            chain: {
                id: 10143,
                name: 'Monad Testnet',
                network: 'monad-testnet',
                nativeCurrency: { decimals: 18, name: 'Monad', symbol: 'MON' },
                rpcUrls: { default: { http: [process.env.MONAD_RPC_URL] } },
            },
            transport: http(),
        });

        for (const agent of agents) {
            try {
                const balance = await client.getBalance({ address: agent.wallet_address });
                console.log(`   👤 ${agent.name} (${agent.id}):`);
                console.log(`      Address: ${agent.wallet_address}`);
                console.log(`      Balance: ${formatEther(balance)} MON`);
                if (balance < 1000000000000000n) { // 0.001 MON
                    console.log('      ⚠️  LOW BALANCE');
                } else {
                    console.log('      ✅ Balance OK');
                }
            } catch (err) {
                console.log(`      ❌ Error checking balance: ${err.message}`);
            }
        }

        // 3. Check Active Games
        console.log('\n3️⃣  Active Games:');
        const activeGames = await db('games')
            .whereIn('status', ['WAITING', 'RUNNING'])
            .orderBy('created_at', 'desc')
            .limit(5);

        if (activeGames.length === 0) {
            console.log('   ℹ️  No active games found');
        } else {
            activeGames.forEach(game => {
                console.log(`   🎮 Game ${game.code} (ID: ${game.id})`);
                console.log(`      Status: ${game.status}`);
                console.log(`      Players: ${game.joined_players}/${game.number_of_players}`);
                console.log(`      Mode: ${game.mode}`);
            });
        }

        // 4. Check Agent Decisions (Monitor Liveness)
        console.log('\n4️⃣  Monitor Liveness (Recent Decisions):');
        const recentDecisions = await db('agent_decisions')
            .orderBy('created_at', 'desc')
            .limit(3);

        if (recentDecisions.length === 0) {
            console.log('   ⚠️  No decisions logged recently');
        } else {
            recentDecisions.forEach(d => {
                console.log(`   📝 ${d.decision_type} (Agent ${d.agent_id}) - ${new Date(d.created_at).toISOString()}`);
            });
            console.log('   ✅ Decisions are being logged');
        }

        // 5. Check Games Table Sync
        console.log('\n5️⃣  Game Data Sync:');
        const gamesCount = await db('games').count('id as count').first();
        console.log(`   📚 Total Games Synced: ${gamesCount.count}`);

        console.log('\n✅ Verification Complete');

    } catch (err) {
        console.error('\n❌ Verification Failed:', err);
    } finally {
        process.exit(0);
    }
}

verifySystem();

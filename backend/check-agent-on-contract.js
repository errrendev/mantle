import { createPublicClient, http } from 'viem';
import { TYCOON_ABI } from './config/tycoonAbi.js';
import dotenv from 'dotenv';

dotenv.config();

const monadTestnet = {
    id: 10143,
    name: 'Monad Testnet',
    rpcUrls: {
        default: { http: [process.env.MONAD_RPC_URL] },
    },
};

const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(process.env.MONAD_RPC_URL),
});

async function checkAgent() {
    const agentName = 'TestAgent_1770980359115';
    const tycoonAddress = process.env.TYCOON_CONTRACT_ADDRESS;

    console.log('\n🔍 Checking Agent Registration on Tycoon Contract\n');
    console.log('Agent Name:', agentName);
    console.log('Tycoon Contract:', tycoonAddress);
    console.log('='.repeat(60));

    try {
        const user = await publicClient.readContract({
            address: tycoonAddress,
            abi: TYCOON_ABI,
            functionName: 'getUser',
            args: [agentName],
        });

        console.log('\n✅ Agent Found on Contract:');
        console.log('   ID:', user.id.toString());
        console.log('   Username:', user.username);
        console.log('   Address:', user.playerAddress);
        console.log('   Registered At:', new Date(Number(user.registeredAt) * 1000).toISOString());
        console.log('   Games Played:', user.gamesPlayed.toString());
        console.log('   Games Won:', user.gamesWon.toString());
        console.log('   Total Staked:', user.totalStaked.toString());
        console.log('   Total Earned:', user.totalEarned.toString());

    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

checkAgent();

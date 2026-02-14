import { createPublicClient, http } from 'viem';
import db from './config/database.js';

const monadTestnet = {
    id: 10143,
    name: 'Monad Testnet',
    network: 'monad-testnet',
    nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
    rpcUrls: {
        default: { http: [process.env.MONAD_RPC_URL] },
        public: { http: [process.env.MONAD_RPC_URL] }
    }
};

const TYCOON_CONTRACT = process.env.TYCOON_CONTRACT_ADDRESS;

async function syncAllGames() {
    console.log('🔄 Syncing all games from blockchain to database...\n');

    const publicClient = createPublicClient({
        chain: monadTestnet,
        transport: http(process.env.MONAD_RPC_URL)
    });

    // Get total games from contract
    const totalGames = await publicClient.readContract({
        address: TYCOON_CONTRACT,
        abi: [{
            name: 'totalGames',
            type: 'function',
            stateMutability: 'view',
            inputs: [],
            outputs: [{ type: 'uint256' }]
        }],
        functionName: 'totalGames'
    });

    console.log(`📊 Total games on blockchain: ${totalGames}`);

    // Fetch each game
    for (let i = 1; i <= Number(totalGames); i++) {
        try {
            const game = await publicClient.readContract({
                address: TYCOON_CONTRACT,
                abi: [{
                    name: 'games',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [{ type: 'uint256' }],
                    outputs: [{
                        type: 'tuple',
                        components: [
                            { name: 'id', type: 'uint256' },
                            { name: 'code', type: 'string' },
                            { name: 'creator', type: 'address' },
                            { name: 'status', type: 'uint8' },
                            { name: 'winner', type: 'address' },
                            { name: 'numberOfPlayers', type: 'uint8' },
                            { name: 'joinedPlayers', type: 'uint8' },
                            { name: 'mode', type: 'uint8' },
                            { name: 'ai', type: 'bool' },
                            { name: 'stakePerPlayer', type: 'uint256' },
                            { name: 'totalStaked', type: 'uint256' },
                            { name: 'createdAt', type: 'uint64' },
                            { name: 'endedAt', type: 'uint64' }
                        ]
                    }]
                }],
                functionName: 'games',
                args: [BigInt(i)]
            });

            console.log(`\nGame ${i}:`);
            console.log(`  Code: ${game.code}`);
            console.log(`  Creator: ${game.creator}`);
            console.log(`  Status: ${game.status} (0=Waiting, 1=Running, 2=Completed)`);
            console.log(`  AI Game: ${game.ai}`);
            console.log(`  Players: ${game.joinedPlayers}/${game.numberOfPlayers}`);

        } catch (error) {
            console.error(`Error fetching game ${i}:`, error.message);
        }
    }

    // Count agents
    const agents = await db('agents').count('* as count');
    console.log(`\n👥 Total agents in database: ${agents[0].count}`);

    // Count games in DB
    const dbGames = await db('agent_games').count('* as count');
    console.log(`🎮 Total games in database: ${dbGames[0].count}`);
}

syncAllGames()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });

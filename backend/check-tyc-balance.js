import { createPublicClient, http } from 'viem';
import dotenv from 'dotenv';

dotenv.config();

const ERC20_ABI = [
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'decimals',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint8' }],
    },
];

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

async function checkBalance() {
    const agentAddress = '0x785924F954d020d3238d99efA7Da7380D681519D';
    const tycTokenAddress = process.env.TYC_TOKEN_ADDRESS;

    console.log('\n🔍 Checking TYC Token Balance\n');
    console.log('Agent Wallet:', agentAddress);
    console.log('TYC Token:', tycTokenAddress);
    console.log('='.repeat(60));

    try {
        // Get TYC balance
        const balance = await publicClient.readContract({
            address: tycTokenAddress,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [agentAddress],
        });

        // Get decimals
        const decimals = await publicClient.readContract({
            address: tycTokenAddress,
            abi: ERC20_ABI,
            functionName: 'decimals',
        });

        const balanceFormatted = Number(balance) / Math.pow(10, Number(decimals));

        console.log('\n✅ Balance Retrieved:');
        console.log(`   Raw: ${balance.toString()}`);
        console.log(`   Decimals: ${decimals}`);
        console.log(`   Formatted: ${balanceFormatted} TYC`);

        if (balanceFormatted > 0) {
            console.log('\n�� Agent HAS TYC tokens!');
        } else {
            console.log('\n⚠️  Agent has 0 TYC tokens');
            console.log('   Note: Registration gives vouchers that need to be redeemed');
        }
    } catch (error) {
        console.error('\n❌ Error:', error.message);
    }
}

checkBalance();

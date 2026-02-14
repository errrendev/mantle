import { createPublicClient, http, formatEther } from 'viem';
import 'dotenv/config';

async function checkBalance() {
    try {
        const monadTestnet = {
            id: 10143,
            name: 'Monad Testnet',
            network: 'monad-testnet',
            nativeCurrency: { decimals: 18, name: 'Monad', symbol: 'MON' },
            rpcUrls: { default: { http: [process.env.MONAD_RPC_URL] } },
        };

        const client = createPublicClient({
            chain: monadTestnet,
            transport: http(),
        });

        const address = '0xDd4607ffdFC818b1fd4396788e6E10406754Aa53';
        const balance = await client.getBalance({ address });

        console.log(`Address: ${address}`);
        console.log(`Balance: ${formatEther(balance)} MON`);

    } catch (err) {
        console.error('Error checking balance:', err);
    }
}

checkBalance();

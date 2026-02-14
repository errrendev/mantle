import 'dotenv/config';
import { createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { decryptPrivateKey } from './utils/encryption.js';
import db from './config/database.js';

async function fundAgent() {
    try {
        const monadTestnet = {
            id: 10143,
            name: 'Monad Testnet',
            network: 'monad-testnet',
            nativeCurrency: { decimals: 18, name: 'Monad', symbol: 'MON' },
            rpcUrls: { default: { http: [process.env.MONAD_RPC_URL] } },
        };

        // Source: Challenger (ID 13)
        const sourceId = 13;
        const sourceAgent = await db('agents').where({ id: sourceId }).first();
        if (!sourceAgent) throw new Error('Source agent not found');

        const sourceKey = decryptPrivateKey(sourceAgent.private_key_encrypted);
        const sourceAccount = privateKeyToAccount(sourceKey);

        const client = createWalletClient({
            account: sourceAccount,
            chain: monadTestnet,
            transport: http(),
        });

        // Destination: BattleChamp (ID 12)
        const destId = 12;
        const destAgent = await db('agents').where({ id: destId }).first();
        if (!destAgent) throw new Error('Dest agent not found');

        const amount = '0.5';
        console.log(`Sending ${amount} MON from ${sourceAgent.name} to ${destAgent.name}...`);

        const hash = await client.sendTransaction({
            to: destAgent.wallet_address,
            value: parseEther(amount),
        });

        console.log(`Transaction sent: ${hash}`);

    } catch (err) {
        console.error('Error funding agent:', err);
    } finally {
        process.exit(0);
    }
}

fundAgent();

import dotenv from 'dotenv';
dotenv.config();

import { decryptPrivateKey } from './utils/encryption.js';
import db from './config/database.js';

async function getAgentPrivateKey() {
    const agent = await db('agents').where({ id: 9 }).first();

    if (!agent || !agent.private_key_encrypted) {
        console.log('❌ Agent not found or has no wallet');
        process.exit(1);
    }

    const privateKey = decryptPrivateKey(agent.private_key_encrypted);

    console.log('Agent:', agent.name);
    console.log('Wallet:', agent.wallet_address);
    console.log('Private Key:', privateKey);
    console.log('');
    console.log('Use this to register:');
    console.log(`cast send 0xd004fddd377e9eb6e37d61904af98c86f6522f0b \\`);
    console.log(`  "registerPlayer(string)" \\`);
    console.log(`  "${agent.name}" \\`);
    console.log(`  --private-key ${privateKey} \\`);
    console.log(`  --rpc-url https://testnet-rpc.monad.xyz \\`);
    console.log(`  --legacy`);

    process.exit(0);
}

getAgentPrivateKey();

import dotenv from 'dotenv';
dotenv.config();

import { decryptPrivateKey } from './utils/encryption.js';
import { privateKeyToAccount } from 'viem/accounts';
import db from './config/database.js';

async function debugAgentWallet() {
    const agent = await db('agents').where({ id: 9 }).first();

    console.log('Agent Info:');
    console.log('  ID:', agent.id);
    console.log('  Name:', agent.name);
    console.log('  Wallet Address (DB):', agent.wallet_address);
    console.log('');

    // Decrypt private key
    const privateKey = decryptPrivateKey(agent.private_key_encrypted);
    console.log('Decrypted Private Key:', privateKey);
    console.log('');

    // Derive address from private key
    const account = privateKeyToAccount(privateKey);
    console.log('Derived Address:', account.address);
    console.log('');

    console.log('Match:', agent.wallet_address.toLowerCase() === account.address.toLowerCase() ? '✅ YES' : '❌ NO');

    process.exit(0);
}

debugAgentWallet();

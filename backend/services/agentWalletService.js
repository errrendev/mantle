import crypto from 'crypto';
import { privateKeyToAccount } from 'viem/accounts';
import { encryptPrivateKey } from '../utils/encryption.js';
import Agent from '../models/Agent.js';

/**
 * Agent Wallet Service
 * Handles wallet generation, funding, and on-chain registration for agents
 */

// Constants
const TYCOON_CONTRACT = process.env.TYCOON_CONTRACT_ADDRESS;
const TYC_TOKEN = process.env.TYC_TOKEN_ADDRESS;
const MONAD_RPC_URL = process.env.MONAD_RPC_URL;
const TREASURY_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY;

// Initial gas funding: 0.05 ETH (increased to cover registration tx)
const INITIAL_GAS_FUNDING = BigInt(50000000000000000); // 0.05 ETH in wei

/**
 * Generate a new wallet for an agent
 * @returns {Object} { privateKey, address }
 */
export function generateWallet() {
    // Generate random 32-byte private key
    const privateKeyBytes = crypto.randomBytes(32);
    const privateKey = '0x' + privateKeyBytes.toString('hex');

    // Properly derive Ethereum address from private key using viem
    const account = privateKeyToAccount(privateKey);
    const address = account.address;

    return { privateKey, address };
}

/**
 * Fund agent wallet with ETH for gas fees
 * @param {string} agentAddress - Agent's wallet address
 * @param {BigInt} amount - Amount of ETH in wei
 */
export async function fundAgentWallet(agentAddress, amount = INITIAL_GAS_FUNDING) {
    try {
        console.log(`[WALLET SERVICE] Funding ${agentAddress} with ${amount} wei from treasury...`);

        if (!TREASURY_PRIVATE_KEY) {
            console.warn('[WALLET SERVICE] ⚠️ TREASURY_PRIVATE_KEY not configured. Skipping funding.');
            return { success: false, skipped: true, message: 'Treasury not configured' };
        }

        const { createWalletClient, createPublicClient, http } = await import('viem');
        const { privateKeyToAccount } = await import('viem/accounts');

        // Chain configuration for Monad Testnet
        const monadTestnet = {
            id: 10143,
            name: 'Monad Testnet',
            network: 'monad-testnet',
            nativeCurrency: {
                decimals: 18,
                name: 'Monad',
                symbol: 'MON',
            },
            rpcUrls: {
                default: { http: [MONAD_RPC_URL] },
                public: { http: [MONAD_RPC_URL] },
            },
        };

        // Create treasury account
        const treasuryAccount = privateKeyToAccount(TREASURY_PRIVATE_KEY);

        // Create wallet client
        const walletClient = createWalletClient({
            account: treasuryAccount,
            chain: monadTestnet,
            transport: http(MONAD_RPC_URL),
        });

        // Create public client
        const publicClient = createPublicClient({
            chain: monadTestnet,
            transport: http(MONAD_RPC_URL),
        });

        // Send ETH to agent wallet
        const txHash = await walletClient.sendTransaction({
            to: agentAddress,
            value: amount,
        });

        console.log(`[WALLET SERVICE] Funding tx submitted: ${txHash}`);

        // Wait for confirmation
        const receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash,
            confirmations: 1
        });

        if (receipt.status === 'success') {
            console.log(`[WALLET SERVICE] ✅ Funded ${agentAddress} with ${amount} wei (${Number(amount) / 1e18} ETH)`);
        } else {
            throw new Error('Funding transaction failed');
        }

        return {
            success: true,
            txHash,
            amount: amount.toString(),
            amountEth: (Number(amount) / 1e18).toString()
        };
    } catch (error) {
        console.error('[WALLET SERVICE] Error funding wallet:', error);
        throw new Error(`Failed to fund agent wallet: ${error.message}`);
    }
}

/**
 * Register agent on-chain to receive TYC bonus
 * @param {string} agentName - Agent's username
 * @param {string} privateKey - Agent's private key
 * @returns {Object} { success, txHash }
 */
export async function registerAgentOnChain(agentName, privateKey) {
    try {
        console.log(`[WALLET SERVICE] Registering ${agentName} on-chain...`);

        const { createWalletClient, createPublicClient, http } = await import('viem');
        const { privateKeyToAccount } = await import('viem/accounts');
        const { TYCOON_ABI } = await import('../config/tycoonAbi.js');

        // Chain configuration for Monad Testnet
        const monadTestnet = {
            id: 10143,
            name: 'Monad Testnet',
            network: 'monad-testnet',
            nativeCurrency: {
                decimals: 18,
                name: 'Monad',
                symbol: 'MON',
            },
            rpcUrls: {
                default: { http: [MONAD_RPC_URL] },
                public: { http: [MONAD_RPC_URL] },
            },
        };

        // Create account from private key
        const account = privateKeyToAccount(privateKey);

        // Create wallet client
        const walletClient = createWalletClient({
            account,
            chain: monadTestnet,
            transport: http(MONAD_RPC_URL),
        });

        // Create public client for reading
        const publicClient = createPublicClient({
            chain: monadTestnet,
            transport: http(MONAD_RPC_URL),
        });

        console.log(`[WALLET SERVICE] Calling Tycoon.registerPlayer("${agentName}")...`);

        // Call Tycoon.registerPlayer(agentName)
        const txHash = await walletClient.writeContract({
            address: TYCOON_CONTRACT,
            abi: TYCOON_ABI,
            functionName: 'registerPlayer',
            args: [agentName],
        });

        console.log(`[WALLET SERVICE] Registration tx submitted: ${txHash}`);
        console.log(`[WALLET SERVICE] Waiting for confirmation...`);

        // Wait for transaction confirmation
        const receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash,
            confirmations: 1
        });

        if (receipt.status === 'success') {
            console.log(`[WALLET SERVICE] ✅ ${agentName} registered on-chain successfully!`);
            console.log(`[WALLET SERVICE] Agent received 2 TYC vouchers (redeemable for tokens)`);
        } else {
            throw new Error('Transaction failed');
        }

        return {
            success: true,
            txHash,
            blockNumber: receipt.blockNumber.toString(),
            message: 'Agent registered on-chain and received 2 TYC vouchers'
        };
    } catch (error) {
        console.error('[WALLET SERVICE] Error registering on-chain:', error);
        throw new Error(`Failed to register agent on-chain: ${error.message}`);
    }
}

/**
 * Create agent with wallet and on-chain registration
 * @param {Object} agentData - Agent creation data
 * @returns {Object} Created agent with wallet info
 */
export async function createAgentWithWallet(agentData) {
    try {
        const { name, owner_address, owner_email, strategy, risk_profile, config } = agentData;

        // Step 1: Generate wallet
        console.log(`[WALLET SERVICE] Generating wallet for ${name}...`);
        const wallet = generateWallet();

        // Step 2: Encrypt private key
        const encryptedKey = encryptPrivateKey(wallet.privateKey);

        // Step 3: Fund wallet with gas
        console.log(`[WALLET SERVICE] Funding wallet with gas...`);
        await fundAgentWallet(wallet.address, INITIAL_GAS_FUNDING);

        // Step 4: Register on-chain
        console.log(`[WALLET SERVICE] Registering on-chain...`);
        const registration = await registerAgentOnChain(name, wallet.privateKey);

        // Step 5: Create agent in database
        const agent = await Agent.create({
            name,
            address: wallet.address, // This is now the blockchain wallet address
            owner_address,
            owner_email,
            strategy: strategy || 'balanced',
            risk_profile: risk_profile || strategy || 'balanced',
            config: typeof config === 'string' ? config : JSON.stringify(config || {}),
            wallet_address: wallet.address,
            private_key_encrypted: encryptedKey,
            eth_balance: '0.01', // Initial funding
            tyc_balance: '2.0', // 2 TYC from registration
            usdc_balance: '0',
            registered_onchain: true,
            registered_onchain_at: new Date(),
            last_balance_sync: new Date()
        });

        console.log(`[WALLET SERVICE] ✅ Agent ${name} created successfully with wallet ${wallet.address}`);

        return {
            ...agent,
            registration_tx: registration.txHash,
            initial_tyc_bonus: '2.0'
        };
    } catch (error) {
        console.error('[WALLET SERVICE] Error creating agent with wallet:', error);
        throw error;
    }
}

/**
 * Get agent's current balances from blockchain
 * @param {number} agentId - Agent ID
 * @returns {Object} { eth, tyc, usdc }
 */
export async function syncAgentBalances(agentId) {
    try {
        const agent = await Agent.findById(agentId);
        if (!agent || !agent.wallet_address) {
            throw new Error('Agent not found or has no wallet');
        }

        // TODO: Implement actual balance fetching from blockchain
        // This would use viem to read balances

        const balances = {
            eth: '0.01',
            tyc: '2.0',
            usdc: '0'
        };

        // Update database
        await Agent.update(agentId, {
            eth_balance: balances.eth,
            tyc_balance: balances.tyc,
            usdc_balance: balances.usdc,
            last_balance_sync: new Date()
        });

        return balances;
    } catch (error) {
        console.error('[WALLET SERVICE] Error syncing balances:', error);
        throw error;
    }
}

export default {
    generateWallet,
    fundAgentWallet,
    registerAgentOnChain,
    createAgentWithWallet,
    syncAgentBalances
};

import { createWalletClient, createPublicClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { decryptPrivateKey } from '../utils/encryption.js';
import db from '../config/database.js';

// Chain configuration for Monad Testnet
const monadTestnet = {
    id: 10143, // Monad Testnet chain ID
    name: 'Monad Testnet',
    network: 'monad-testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'Monad',
        symbol: 'MON',
    },
    rpcUrls: {
        default: { http: [process.env.MONAD_RPC_URL] },
        public: { http: [process.env.MONAD_RPC_URL] },
    },
};

// Contract addresses
const TYCOON_ADDRESS = process.env.TYCOON_CONTRACT_ADDRESS;
const TYC_TOKEN_ADDRESS = process.env.TYC_TOKEN_ADDRESS;
const USDC_TOKEN_ADDRESS = process.env.USDC_TOKEN_ADDRESS;

// ERC20 ABI for approve function
const ERC20_ABI = [
    {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
    {
        name: 'allowance',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
    },
];

// Tycoon contract ABI (minimal for our needs)
const TYCOON_ABI = [
    {
        name: 'createGame',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'creatorUsername', type: 'string' },
            { name: 'gameType', type: 'string' },
            { name: 'playerSymbol', type: 'string' },
            { name: 'numberOfPlayers', type: 'uint8' },
            { name: 'code', type: 'string' },
            { name: 'startingBalance', type: 'uint256' },
            { name: 'stakeAmount', type: 'uint256' },
        ],
        outputs: [{ name: 'gameId', type: 'uint256' }],
    },
    {
        name: 'createAIGame',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'creatorUsername', type: 'string' },
            { name: 'gameType', type: 'string' },
            { name: 'playerSymbol', type: 'string' },
            { name: 'numberOfAI', type: 'uint8' },
            { name: 'code', type: 'string' },
            { name: 'startingBalance', type: 'uint256' },
        ],
        outputs: [{ name: 'gameId', type: 'uint256' }],
    },
    {
        name: 'joinGame',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'gameId', type: 'uint256' },
            { name: 'playerUsername', type: 'string' },
            { name: 'playerSymbol', type: 'string' },
            { name: 'joinCode', type: 'string' },
        ],
        outputs: [{ name: 'order', type: 'uint8' }],
    },
];

/**
 * Load agent wallet from database and create wallet client
 */
async function loadAgentWallet(agentId) {
    const agent = await db('agents')
        .where({ id: agentId })
        .first();

    if (!agent) {
        throw new Error('Agent not found');
    }

    if (!agent.private_key_encrypted) {
        throw new Error('Agent does not have a wallet');
    }

    // Decrypt private key
    const privateKey = decryptPrivateKey(agent.private_key_encrypted);

    // Create account from private key
    const account = privateKeyToAccount(privateKey);

    // Create wallet client
    const walletClient = createWalletClient({
        account,
        chain: monadTestnet,
        transport: http(process.env.MONAD_RPC_URL),
    });

    // Create public client for reading
    const publicClient = createPublicClient({
        chain: monadTestnet,
        transport: http(process.env.MONAD_RPC_URL),
    });

    return {
        agent,
        account,
        walletClient,
        publicClient,
    };
}

/**
 * Approve token spending for an agent
 * @param {number} agentId - Agent ID
 * @param {string} tokenType - 'TYC' or 'USDC'
 * @param {string} amount - Amount to approve (in token units)
 * @returns {Promise<{txHash: string, success: boolean}>}
 */
export async function approveTokenForAgent(agentId, tokenType, amount) {
    const { agent, walletClient, publicClient } = await loadAgentWallet(agentId);

    // Determine token address
    const tokenAddress = tokenType === 'TYC' ? TYC_TOKEN_ADDRESS : USDC_TOKEN_ADDRESS;

    if (!tokenAddress) {
        throw new Error(`${tokenType} token address not configured`);
    }

    // Parse amount to wei (18 decimals)
    const amountWei = parseUnits(amount.toString(), 18);

    // Check current allowance
    const currentAllowance = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [agent.wallet_address, TYCOON_ADDRESS],
    });

    console.log(`Current ${tokenType} allowance for agent ${agent.name}:`, currentAllowance.toString());

    // If allowance is already sufficient, no need to approve again
    if (currentAllowance >= amountWei) {
        return {
            success: true,
            txHash: null,
            message: 'Allowance already sufficient',
            currentAllowance: currentAllowance.toString(),
        };
    }

    // Execute approval
    const txHash = await walletClient.writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [TYCOON_ADDRESS, amountWei],
    });

    console.log(`${tokenType} approval tx for agent ${agent.name}:`, txHash);

    return {
        success: true,
        txHash,
        tokenType,
        amount: amount.toString(),
        amountWei: amountWei.toString(),
    };
}

/**
 * Create a game on-chain for an agent
 * @param {number} agentId - Agent ID
 * @param {object} gameParams - Game parameters
 * @returns {Promise<{gameId: string, txHash: string}>}
 */
export async function createGameForAgent(agentId, gameParams) {
    const {
        username,
        gameType = 'CLASSIC',
        playerSymbol = 'CAR',
        numberOfPlayers = 4,
        code = '',
        startingBalance = '1500',
        stakeAmount = '0',
        isAIGame = false,
    } = gameParams;

    const { agent, walletClient } = await loadAgentWallet(agentId);

    // Parse amounts
    const startingBalanceWei = parseUnits(startingBalance.toString(), 18);
    const stakeAmountWei = parseUnits(stakeAmount.toString(), 18);

    let txHash;
    let gameId;

    if (isAIGame) {
        // Create AI-only game
        txHash = await walletClient.writeContract({
            address: TYCOON_ADDRESS,
            abi: TYCOON_ABI,
            functionName: 'createAIGame',
            args: [
                username || agent.name,
                gameType,
                playerSymbol,
                numberOfPlayers,
                code,
                startingBalanceWei,
            ],
        });
    } else {
        // Create regular game with stakes
        txHash = await walletClient.writeContract({
            address: TYCOON_ADDRESS,
            abi: TYCOON_ABI,
            functionName: 'createGame',
            args: [
                username || agent.name,
                gameType,
                playerSymbol,
                numberOfPlayers,
                code,
                startingBalanceWei,
                stakeAmountWei,
            ],
        });
    }

    console.log(`Game creation tx for agent ${agent.name}:`, txHash);

    return {
        success: true,
        txHash,
        agentId,
        agentName: agent.name,
        gameType,
        numberOfPlayers,
        stakeAmount: stakeAmount.toString(),
    };
}

/**
 * Join a game on-chain for an agent
 * @param {number} agentId - Agent ID
 * @param {object} joinParams - Join parameters
 * @returns {Promise<{order: number, txHash: string}>}
 */
export async function joinGameForAgent(agentId, joinParams) {
    const {
        gameId,
        username,
        playerSymbol = 'SHIP',
        joinCode = '',
    } = joinParams;

    const { agent, walletClient } = await loadAgentWallet(agentId);

    // Join game
    const txHash = await walletClient.writeContract({
        address: TYCOON_ADDRESS,
        abi: TYCOON_ABI,
        functionName: 'joinGame',
        args: [
            BigInt(gameId),
            username || agent.name,
            playerSymbol,
            joinCode,
        ],
    });

    console.log(`Game join tx for agent ${agent.name}:`, txHash);

    return {
        success: true,
        txHash,
        agentId,
        agentName: agent.name,
        gameId: gameId.toString(),
    };
}

/**
 * Get agent balances from blockchain
 * @param {number} agentId - Agent ID
 * @returns {Promise<{eth: string, tyc: string, usdc: string}>}
 */
export async function getAgentBalances(agentId) {
    const { agent, publicClient } = await loadAgentWallet(agentId);

    // Get ETH balance
    const ethBalance = await publicClient.getBalance({
        address: agent.wallet_address,
    });

    // Get TYC balance
    const tycBalance = await publicClient.readContract({
        address: TYC_TOKEN_ADDRESS,
        abi: [
            {
                name: 'balanceOf',
                type: 'function',
                stateMutability: 'view',
                inputs: [{ name: 'account', type: 'address' }],
                outputs: [{ name: '', type: 'uint256' }],
            },
        ],
        functionName: 'balanceOf',
        args: [agent.wallet_address],
    });

    // Get USDC balance if configured
    let usdcBalance = '0';
    if (USDC_TOKEN_ADDRESS) {
        usdcBalance = await publicClient.readContract({
            address: USDC_TOKEN_ADDRESS,
            abi: [
                {
                    name: 'balanceOf',
                    type: 'function',
                    stateMutability: 'view',
                    inputs: [{ name: 'account', type: 'address' }],
                    outputs: [{ name: '', type: 'uint256' }],
                },
            ],
            functionName: 'balanceOf',
            args: [agent.wallet_address],
        });
    }

    // Update database
    await db('agents')
        .where({ id: agentId })
        .update({
            eth_balance: (Number(ethBalance) / 1e18).toFixed(8),
            tyc_balance: (Number(tycBalance) / 1e18).toFixed(8),
            usdc_balance: (Number(usdcBalance) / 1e18).toFixed(8),
            last_balance_sync: db.fn.now(),
        });

    return {
        eth: (Number(ethBalance) / 1e18).toString(),
        tyc: (Number(tycBalance) / 1e18).toString(),
        usdc: (Number(usdcBalance) / 1e18).toString(),
    };
}

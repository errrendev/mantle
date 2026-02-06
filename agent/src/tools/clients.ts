import { createPublicClient, createWalletClient, http } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Shared Viem clients for blockchain operations
 */

// Public client for read operations
export const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.RPC_URL),
});

// Optional: Wallet client for transactions
export const account = process.env.PRIVATE_KEY
    ? privateKeyToAccount(
        process.env.PRIVATE_KEY.startsWith('0x')
            ? process.env.PRIVATE_KEY as `0x${string}`
            : `0x${process.env.PRIVATE_KEY}` as `0x${string}`
    )
    : null;

export const walletClient = account ? createWalletClient({
    account,
    chain: sepolia,
    transport: http(process.env.RPC_URL),
}) : null;

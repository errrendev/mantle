import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { parseEther } from "viem";
import { walletClient, account } from "./clients.js";

export const sendEthTool = new DynamicStructuredTool({
    name: "send_eth",
    description: "Send ETH to an address. ONLY use when explicitly asked to send a transaction.",
    schema: z.object({
        to: z.string().describe("Recipient address (0x...)"),
        amount: z.string().describe("Amount in ETH (e.g., '0.1')"),
    }),
    func: async ({ to, amount }) => {
        if (!walletClient || !account) {
            return "Wallet not configured. Please set PRIVATE_KEY in environment variables.";
        }

        try {
            const hash = await walletClient.sendTransaction({
                to: to as `0x${string}`,
                value: parseEther(amount),
            });

            return `Transaction sent! Hash: ${hash}`;
        } catch (error: any) {
            return `Error sending transaction: ${error.message}`;
        }
    },
});

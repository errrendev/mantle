import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { publicClient } from "./clients.js";

export const readContractTool = new DynamicStructuredTool({
    name: "read_erc20_balance",
    description: "Read ERC20 token balance for an address",
    schema: z.object({
        contractAddress: z.string().describe("ERC20 token contract address"),
        walletAddress: z.string().describe("Wallet address to check balance"),
    }),
    func: async ({ contractAddress, walletAddress }) => {
        try {
            const balance = await publicClient.readContract({
                address: contractAddress as `0x${string}`,
                abi: [
                    {
                        name: "balanceOf",
                        type: "function",
                        stateMutability: "view",
                        inputs: [{ name: "account", type: "address" }],
                        outputs: [{ type: "uint256" }],
                    },
                ],
                functionName: "balanceOf",
                args: [walletAddress as `0x${string}`],
            });

            return `Token balance: ${balance}`;
        } catch (error: any) {
            return `Error reading contract: ${error.message}`;
        }
    },
});

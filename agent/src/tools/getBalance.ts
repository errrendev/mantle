import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { formatEther } from "viem";
import { publicClient } from "./clients.js";

export const getBalanceTool = new DynamicStructuredTool({
    name: "get_eth_balance",
    description: "Get the ETH balance of an Ethereum address. Returns balance in ETH.",
    schema: z.object({
        address: z.string().describe("The Ethereum address to check (0x...)"),
    }),
    func: async ({ address }) => {
        try {
            const balance = await publicClient.getBalance({
                address: address as `0x${string}`,
            });

            const balanceInEth = formatEther(balance);
            return `Balance: ${balanceInEth} ETH`;
        } catch (error: any) {
            return `Error getting balance: ${error.message}`;
        }
    },
});

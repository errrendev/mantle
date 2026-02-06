import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { formatEther } from "viem";
import { publicClient } from "./clients.js";

export const getTransactionTool = new DynamicStructuredTool({
    name: "get_transaction",
    description: "Get details of a transaction by its hash",
    schema: z.object({
        hash: z.string().describe("The transaction hash (0x...)"),
    }),
    func: async ({ hash }) => {
        try {
            const tx = await publicClient.getTransaction({
                hash: hash as `0x${string}`,
            });

            return JSON.stringify({
                from: tx.from,
                to: tx.to,
                value: formatEther(tx.value),
                blockNumber: tx.blockNumber,
                gas: tx.gas.toString(),
            }, null, 2);
        } catch (error: any) {
            return `Error getting transaction: ${error.message}`;
        }
    },
});

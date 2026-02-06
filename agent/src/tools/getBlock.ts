import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { publicClient } from "./clients.js";

export const getBlockTool = new DynamicStructuredTool({
    name: "get_block_details",
    description: "Get detailed information about a specific block",
    schema: z.object({
        blockNumber: z.string().describe("Block number to query"),
    }),
    func: async ({ blockNumber }) => {
        try {
            const block = await publicClient.getBlock({
                blockNumber: BigInt(blockNumber),
            });

            return JSON.stringify({
                number: block.number,
                hash: block.hash,
                timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
                transactions: block.transactions.length,
                gasUsed: block.gasUsed.toString(),
                gasLimit: block.gasLimit.toString(),
            }, null, 2);
        } catch (error: any) {
            return `Error getting block details: ${error.message}`;
        }
    },
});

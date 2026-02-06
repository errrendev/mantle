import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { publicClient } from "./clients.js";

export const getBlockNumberTool = new DynamicStructuredTool({
    name: "get_block_number",
    description: "Get the current block number of the blockchain",
    schema: z.object({}),
    func: async () => {
        try {
            const blockNumber = await publicClient.getBlockNumber();
            return `Current block number: ${blockNumber}`;
        } catch (error: any) {
            return `Error getting block number: ${error.message}`;
        }
    },
});

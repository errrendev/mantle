import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { parseEther } from "viem";
import { publicClient } from "./clients.js";

export const estimateGasTool = new DynamicStructuredTool({
    name: "estimate_gas",
    description: "Estimate gas needed for a transaction",
    schema: z.object({
        to: z.string().describe("Recipient address (0x...)"),
        value: z.string().describe("Amount in ETH (e.g., '0.1')"),
    }),
    func: async ({ to, value }) => {
        try {
            const gas = await publicClient.estimateGas({
                to: to as `0x${string}`,
                value: parseEther(value),
            });
            return `Estimated gas: ${gas.toString()} units`;
        } catch (error: any) {
            return `Error estimating gas: ${error.message}`;
        }
    },
});

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { publicClient } from "./clients.js";

export const getTransactionReceiptTool = new DynamicStructuredTool({
    name: "get_transaction_receipt",
    description: "Get the receipt of a transaction to check if it was successful",
    schema: z.object({
        hash: z.string().describe("Transaction hash (0x...)"),
    }),
    func: async ({ hash }) => {
        try {
            const receipt = await publicClient.getTransactionReceipt({
                hash: hash as `0x${string}`,
            });

            return JSON.stringify({
                status: receipt.status === "success" ? "Success" : "Failed",
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                from: receipt.from,
                to: receipt.to,
            }, null, 2);
        } catch (error: any) {
            return `Error getting transaction receipt: ${error.message}`;
        }
    },
});

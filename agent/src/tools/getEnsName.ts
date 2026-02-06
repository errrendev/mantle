import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { publicClient } from "./clients.js";

export const getEnsNameTool = new DynamicStructuredTool({
    name: "get_ens_name",
    description: "Get ENS name for an Ethereum address",
    schema: z.object({
        address: z.string().describe("Ethereum address (0x...)"),
    }),
    func: async ({ address }) => {
        try {
            const ensName = await publicClient.getEnsName({
                address: address as `0x${string}`,
            });
            return ensName ? `ENS name: ${ensName}` : "No ENS name found for this address";
        } catch (error: any) {
            return `Error getting ENS name: ${error.message}`;
        }
    },
});

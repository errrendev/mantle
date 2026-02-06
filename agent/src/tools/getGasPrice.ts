import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { publicClient } from "./clients.js";

export const getGasPriceTool = new DynamicStructuredTool({
    name: "get_gas_price",
    description: "Get the current gas price in Gwei",
    schema: z.object({}),
    func: async () => {
        try {
            const gasPrice = await publicClient.getGasPrice();
            const gasPriceInGwei = Number(gasPrice) / 1e9;
            return `Current gas price: ${gasPriceInGwei.toFixed(2)} Gwei`;
        } catch (error: any) {
            return `Error getting gas price: ${error.message}`;
        }
    },
});

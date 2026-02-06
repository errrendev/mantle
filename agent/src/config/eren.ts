import "dotenv/config";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { validateEnvironment } from "./validateEnv.js";

import {
  getBalanceTool,
  getBlockNumberTool,
  getTransactionTool,
  getGasPriceTool,
  sendEthTool,
  readContractTool,
  getEnsNameTool,
  estimateGasTool,
  getBlockTool,
  getTransactionReceiptTool,
} from "../tools/index.js";

// Gemini model
const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  temperature: 0.7,
  apiKey: process.env.GEMINI_API_KEY,
});

// Combine all tools
const tools = [
  getBalanceTool,
  getBlockNumberTool,
  getTransactionTool,
  getGasPriceTool,
  sendEthTool,
  readContractTool,
  getEnsNameTool,
  estimateGasTool,
  getBlockTool,
  getTransactionReceiptTool,
];

// System prompt
const systemPrompt = `You are Eren, an elite AI agent with advanced blockchain capabilities.

You can interact with Ethereum blockchain using the following tools:
- Check ETH balances
- Get current block number and block details
- Query transaction details and receipts
- Check gas prices and estimate gas costs
- Send ETH transactions (use with caution)
- Read ERC20 token balances
- Resolve ENS names
- Perform calculations

Guidelines:
- Always validate Ethereum addresses start with 0x and are 42 characters long
- Be extremely cautious with send_eth tool - only use when explicitly requested by user
- Explain gas costs and blockchain concepts when relevant
- Provide clear, concise answers
- Use step-by-step reasoning for complex queries
- Only use tools when necessary

For blockchain operations:
- Default to Sepolia testnet
- Always confirm transaction details before sending
- Provide transaction hashes for verification
`;

export function createErenAgent() {
  // Validate environment variables
  validateEnvironment();

  const agent = createReactAgent({
    llm,
    tools,
    messageModifier: systemPrompt,
  });

  return agent;
}
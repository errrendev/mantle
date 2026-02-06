import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { createPublicClient, createWalletClient, http, formatEther, parseEther } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// Setup Viem clients
const publicClient = createPublicClient({
  chain: sepolia, // or mainnet
  transport: http(process.env.RPC_URL),
});

// Optional: Wallet client for transactions
const account = process.env.PRIVATE_KEY
  ? privateKeyToAccount(
    process.env.PRIVATE_KEY.startsWith('0x')
      ? process.env.PRIVATE_KEY as `0x${string}`
      : `0x${process.env.PRIVATE_KEY}` as `0x${string}`
  )
  : null;

const walletClient = account ? createWalletClient({
  account,
  chain: sepolia,
  transport: http(process.env.RPC_URL),
}) : null;

// Tool 1: Get ETH Balance
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

// Tool 2: Get Block Number
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

// Tool 3: Get Transaction Details
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

// Tool 4: Get Gas Price
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

// Tool 5: Send ETH (requires wallet)
export const sendEthTool = new DynamicStructuredTool({
  name: "send_eth",
  description: "Send ETH to an address. ONLY use when explicitly asked to send a transaction.",
  schema: z.object({
    to: z.string().describe("Recipient address (0x...)"),
    amount: z.string().describe("Amount in ETH (e.g., '0.1')"),
  }),
  func: async ({ to, amount }) => {
    if (!walletClient || !account) {
      return "Wallet not configured. Please set PRIVATE_KEY in environment variables.";
    }

    try {
      const hash = await walletClient.sendTransaction({
        to: to as `0x${string}`,
        value: parseEther(amount),
      });

      return `Transaction sent! Hash: ${hash}`;
    } catch (error: any) {
      return `Error sending transaction: ${error.message}`;
    }
  },
});

// Tool 6: Read from Smart Contract (ERC20 example)
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

// Tool 7: Get ENS Name
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

// Tool 8: Estimate Gas
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

// Tool 9: Get Block Details
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

// Tool 10: Get Transaction Receipt
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
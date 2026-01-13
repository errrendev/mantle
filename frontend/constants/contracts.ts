// constants/contracts.ts
import { Address } from 'viem';
import { mantle, mantleSepoliaTestnet } from 'wagmi/chains'; // import your chains

export const TYCOON_CONTRACT_ADDRESSES: Record<number, Address | undefined> = {
  [mantle.id]: process.env.NEXT_PUBLIC_MANTLE as Address,
  [mantleSepoliaTestnet.id]: process.env.NEXT_PUBLIC_MANTLE_SEPOLIA as Address,
 
};
export const REWARD_CONTRACT_ADDRESSES: Record<number, Address | undefined> = {
  [mantle.id]: process.env.NEXT_PUBLIC_MANTLE_REWARD as Address,
  [mantleSepoliaTestnet.id]: process.env.NEXT_PUBLIC_MANTLE_REWARD_SEPOLIA as Address,
}
export const TYC_TOKEN_ADDRESS: Record<number, Address | undefined> = {
  [mantle.id]: process.env.NEXT_PUBLIC_MANTLE_REWARD as Address,
  [mantleSepoliaTestnet.id]: process.env.NEXT_PUBLIC_MANTLE_USDC_SEPOLIA as Address,
}

export const USDC_TOKEN_ADDRESS: Record<number, Address | undefined> = {
  [mantle.id]: process.env.NEXT_PUBLIC_MANTLE_USDC as Address,
  [mantleSepoliaTestnet.id]: process.env.NEXT_PUBLIC_MANTLE_USDC_SEPOLIA as Address,
}
// constants/contracts.ts
export const MINIPAY_CHAIN_IDS = [42220]; // Celo Mainnet & Alfajores
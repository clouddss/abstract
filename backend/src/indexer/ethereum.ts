import { ethers } from 'ethers';
import { appConfig } from '../config';

// Provider setup
export const provider = new ethers.JsonRpcProvider(appConfig.ABSTRACT_RPC_URL);

// Contract ABIs - minimal required for indexing
export const LAUNCH_FACTORY_ABI = [
  "event TokenLaunched(address indexed tokenAddress, address indexed creator, address indexed bondingCurve, tuple(string name, string symbol, string description, string imageUrl, string website, string twitter, string telegram) metadata)",
  "event TokenMigrated(address indexed tokenAddress, address indexed dexPair, uint256 liquidityAmount)",
  "function getAllTokens() external view returns (address[] memory)",
  "function getTokenInfo(address tokenAddress) external view returns (tuple(string name, string symbol, string description, string imageUrl, string website, string twitter, string telegram), address, address, bool)"
];

export const BONDING_CURVE_ABI = [
  "event TokensPurchased(address indexed buyer, uint256 ethAmount, uint256 tokenAmount, uint256 newPrice)",
  "event TokensSold(address indexed seller, uint256 tokenAmount, uint256 ethAmount, uint256 newPrice)",
  "event CurveMigrated(uint256 liquidityAmount, uint256 tokenAmount)",
  "function soldSupply() external view returns (uint256)",
  "function getCurrentPrice() external view returns (uint256)",
  "function getCurveProgress() external view returns (uint256, uint256, uint256)"
];

export const PLATFORM_ROUTER_ABI = [
  "event SwapExecuted(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, uint256 feeAmount)",
  "event FeesDistributed(address indexed token, uint256 treasuryAmount, uint256 creatorAmount, uint256 holdersAmount)"
];

export const REWARDS_VAULT_ABI = [
  "event RewardsDeposited(uint256 indexed epoch, address indexed token, uint256 ethAmount, uint256 usdcAmount)",
  "event SnapshotSubmitted(uint256 indexed epoch, address indexed token, bytes32 merkleRoot, uint256 totalHolders)",
  "event RewardsClaimed(uint256 indexed epoch, address indexed claimer, uint256 ethAmount, uint256 usdcAmount)"
];

export const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function totalSupply() external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function name() external view returns (string)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)"
];

// Get current block number
export async function getCurrentBlock(): Promise<number> {
  try {
    return await provider.getBlockNumber();
  } catch (error) {
    console.error('Error getting current block:', error);
    throw error;
  }
}

// Get block timestamp
export async function getBlockTimestamp(blockNumber: number): Promise<Date> {
  try {
    const block = await provider.getBlock(blockNumber);
    if (!block) {
      throw new Error(`Block ${blockNumber} not found`);
    }
    return new Date(block.timestamp * 1000);
  } catch (error) {
    console.error(`Error getting block ${blockNumber} timestamp:`, error);
    throw error;
  }
}

// Get transaction receipt
export async function getTransactionReceipt(txHash: string) {
  try {
    return await provider.getTransactionReceipt(txHash);
  } catch (error) {
    console.error(`Error getting transaction receipt ${txHash}:`, error);
    throw error;
  }
}

// Batch get logs with retry logic
export async function getLogs(filter: ethers.Filter, retryCount = 3): Promise<ethers.Log[]> {
  for (let i = 0; i < retryCount; i++) {
    try {
      return await provider.getLogs(filter);
    } catch (error) {
      console.error(`Error getting logs (attempt ${i + 1}/${retryCount}):`, error);
      if (i === retryCount - 1) throw error;
      
      // Wait before retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
  return [];
}

// Create contract instance
export function createContract(address: string, abi: string[]) {
  return new ethers.Contract(address, abi, provider);
}

// Utility functions for working with BigNumber values
export function formatEther(value: string | bigint): string {
  return ethers.formatEther(value);
}

export function parseEther(value: string): bigint {
  return ethers.parseEther(value);
}

export function formatUnits(value: string | bigint, decimals: number): string {
  return ethers.formatUnits(value, decimals);
}

// Calculate token price from purchase data
export function calculateTokenPrice(ethAmount: bigint, tokenAmount: bigint): string {
  if (tokenAmount === 0n) return "0";
  return ethers.formatEther((ethAmount * parseEther("1")) / tokenAmount);
}

// Validate Ethereum address
export function isValidAddress(address: string): boolean {
  return ethers.isAddress(address);
}

// Get contract creation block (simplified - in production you'd need to search)
export async function getContractCreationBlock(address: string): Promise<number> {
  try {
    // For new contracts, we can assume they were created recently
    // In production, you'd implement a more sophisticated search
    const currentBlock = await getCurrentBlock();
    return Math.max(0, currentBlock - 10000); // Look back 10k blocks
  } catch (error) {
    console.error(`Error determining creation block for ${address}:`, error);
    return 0;
  }
}
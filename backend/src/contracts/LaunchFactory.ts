import { ethers } from 'ethers';
import { appConfig } from '../config';

// Contract addresses
export const CONTRACT_ADDRESSES = {
  LAUNCH_FACTORY: '0x8cD80fb9885e3a66BAF5F0758541f95b629B651E', // LaunchFactory on Abstract testnet
  LAUNCH_FACTORY_LIB: '0x7B4E7f6b8a5AE89cbe6E1f69bFb69f403d90A67a',
  PLATFORM_ROUTER: '0x6D6070423745c950dd57562466e7186F192a6B78',
  REWARDS_VAULT: '0x946241f84fcc8A8851dF4D0823910471B2A5bD77',
  PLATFORM_TREASURY: '0x25519F356174b2f4Db629dc8DD916043b0f8447D'
};

// MinimalLaunchFactory ABI - simplified contract
export const LAUNCH_FACTORY_ABI = [
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "symbol",
        "type": "string"
      }
    ],
    "name": "deployToken",
    "outputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "bondingCurve",
        "type": "address"
      }
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "launchFee",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "platformToken",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "bondingCurve",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "name",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "symbol",
        "type": "string"
      }
    ],
    "name": "TokenLaunched",
    "type": "event"
  }
];

// BaseToken ABI - minimal interface
export const BASE_TOKEN_ABI = [
  {
    "inputs": [],
    "name": "name",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSupply",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// BondingCurve ABI - minimal interface
export const BONDING_CURVE_ABI = [
  {
    "inputs": [],
    "name": "getCurrentPrice",
    "outputs": [{"internalType": "uint256", "name": "price", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "ethAmount", "type": "uint256"}],
    "name": "calculateTokensOut",
    "outputs": [{"internalType": "uint256", "name": "tokenAmount", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "tokenAmount", "type": "uint256"}],
    "name": "calculateEthOut",
    "outputs": [{"internalType": "uint256", "name": "ethAmount", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "minTokensOut", "type": "uint256"}],
    "name": "buyTokens",
    "outputs": [{"internalType": "uint256", "name": "tokenAmount", "type": "uint256"}],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "tokenAmount", "type": "uint256"},
      {"internalType": "uint256", "name": "minEthOut", "type": "uint256"}
    ],
    "name": "sellTokens",
    "outputs": [{"internalType": "uint256", "name": "ethAmount", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getCurveStats",
    "outputs": [
      {"internalType": "uint256", "name": "currentPrice", "type": "uint256"},
      {"internalType": "uint256", "name": "tokensSold_", "type": "uint256"},
      {"internalType": "uint256", "name": "tokensRemaining", "type": "uint256"},
      {"internalType": "uint256", "name": "reserveBalance_", "type": "uint256"},
      {"internalType": "uint256", "name": "marketCap", "type": "uint256"},
      {"internalType": "bool", "name": "completed_", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getCurveProgress",
    "outputs": [
      {"internalType": "uint256", "name": "soldSupply_", "type": "uint256"},
      {"internalType": "uint256", "name": "totalSupply", "type": "uint256"},
      {"internalType": "uint256", "name": "progressBps", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "buyer", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "ethAmount", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "tokenAmount", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "newPrice", "type": "uint256"}
    ],
    "name": "TokensPurchased",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "seller", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "tokenAmount", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "ethAmount", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "newPrice", "type": "uint256"}
    ],
    "name": "TokensSold",
    "type": "event"
  }
];

export function getProvider() {
  return new ethers.JsonRpcProvider(appConfig.ABSTRACT_RPC_URL);
}

export function getLaunchFactoryContract() {
  const provider = getProvider();
  return new ethers.Contract(
    CONTRACT_ADDRESSES.LAUNCH_FACTORY,
    LAUNCH_FACTORY_ABI,
    provider
  );
}

export async function getLaunchFee(): Promise<bigint> {
  const contract = getLaunchFactoryContract();
  return await contract.launchFee();
}

export async function estimateGasForDeploy(name: string, symbol: string): Promise<bigint> {
  // Return a reasonable default gas limit for token deployment
  // Most token deployments use 200k-300k gas
  return 300000n;
}

export function encodeDeployTokenData(name: string, symbol: string, description?: string, imageUrl?: string, website?: string, twitter?: string, telegram?: string): string {
  const iface = new ethers.Interface(LAUNCH_FACTORY_ABI);
  // MinimalLaunchFactory just takes name and symbol
  return iface.encodeFunctionData('deployToken', [name, symbol]);
}

export function decodeTokenLaunchedEvent(receipt: ethers.TransactionReceipt): {
  token: string;
  bondingCurve: string;
  creator: string;
  name: string;
  symbol: string;
} | null {
  const iface = new ethers.Interface(LAUNCH_FACTORY_ABI);
  
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({
        topics: log.topics as string[],
        data: log.data
      });
      
      if (parsed && parsed.name === 'TokenLaunched') {
        return {
          token: parsed.args[0],
          creator: parsed.args[1],
          bondingCurve: parsed.args[2],
          name: parsed.args[3],
          symbol: parsed.args[4]
        };
      }
    } catch (e) {
      // Not our event, continue
    }
  }
  
  return null;
}
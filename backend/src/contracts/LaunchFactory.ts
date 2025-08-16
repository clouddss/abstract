import { ethers } from 'ethers';
import { appConfig } from '../config';

// Contract addresses
export const CONTRACT_ADDRESSES = {
  LAUNCH_FACTORY: '0xE19264ea91C04A60e7d44fECcDdf70C31b0adeFB',
  PLATFORM_ROUTER: '0x6D6070423745c950dd57562466e7186F192a6B78',
  REWARDS_VAULT: '0x946241f84fcc8A8851dF4D0823910471B2A5bD77'
};

// LaunchFactory ABI - only the functions we need
export const LAUNCH_FACTORY_ABI = [
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "_name",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "_symbol",
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
        "name": "bondingCurve",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "creator",
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
    "name": "token",
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
  },
  {
    "inputs": [],
    "name": "reserveBalance",
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

export function encodeDeployTokenData(name: string, symbol: string): string {
  const iface = new ethers.Interface(LAUNCH_FACTORY_ABI);
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
          bondingCurve: parsed.args[1],
          creator: parsed.args[2],
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
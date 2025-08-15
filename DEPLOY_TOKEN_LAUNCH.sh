#!/bin/bash

echo "🚀 Deploying Token Launch Feature..."

# SSH into server and deploy
ssh blunr@92.205.165.167 << 'ENDSSH'
cd /var/www/abstract/blastabs/backend

# Pull latest changes (if using git)
# git pull origin main

# Create contracts directory
echo "📝 Creating contracts directory..."
mkdir -p src/contracts

# Create LaunchFactory contract interface
echo "📝 Creating LaunchFactory.ts..."
cat > src/contracts/LaunchFactory.ts << 'EOF'
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
  try {
    const contract = getLaunchFactoryContract();
    const launchFee = await getLaunchFee();
    
    // Create a dummy wallet for estimation
    const provider = getProvider();
    const wallet = ethers.Wallet.createRandom().connect(provider);
    const contractWithSigner = contract.connect(wallet) as any;
    
    const gasEstimate = await contractWithSigner.deployToken.estimateGas(
      name,
      symbol,
      { value: launchFee }
    );
    
    // Add 20% buffer
    return gasEstimate * 120n / 100n;
  } catch (error) {
    console.error('Error estimating gas:', error);
    // Return a reasonable default
    return 800000n;
  }
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
EOF

# Create tokens-launch routes
echo "📝 Creating tokens-launch.ts..."
cat > src/api/routes/tokens-launch.ts << 'EOF'
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ethers } from 'ethers';
import { prisma } from '../../database/client';
import { validateRequest } from '../middleware/validation';
import { authMiddleware } from '../middleware/auth';
import { 
  getLaunchFee, 
  estimateGasForDeploy, 
  encodeDeployTokenData,
  CONTRACT_ADDRESSES,
  getProvider,
  decodeTokenLaunchedEvent
} from '../../contracts/LaunchFactory';

const router = Router();

// Validation schemas
const launchTokenSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(50),
    symbol: z.string().min(1).max(10),
    description: z.string().max(500).optional(),
    imageUrl: z.string().url().optional(),
    website: z.string().url().optional(),
    twitter: z.string().max(50).optional(),
    telegram: z.string().max(50).optional()
  })
});

const confirmLaunchSchema = z.object({
  body: z.object({
    txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    name: z.string(),
    symbol: z.string(),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    website: z.string().optional(),
    twitter: z.string().optional(),
    telegram: z.string().optional()
  })
});

/**
 * POST /api/tokens/launch
 * Prepare token launch - returns transaction data for user to sign
 */
router.post('/launch', authMiddleware, validateRequest(launchTokenSchema), async (req: Request, res: Response) => {
  try {
    const { name, symbol } = req.body;
    const userAddress = req.user!.address;

    // Get launch fee from contract
    const launchFee = await getLaunchFee();
    
    // Estimate gas
    const estimatedGas = await estimateGasForDeploy(name, symbol);
    
    // Encode the transaction data
    const data = encodeDeployTokenData(name, symbol);

    // Return transaction details for user to sign
    res.json({
      success: true,
      data: {
        to: CONTRACT_ADDRESSES.LAUNCH_FACTORY,
        data,
        value: launchFee.toString(),
        estimatedGas: estimatedGas.toString(),
        launchFee: ethers.formatEther(launchFee),
        message: 'Please sign the transaction in your wallet to launch the token'
      }
    });

  } catch (error) {
    console.error('Error preparing token launch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to prepare token launch'
    });
  }
});

/**
 * POST /api/tokens/launch/confirm
 * Confirm token launch after user has sent the transaction
 */
router.post('/launch/confirm', authMiddleware, validateRequest(confirmLaunchSchema), async (req: Request, res: Response) => {
  try {
    const { txHash, name, symbol, description, imageUrl, website, twitter, telegram } = req.body;
    const userAddress = req.user!.address;

    // Check if transaction already processed
    const existingToken = await prisma.token.findFirst({
      where: { deployTxHash: txHash }
    });

    if (existingToken) {
      return res.json({
        success: true,
        data: {
          token: existingToken,
          message: 'Token already registered'
        }
      });
    }

    // Get provider and wait for transaction
    const provider = getProvider();
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      return res.status(400).json({
        success: false,
        error: 'Transaction not found. It may still be pending.'
      });
    }

    if (receipt.status !== 1) {
      return res.status(400).json({
        success: false,
        error: 'Transaction failed'
      });
    }

    // Decode the TokenLaunched event
    const launchEvent = decodeTokenLaunchedEvent(receipt);
    
    if (!launchEvent) {
      return res.status(400).json({
        success: false,
        error: 'Token launch event not found in transaction'
      });
    }

    // Verify the creator matches the authenticated user
    if (launchEvent.creator.toLowerCase() !== userAddress.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'Transaction was not sent by authenticated user'
      });
    }

    // Get initial token supply (800M tokens)
    const INITIAL_SUPPLY = ethers.parseEther('800000000');
    const CURVE_SUPPLY = ethers.parseEther('400000000'); // 50% for bonding curve

    // Create token in database
    const token = await prisma.token.create({
      data: {
        address: launchEvent.token.toLowerCase(),
        name: launchEvent.name,
        symbol: launchEvent.symbol,
        description: description || null,
        imageUrl: imageUrl || null,
        website: website || null,
        twitter: twitter || null,
        telegram: telegram || null,
        creator: launchEvent.creator.toLowerCase(),
        creatorId: req.user!.userId,
        bondingCurve: launchEvent.bondingCurve.toLowerCase(),
        totalSupply: INITIAL_SUPPLY.toString(),
        curveSupply: CURVE_SUPPLY.toString(),
        soldSupply: '0',
        deployTxHash: txHash,
        deployBlockNumber: receipt.blockNumber,
        migrated: false,
        marketCap: '0',
        volume24h: '0',
        volume7d: '0',
        volumeTotal: '0',
        holderCount: 1,
        txCount: 0,
        createdAt: new Date()
      }
    });

    // Create initial holder record for creator (they get 50% of supply)
    const CREATOR_SUPPLY = ethers.parseEther('400000000');
    await prisma.holder.create({
      data: {
        tokenAddress: token.address,
        wallet: launchEvent.creator.toLowerCase(),
        balance: CREATOR_SUPPLY.toString(),
        firstBoughtAt: new Date(),
        lastActivity: new Date()
      }
    });

    res.json({
      success: true,
      data: {
        token: {
          address: token.address,
          name: token.name,
          symbol: token.symbol,
          description: token.description,
          imageUrl: token.imageUrl,
          bondingCurve: token.bondingCurve,
          creator: token.creator,
          txHash: token.deployTxHash,
          createdAt: token.createdAt
        },
        message: 'Token launched successfully!'
      }
    });

  } catch (error) {
    console.error('Error confirming token launch:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm token launch'
    });
  }
});

/**
 * GET /api/tokens/launch/fee
 * Get current launch fee
 */
router.get('/launch/fee', async (req: Request, res: Response) => {
  try {
    const launchFee = await getLaunchFee();
    
    res.json({
      success: true,
      data: {
        fee: launchFee.toString(),
        feeFormatted: ethers.formatEther(launchFee),
        currency: 'ETH'
      }
    });
  } catch (error) {
    console.error('Error fetching launch fee:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch launch fee'
    });
  }
});

export default router;
EOF

# Create error middleware if it doesn't exist
echo "📝 Creating error middleware..."
mkdir -p src/api/middleware
cat > src/api/middleware/error.ts << 'EOF'
import { Request, Response, NextFunction } from 'express';

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
EOF

# Update tokens.ts to import launch routes
echo "📝 Updating tokens.ts..."
sed -i '1i import tokenLaunchRouter from '\''./tokens-launch'\'';' src/api/routes/tokens.ts
sed -i '/const router = Router();/a\\n// Mount launch routes\nrouter.use('\''/'\'', tokenLaunchRouter);' src/api/routes/tokens.ts

# Update CORS in api/index.ts
echo "📝 Updating CORS configuration..."
sed -i "s/allowedHeaders: \['Content-Type', 'Authorization', 'x-wallet-signature', 'x-api-key'\]/allowedHeaders: ['Content-Type', 'Authorization', 'x-wallet-address', 'x-wallet-signature', 'x-api-key']/" src/api/index.ts

# Add trust proxy setting
sed -i "/const app = express();/a\\n// Trust proxy for rate limiting behind NGINX\napp.set('trust proxy', true);" src/api/index.ts

# Install ethers if not already installed
echo "📦 Installing ethers..."
npm install ethers

# Update Prisma schema
echo "📝 Updating Prisma schema..."
sed -i '/migrated        Boolean  @default(false)/a\  deployTxHash    String?  @unique\n  deployBlockNumber Int?\n  txCount         Int      @default(0)' prisma/schema.prisma

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Create migration
echo "🗄️  Creating database migration..."
npx prisma migrate dev --name add-deploy-fields --create-only

# Apply migration
echo "🗄️  Applying migration..."
npx prisma migrate deploy

# Build backend
echo "🏗️  Building backend..."
npm run build

# Restart PM2
echo "🔄 Restarting backend..."
pm2 restart abs-back

echo "✅ Token launch feature deployed!"
echo ""
echo "📋 Testing endpoints:"
echo "1. Get launch fee: curl https://api.blastabs.fun/api/tokens/launch/fee"
echo "2. Check logs: pm2 logs abs-back --lines 50"
ENDSSH

echo "✅ Deployment script complete!"
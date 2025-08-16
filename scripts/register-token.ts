import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

const prisma = new PrismaClient();

async function registerToken() {
  const tokenData = {
    address: '0x09bdbd5b5318e222b0f6c5e842d931214e634d9c',
    name: 'Blastabs',
    symbol: 'Blastabs',
    description: null,
    imageUrl: null,
    website: null,
    twitter: null,
    telegram: null,
    creator: '0x25519f356174b2f4db629dc8dd916043b0f8447d',
    bondingCurve: '0xcf13424f4136ff744eb88c0892926f9d04b95e72',
    totalSupply: ethers.parseEther('800000000').toString(),
    curveSupply: ethers.parseEther('400000000').toString(),
    soldSupply: '0',
    deployTxHash: '0x90a5b1d8b228a4402d20f3058f86b5bde7bcb40bd70f09d5469389948a009c6c',
    deployBlockNumber: 12549368,
    migrated: false,
    marketCap: '0',
    volume24h: '0',
    volume7d: '0',
    volumeTotal: '0',
    holderCount: 1,
    txCount: 0,
    createdAt: new Date()
  };

  try {
    // First find the user
    const user = await prisma.user.findUnique({
      where: { address: '0x25519f356174b2f4db629dc8dd916043b0f8447d' }
    });

    if (!user) {
      console.error('User not found. Please make sure the user is registered first.');
      return;
    }

    // Create token
    const token = await prisma.token.create({
      data: {
        ...tokenData,
        creatorId: user.id
      }
    });

    // Create initial holder record
    await prisma.holder.create({
      data: {
        tokenAddress: token.address,
        wallet: '0x25519f356174b2f4db629dc8dd916043b0f8447d',
        balance: ethers.parseEther('400000000').toString(),
        firstBoughtAt: new Date(),
        lastActivity: new Date()
      }
    });

    console.log('✅ Token registered successfully!');
    console.log('Token address:', token.address);
    console.log('View at: https://blastabs.fun/token/' + token.address);
  } catch (error) {
    console.error('Error registering token:', error);
  } finally {
    await prisma.$disconnect();
  }
}

registerToken();
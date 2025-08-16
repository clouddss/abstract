import { ethers } from 'ethers';

/**
 * Calculate initial liquidity requirements for tokens
 * 
 * For a bonding curve token with:
 * - Total Supply: 1,000,000,000 tokens (1 billion)
 * - Curve Supply: 700,000,000 tokens (700 million for bonding curve)
 * - Target Market Cap: $5,000 USD
 * - ETH Price: $2,000 USD (configurable)
 */

export function calculateInitialLiquidity(
  targetMarketCapUSD: number = 5000,
  ethPriceUSD: number = 2000,
  totalSupply: bigint = ethers.parseEther('1000000000'), // 1 billion tokens
  curveSupply: bigint = ethers.parseEther('700000000'), // 700 million for curve
  initialSoldPercent: number = 0.1 // Start with 10% sold
) {
  // Calculate target market cap in ETH
  const targetMarketCapETH = targetMarketCapUSD / ethPriceUSD;
  
  // Calculate initial tokens to be "sold"
  const initialTokensSold = (curveSupply * BigInt(Math.floor(initialSoldPercent * 100))) / 100n;
  
  // Calculate price per token for target market cap
  // Price = Market Cap / Total Supply
  const pricePerTokenETH = targetMarketCapETH / Number(ethers.formatEther(totalSupply));
  
  // Calculate ETH needed for initial liquidity
  // This would be the ETH that needs to be in the bonding curve
  const ethNeededForInitialSold = pricePerTokenETH * Number(ethers.formatEther(initialTokensSold));
  
  // For a bonding curve, we need to calculate based on the curve formula
  // Simplified linear bonding curve: Price = basePrice + (k * tokensSold)
  // For more complex curves, this calculation would differ
  
  const results = {
    targetMarketCapUSD,
    targetMarketCapETH,
    ethPriceUSD,
    totalSupplyTokens: ethers.formatEther(totalSupply),
    curveSupplyTokens: ethers.formatEther(curveSupply),
    initialTokensSold: ethers.formatEther(initialTokensSold),
    pricePerTokenETH,
    pricePerTokenUSD: pricePerTokenETH * ethPriceUSD,
    ethNeededForInitialLiquidity: ethNeededForInitialSold,
    usdNeededForInitialLiquidity: ethNeededForInitialSold * ethPriceUSD,
    
    // Per token costs
    ethPerNewToken: ethNeededForInitialSold, // ETH needed per new token launch
    usdPerNewToken: ethNeededForInitialSold * ethPriceUSD,
    
    // For multiple tokens
    calculateForMultipleTokens: (numTokens: number) => ({
      totalETHNeeded: ethNeededForInitialSold * numTokens,
      totalUSDNeeded: ethNeededForInitialSold * ethPriceUSD * numTokens,
      tokensLaunched: numTokens
    })
  };
  
  return results;
}

// Example calculations
export function runExamples() {
  console.log('=== Initial Liquidity Calculations ===\n');
  
  // Standard $5k market cap
  const standard = calculateInitialLiquidity();
  console.log('Standard ($5k market cap):');
  console.log(`- Market Cap: $${standard.targetMarketCapUSD} (${standard.targetMarketCapETH.toFixed(4)} ETH)`);
  console.log(`- Price per token: $${standard.pricePerTokenUSD.toFixed(8)} (${standard.pricePerTokenETH.toFixed(10)} ETH)`);
  console.log(`- Initial tokens sold: ${standard.initialTokensSold}`);
  console.log(`- ETH needed per token: ${standard.ethPerNewToken.toFixed(4)} ETH`);
  console.log(`- USD needed per token: $${standard.usdPerNewToken.toFixed(2)}\n`);
  
  // For 10 tokens
  const tenTokens = standard.calculateForMultipleTokens(10);
  console.log('For 10 token launches:');
  console.log(`- Total ETH needed: ${tenTokens.totalETHNeeded.toFixed(4)} ETH`);
  console.log(`- Total USD needed: $${tenTokens.totalUSDNeeded.toFixed(2)}\n`);
  
  // For 100 tokens
  const hundredTokens = standard.calculateForMultipleTokens(100);
  console.log('For 100 token launches:');
  console.log(`- Total ETH needed: ${hundredTokens.totalETHNeeded.toFixed(4)} ETH`);
  console.log(`- Total USD needed: $${hundredTokens.totalUSDNeeded.toFixed(2)}\n`);
  
  // Different market caps
  console.log('=== Different Initial Market Caps ===\n');
  
  const marketCaps = [1000, 2500, 5000, 10000, 25000];
  marketCaps.forEach(cap => {
    const calc = calculateInitialLiquidity(cap);
    console.log(`$${cap} market cap: ${calc.ethPerNewToken.toFixed(4)} ETH per token ($${calc.usdPerNewToken.toFixed(2)})`);
  });
  
  console.log('\n=== With Different ETH Prices ===\n');
  
  const ethPrices = [1500, 2000, 2500, 3000];
  ethPrices.forEach(price => {
    const calc = calculateInitialLiquidity(5000, price);
    console.log(`ETH at $${price}: ${calc.ethPerNewToken.toFixed(4)} ETH per token ($${calc.usdPerNewToken.toFixed(2)})`);
  });
}

// Run if called directly
if (require.main === module) {
  runExamples();
}
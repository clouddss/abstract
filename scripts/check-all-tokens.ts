import { ethers } from "hardhat";

async function main() {
  const factoryAddress = "0x8cD80fb9885e3a66BAF5F0758541f95b629B651E";
  
  // Tokens to check
  const tokens = [
    "0x3f2b0a0b35bf6c71abf2d0e359c15dfc1de606b2", // Problematic token
    "0x39315cd8826d41739216fa83535af88fd4fdb810", // Working token
    "0x89A637a78d68ddF06046CDeca376C82D70827297"  // First token
  ];

  const LaunchFactory = await ethers.getContractFactory("LaunchFactory");
  const factory = LaunchFactory.attach(factoryAddress);
  
  for (const tokenAddress of tokens) {
    console.log(`\n=== Checking token: ${tokenAddress} ===`);
    
    try {
      const info = await factory.getTokenInfo(tokenAddress);
      console.log("Creator:", info.creator);
      console.log("Bonding Curve:", info.bondingCurve);
      
      // Check if bonding curve exists
      const bcCode = await ethers.provider.getCode(info.bondingCurve);
      console.log("BC has code:", bcCode.length > 2);
      
      if (bcCode.length > 2) {
        // Try minimal functions
        const minimalABI = [
          "function getCurrentPrice() view returns (uint256)",
          "function calculateTokensOut(uint256) view returns (uint256)"
        ];
        
        const bondingCurve = new ethers.Contract(info.bondingCurve, minimalABI, ethers.provider);
        
        try {
          const price = await bondingCurve.getCurrentPrice();
          console.log("✓ getCurrentPrice works:", ethers.formatEther(price), "ETH");
        } catch (e: any) {
          console.log("✗ getCurrentPrice failed:", e.code);
        }
        
        try {
          const tokens = await bondingCurve.calculateTokensOut(ethers.parseEther("0.01"));
          console.log("✓ calculateTokensOut works:", ethers.formatEther(tokens), "tokens");
        } catch (e: any) {
          console.log("✗ calculateTokensOut failed:", e.code);
        }
      }
    } catch (error: any) {
      console.log("Token not in factory or error:", error.message);
    }
  }
  
  // Get all tokens from factory
  console.log("\n=== All tokens in factory ===");
  const allTokens = await factory.getAllTokens();
  console.log("Total tokens:", allTokens.length);
  for (const token of allTokens) {
    console.log("-", token);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
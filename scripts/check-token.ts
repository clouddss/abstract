import { ethers } from "hardhat";

async function main() {
  const tokenAddress = "0x39315cd8826d41739216fa83535af88fd4fdb810";
  const factoryAddress = "0x8cD80fb9885e3a66BAF5F0758541f95b629B651E";

  console.log("Checking token:", tokenAddress);
  console.log("Using factory:", factoryAddress);

  // Get the factory contract
  const LaunchFactory = await ethers.getContractFactory("LaunchFactory");
  const factory = LaunchFactory.attach(factoryAddress);

  try {
    // Get token info
    const info = await factory.getTokenInfo(tokenAddress);
    console.log("\nToken Info:");
    console.log("- Name:", info.metadata.name);
    console.log("- Symbol:", info.metadata.symbol);
    console.log("- Creator:", info.creator);
    console.log("- Bonding Curve:", info.bondingCurve);
    console.log("- Migrated:", info.migrated);

    // Check if bonding curve exists
    const bcCode = await ethers.provider.getCode(info.bondingCurve);
    console.log("\nBonding curve contract exists:", bcCode.length > 2);

    if (bcCode.length > 2) {
      // Try to interact with bonding curve
      const BondingCurve = await ethers.getContractFactory("BondingCurve");
      const bondingCurve = BondingCurve.attach(info.bondingCurve);

      const stats = await bondingCurve.getCurveStats();
      console.log("\nBonding Curve Stats:");
      console.log("- Current Price:", ethers.formatEther(stats.currentPrice), "ETH");
      console.log("- Tokens Sold:", ethers.formatEther(stats.tokensSold_));
      console.log("- Reserve Balance:", ethers.formatEther(stats.reserveBalance_), "ETH");
      console.log("- Market Cap:", ethers.formatEther(stats.marketCap), "ETH");
      console.log("- Completed:", stats.completed_);
    }
  } catch (error: any) {
    console.error("Error:", error.message);
    
    // Check if token exists in factory
    const allTokens = await factory.getAllTokens();
    console.log("\nAll tokens in factory:", allTokens);
    console.log("Token exists in factory:", allTokens.includes(tokenAddress));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
import { ethers } from "hardhat";

async function main() {
  const bondingCurveAddress = "0xE8584d43748546cA0C91aBCc668D9c81CE84C21A";
  
  console.log("Testing bonding curve:", bondingCurveAddress);

  // Check contract bytecode
  const code = await ethers.provider.getCode(bondingCurveAddress);
  console.log("Contract exists:", code.length > 2);
  console.log("Bytecode length:", code.length);

  // Try basic functions
  try {
    // Try with minimal ABI
    const minimalABI = [
      "function getCurrentPrice() view returns (uint256)",
      "function calculateTokensOut(uint256) view returns (uint256)",
      "function calculateEthOut(uint256) view returns (uint256)",
      "function buyTokens(uint256) payable returns (uint256)",
      "function sellTokens(uint256, uint256) returns (uint256)"
    ];

    const bondingCurve = new ethers.Contract(bondingCurveAddress, minimalABI, ethers.provider);

    // Try to get current price
    try {
      const price = await bondingCurve.getCurrentPrice();
      console.log("Current price:", ethers.formatEther(price), "ETH");
    } catch (e: any) {
      console.log("getCurrentPrice failed:", e.message);
    }

    // Try to calculate tokens for 0.01 ETH
    try {
      const ethAmount = ethers.parseEther("0.01");
      const tokensOut = await bondingCurve.calculateTokensOut(ethAmount);
      console.log("Tokens for 0.01 ETH:", ethers.formatEther(tokensOut));
    } catch (e: any) {
      console.log("calculateTokensOut failed:", e.message);
    }

  } catch (error: any) {
    console.error("Error setting up contract:", error.message);
  }

  // Let's also check the other token
  console.log("\n--- Checking first token ---");
  const firstTokenAddress = "0x89A637a78d68ddF06046CDeca376C82D70827297";
  
  const LaunchFactory = await ethers.getContractFactory("LaunchFactory");
  const factory = LaunchFactory.attach("0x8cD80fb9885e3a66BAF5F0758541f95b629B651E");
  
  try {
    const info = await factory.getTokenInfo(firstTokenAddress);
    console.log("First token bonding curve:", info.bondingCurve);
    
    const bcCode = await ethers.provider.getCode(info.bondingCurve);
    console.log("First token BC exists:", bcCode.length > 2);
  } catch (e: any) {
    console.log("Error getting first token info:", e.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
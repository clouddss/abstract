import { ethers, network, run } from "hardhat";

async function main() {
  console.log("🚀 Starting simple deployment to Abstract testnet...");
  
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "ETH\n");

  try {
    // First, let's try deploying just the BaseToken to test
    console.log("1️⃣ Testing with BaseToken deployment...");
    const BaseToken = await ethers.getContractFactory("BaseToken");
    
    // Deploy with constructor parameters
    const metadata = {
      name: "Test Token",
      symbol: "TEST",
      description: "Test deployment",
      imageUrl: "",
      website: "",
      twitter: "",
      telegram: ""
    };
    
    const baseToken = await BaseToken.deploy(
      "Test Token",     // name
      "TEST",          // symbol
      metadata,        // metadata struct
      deployer.address, // creator
      deployer.address  // bondingCurve (using deployer as placeholder)
    );
    
    await baseToken.waitForDeployment();
    const tokenAddress = await baseToken.getAddress();
    console.log("✅ BaseToken deployed to:", tokenAddress);

    // If BaseToken works, try BondingCurve
    console.log("\n2️⃣ Deploying BondingCurve...");
    const BondingCurve = await ethers.getContractFactory("BondingCurve");
    const bondingCurve = await BondingCurve.deploy(
      tokenAddress,      // token address (using the one we just deployed)
      deployer.address,  // creator
      deployer.address,  // factory (using deployer as placeholder)
      deployer.address   // platform treasury
    );
    await bondingCurve.waitForDeployment();
    const bondingCurveAddress = await bondingCurve.getAddress();
    console.log("✅ BondingCurve deployed to:", bondingCurveAddress);

    // Now try LaunchFactory with explicit constructor if needed
    console.log("\n3️⃣ Deploying LaunchFactory...");
    const LaunchFactory = await ethers.getContractFactory("LaunchFactory");
    
    // Check if LaunchFactory needs constructor params
    const launchFactory = await LaunchFactory.deploy();
    await launchFactory.waitForDeployment();
    const factoryAddress = await launchFactory.getAddress();
    console.log("✅ LaunchFactory deployed to:", factoryAddress);

    // Set platform treasury after deployment
    console.log("\n4️⃣ Setting platform treasury...");
    await launchFactory.setPlatformTreasury(deployer.address);
    console.log("✅ Platform treasury set to:", deployer.address);

    console.log("\n🎉 Deployment successful!");
    console.log("\n=================================");
    console.log("DEPLOYED CONTRACTS:");
    console.log("=================================");
    console.log(`TEST_TOKEN=${tokenAddress}`);
    console.log(`BONDING_CURVE=${bondingCurveAddress}`);
    console.log(`LAUNCH_FACTORY=${factoryAddress}`);
    console.log("=================================\n");

  } catch (error: any) {
    console.error("\n❌ Deployment failed:");
    console.error("Error:", error.message);
    
    if (error.data) {
      console.error("Error data:", error.data);
    }
    
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
    
    // Try to decode the error
    if (error.error && error.error.data) {
      console.error("Revert data:", error.error.data);
    }
    
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
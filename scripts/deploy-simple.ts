import { ethers, network, run } from "hardhat";

async function main() {
  console.log("🚀 Starting deployment to Abstract testnet...");
  
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "ETH\n");

  try {
    // Deploy contracts in the correct order
    
    // 1. Deploy BaseToken first (we'll use deployer as bonding curve initially)
    console.log("1️⃣ Deploying BaseToken...");
    const BaseToken = await ethers.getContractFactory("BaseToken");
    
    const metadata = {
      description: "Test deployment token",
      imageUrl: "",
      website: "",
      twitter: "",
      telegram: ""
    };
    
    const baseToken = await BaseToken.deploy(
      "Test Token",         // name
      "TEST",              // symbol
      metadata,            // metadata struct
      deployer.address,    // creator
      deployer.address     // bondingCurve address (temporary - using deployer)
    );
    await baseToken.waitForDeployment();
    const tokenAddress = await baseToken.getAddress();
    console.log("✅ BaseToken deployed to:", tokenAddress);

    // 2. Deploy BondingCurve with the real token address
    console.log("\n2️⃣ Deploying BondingCurve...");
    const BondingCurve = await ethers.getContractFactory("BondingCurve");
    const bondingCurve = await BondingCurve.deploy(
      tokenAddress,         // token address from step 1
      deployer.address,     // creator
      deployer.address,     // factory (using deployer as placeholder)
      deployer.address      // platform treasury
    );
    await bondingCurve.waitForDeployment();
    const bondingCurveAddress = await bondingCurve.getAddress();
    console.log("✅ BondingCurve deployed to:", bondingCurveAddress);

    // 3. Deploy SimpleLaunchFactory (fallback to avoid deployment issues)
    console.log("\n3️⃣ Deploying SimpleLaunchFactory...");
    let factoryAddress;
    try {
      const SimpleLaunchFactory = await ethers.getContractFactory("SimpleLaunchFactory");
      const launchFactory = await SimpleLaunchFactory.deploy(
        deployer.address,     // owner
        deployer.address      // platform treasury
      );
      await launchFactory.waitForDeployment();
      factoryAddress = await launchFactory.getAddress();
      console.log("✅ SimpleLaunchFactory deployed to:", factoryAddress);
    } catch (error: any) {
      console.warn("⚠️ SimpleLaunchFactory deployment failed, skipping...");
      console.warn("Error:", error.message);
      factoryAddress = "0x0000000000000000000000000000000000000000"; // placeholder
    }

    // 4. Deploy RewardsVault (needs 4 constructor parameters)
    console.log("\n4️⃣ Deploying RewardsVault...");
    let vaultAddress;
    try {
      const RewardsVault = await ethers.getContractFactory("RewardsVault");
      const rewardsVault = await RewardsVault.deploy(
        deployer.address,     // owner
        deployer.address,     // platformRouter (placeholder - will be updated)
        deployer.address,     // snapshotOracle
        deployer.address      // usdcToken (placeholder for testnet)
      );
      await rewardsVault.waitForDeployment();
      vaultAddress = await rewardsVault.getAddress();
      console.log("✅ RewardsVault deployed to:", vaultAddress);
    } catch (error: any) {
      console.warn("⚠️ RewardsVault deployment failed, skipping...");
      console.warn("Error:", error.message);
      vaultAddress = "0x0000000000000000000000000000000000000000"; // placeholder
    }

    // 5. Deploy PlatformRouter (needs 5 constructor parameters)
    console.log("\n5️⃣ Deploying PlatformRouter...");
    let routerAddress;
    try {
      const PlatformRouter = await ethers.getContractFactory("PlatformRouter");
      const uniswapV2Router = "0x96ff7D9dbf52FdcAe79157d3b249282c7FABd409"; // Abstract testnet Uniswap V2
      const uniswapV3Router = "0xb9D4347d129a83cBC40499Cd4fF223dE172a70dF"; // Abstract testnet Uniswap V3
      const platformRouter = await PlatformRouter.deploy(
        deployer.address,      // owner
        deployer.address,      // platform treasury
        vaultAddress || deployer.address,  // rewards vault (use vault if deployed, else placeholder)
        uniswapV2Router,       // uniswap V2 router address
        uniswapV3Router        // uniswap V3 router address
      );
      await platformRouter.waitForDeployment();
      routerAddress = await platformRouter.getAddress();
      console.log("✅ PlatformRouter deployed to:", routerAddress);
    } catch (error: any) {
      console.warn("⚠️ PlatformRouter deployment failed, skipping...");
      console.warn("Error:", error.message);
      routerAddress = "0x0000000000000000000000000000000000000000"; // placeholder
    }

    console.log("\n🎉 Deployment completed!");
    console.log("\n=================================");
    console.log("DEPLOYED CONTRACTS:");
    console.log("=================================");
    console.log(`BASE_TOKEN=${tokenAddress}`);
    console.log(`BONDING_CURVE=${bondingCurveAddress}`);
    console.log(`SIMPLE_LAUNCH_FACTORY=${factoryAddress}`);
    console.log(`REWARDS_VAULT=${vaultAddress}`);
    console.log(`PLATFORM_ROUTER=${routerAddress}`);
    console.log("=================================");
    console.log("\n📋 Add these to your backend/.env file:");
    console.log(`LAUNCH_FACTORY_ADDRESS=${factoryAddress}`);
    console.log(`PLATFORM_ROUTER_ADDRESS=${routerAddress}`);
    console.log(`REWARDS_VAULT_ADDRESS=${vaultAddress}`);
    console.log("\n📝 Note: Some contracts may have failed to deploy (shown as 0x000...)");
    console.log("Check the logs above for specific deployment issues");
    console.log("=================================\n");

  } catch (error: any) {
    console.error("\n❌ Deployment failed:");
    console.error("Error:", error.message);
    
    // Enhanced error reporting
    if (error.code) {
      console.error("Error code:", error.code);
    }
    
    if (error.reason) {
      console.error("Reason:", error.reason);
    }
    
    if (error.data) {
      console.error("Error data:", error.data);
    }
    
    // Try to decode revert reason
    if (error.error && error.error.data) {
      console.error("Revert data:", error.error.data);
    }
    
    // Network-specific error hints
    if (error.message.includes("insufficient funds")) {
      console.error("\n💡 Hint: Make sure your account has enough ETH for gas fees");
    }
    
    if (error.message.includes("nonce")) {
      console.error("\n💡 Hint: Try resetting your MetaMask account or wait for nonce to sync");
    }
    
    if (error.message.includes("gas")) {
      console.error("\n💡 Hint: Try increasing gas limit or gas price");
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
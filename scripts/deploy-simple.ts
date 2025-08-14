import { ethers, network, run } from "hardhat";

async function main() {
  console.log("🚀 Starting deployment to Abstract testnet...");
  
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "ETH\n");

  try {
    // Deploy contracts in the correct order to handle circular dependencies
    
    // 1. Deploy BondingCurve first with address(0) as token parameter
    console.log("1️⃣ Deploying BondingCurve (with placeholder token address)...");
    const BondingCurve = await ethers.getContractFactory("BondingCurve");
    const bondingCurve = await BondingCurve.deploy(
      ethers.ZeroAddress,   // token address (placeholder - will be updated)
      deployer.address,     // creator
      deployer.address,     // factory (using deployer as placeholder)
      deployer.address      // platform treasury
    );
    await bondingCurve.waitForDeployment();
    const bondingCurveAddress = await bondingCurve.getAddress();
    console.log("✅ BondingCurve deployed to:", bondingCurveAddress);

    // 2. Deploy BaseToken with the bonding curve address
    console.log("\n2️⃣ Deploying BaseToken...");
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
      bondingCurveAddress  // bondingCurve address
    );
    await baseToken.waitForDeployment();
    const tokenAddress = await baseToken.getAddress();
    console.log("✅ BaseToken deployed to:", tokenAddress);

    // 3. Update BondingCurve with the correct token address
    console.log("\n3️⃣ Updating BondingCurve with token address...");
    await bondingCurve.updateTokenAddress(tokenAddress);
    console.log("✅ BondingCurve token address updated");

    // 4. Deploy LaunchFactory
    console.log("\n4️⃣ Deploying LaunchFactory...");
    const LaunchFactory = await ethers.getContractFactory("LaunchFactory");
    const launchFactory = await LaunchFactory.deploy(
      deployer.address,     // owner
      deployer.address      // platform treasury
    );
    await launchFactory.waitForDeployment();
    const factoryAddress = await launchFactory.getAddress();
    console.log("✅ LaunchFactory deployed to:", factoryAddress);

    // 5. Deploy RewardsVault first (it needs platform router but we can update it later)
    console.log("\n5️⃣ Deploying RewardsVault...");
    const RewardsVault = await ethers.getContractFactory("RewardsVault");
    const rewardsVault = await RewardsVault.deploy(
      deployer.address,     // owner
      deployer.address,     // platform router (temporary - will update)
      deployer.address,     // snapshot oracle
      deployer.address      // USDC token (using deployer as placeholder for testnet)
    );
    await rewardsVault.waitForDeployment();
    const vaultAddress = await rewardsVault.getAddress();
    console.log("✅ RewardsVault deployed to:", vaultAddress);

    // 6. Deploy PlatformRouter with RewardsVault address
    console.log("\n6️⃣ Deploying PlatformRouter...");
    const PlatformRouter = await ethers.getContractFactory("PlatformRouter");
    const platformRouter = await PlatformRouter.deploy(
      deployer.address,     // owner
      deployer.address,     // platform treasury
      vaultAddress,         // rewards vault
      deployer.address,     // uniswap V2 router (using deployer as placeholder for testnet)
      deployer.address      // uniswap V3 router (using deployer as placeholder for testnet)
    );
    await platformRouter.waitForDeployment();
    const routerAddress = await platformRouter.getAddress();
    console.log("✅ PlatformRouter deployed to:", routerAddress);

    // 7. Update RewardsVault with correct PlatformRouter address
    console.log("\n7️⃣ Updating RewardsVault with correct PlatformRouter address...");
    await rewardsVault.updatePlatformRouter(routerAddress);
    console.log("✅ RewardsVault updated with correct PlatformRouter address");

    console.log("\n🎉 All contracts deployed successfully!");
    console.log("\n=================================");
    console.log("DEPLOYED CONTRACTS:");
    console.log("=================================");
    console.log(`Network: ${network.name} (chainId: ${(await ethers.provider.getNetwork()).chainId})`);
    console.log(`Deployer: ${deployer.address}`);
    console.log("");
    console.log(`BONDING_CURVE=${bondingCurveAddress}`);
    console.log(`BASE_TOKEN=${tokenAddress}`);
    console.log(`LAUNCH_FACTORY=${factoryAddress}`);
    console.log(`PLATFORM_ROUTER=${routerAddress}`);
    console.log(`REWARDS_VAULT=${vaultAddress}`);
    console.log("=================================");
    console.log("");
    console.log("📋 Configuration Summary:");
    console.log(`- BondingCurve is linked to BaseToken: ${tokenAddress}`);
    console.log(`- BaseToken mints to BondingCurve: ${bondingCurveAddress}`);
    console.log(`- LaunchFactory treasury: ${deployer.address}`);
    console.log(`- PlatformRouter treasury: ${deployer.address}`);
    console.log(`- RewardsVault oracle: ${deployer.address}`);
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
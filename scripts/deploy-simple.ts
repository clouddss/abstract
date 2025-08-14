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

    // 3. Deploy LaunchFactory
    console.log("\n3️⃣ Deploying LaunchFactory...");
    const LaunchFactory = await ethers.getContractFactory("LaunchFactory");
    const launchFactory = await LaunchFactory.deploy(
      deployer.address,     // owner
      deployer.address      // platform treasury
    );
    await launchFactory.waitForDeployment();
    const factoryAddress = await launchFactory.getAddress();
    console.log("✅ LaunchFactory deployed to:", factoryAddress);

    // 4. Deploy RewardsVault (no constructor parameters based on the contract)
    console.log("\n4️⃣ Deploying RewardsVault...");
    const RewardsVault = await ethers.getContractFactory("RewardsVault");
    const rewardsVault = await RewardsVault.deploy();
    await rewardsVault.waitForDeployment();
    const vaultAddress = await rewardsVault.getAddress();
    console.log("✅ RewardsVault deployed to:", vaultAddress);

    // 5. Deploy PlatformRouter
    console.log("\n5️⃣ Deploying PlatformRouter...");
    const PlatformRouter = await ethers.getContractFactory("PlatformRouter");
    const uniswapV2Router = "0x96ff7D9dbf52FdcAe79157d3b249282c7FABd409"; // Abstract testnet Uniswap V2
    const platformRouter = await PlatformRouter.deploy(
      uniswapV2Router,      // uniswap V2 router address
      deployer.address      // platform treasury
    );
    await platformRouter.waitForDeployment();
    const routerAddress = await platformRouter.getAddress();
    console.log("✅ PlatformRouter deployed to:", routerAddress);

    console.log("\n🎉 All contracts deployed successfully!");
    console.log("\n=================================");
    console.log("DEPLOYED CONTRACTS:");
    console.log("=================================");
    console.log(`BASE_TOKEN=${tokenAddress}`);
    console.log(`BONDING_CURVE=${bondingCurveAddress}`);
    console.log(`LAUNCH_FACTORY=${factoryAddress}`);
    console.log(`REWARDS_VAULT=${vaultAddress}`);
    console.log(`PLATFORM_ROUTER=${routerAddress}`);
    console.log("=================================");
    console.log("\n📋 Add these to your backend/.env file:");
    console.log(`LAUNCH_FACTORY_ADDRESS=${factoryAddress}`);
    console.log(`PLATFORM_ROUTER_ADDRESS=${routerAddress}`);
    console.log(`REWARDS_VAULT_ADDRESS=${vaultAddress}`);
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
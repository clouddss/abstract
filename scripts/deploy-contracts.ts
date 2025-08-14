import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying Abstract Pump Platform contracts...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deployer address:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "ETH\n");

  if (balance < ethers.parseEther("0.01")) {
    throw new Error("Insufficient balance! Need at least 0.01 ETH");
  }

  const deployedContracts: any = {};

  try {
    // 1. Deploy LaunchFactory
    console.log("1️⃣  Deploying LaunchFactory...");
    const LaunchFactory = await ethers.getContractFactory("LaunchFactory");
    const launchFactory = await LaunchFactory.deploy(
      deployer.address,  // owner
      deployer.address   // platform treasury
    );
    await launchFactory.waitForDeployment();
    deployedContracts.launchFactory = await launchFactory.getAddress();
    console.log("   ✅ LaunchFactory deployed to:", deployedContracts.launchFactory);

    // 2. Deploy PlatformRouter
    console.log("\n2️⃣  Deploying PlatformRouter...");
    const PlatformRouter = await ethers.getContractFactory("PlatformRouter");
    
    // Check PlatformRouter constructor parameters
    // constructor(address uniswapV2Router_, address platformTreasury_)
    const uniswapV2Router = "0x96ff7D9dbf52FdcAe79157d3b249282c7FABd409"; // Abstract testnet Uniswap V2
    
    const platformRouter = await PlatformRouter.deploy(
      uniswapV2Router,
      deployer.address   // platform treasury
    );
    await platformRouter.waitForDeployment();
    deployedContracts.platformRouter = await platformRouter.getAddress();
    console.log("   ✅ PlatformRouter deployed to:", deployedContracts.platformRouter);

    // 3. Deploy RewardsVault
    console.log("\n3️⃣  Deploying RewardsVault...");
    const RewardsVault = await ethers.getContractFactory("RewardsVault");
    
    // Check RewardsVault constructor - it might need parameters
    // If it has no constructor params, deploy without arguments
    const rewardsVault = await RewardsVault.deploy();
    await rewardsVault.waitForDeployment();
    deployedContracts.rewardsVault = await rewardsVault.getAddress();
    console.log("   ✅ RewardsVault deployed to:", deployedContracts.rewardsVault);

    // 4. Deploy a sample BondingCurve template (optional)
    console.log("\n4️⃣  Deploying BondingCurve template...");
    
    // First deploy a dummy token for the template
    const BaseToken = await ethers.getContractFactory("BaseToken");
    const metadata = {
      name: "Template",
      symbol: "TMPL",
      description: "Template token",
      imageUrl: "",
      website: "",
      twitter: "",
      telegram: ""
    };
    
    const templateToken = await BaseToken.deploy(
      "Template Token",
      "TMPL",
      metadata,
      deployer.address,
      deployer.address
    );
    await templateToken.waitForDeployment();
    const templateTokenAddress = await templateToken.getAddress();
    
    const BondingCurve = await ethers.getContractFactory("BondingCurve");
    const bondingCurveTemplate = await BondingCurve.deploy(
      templateTokenAddress,
      deployer.address,  // creator
      deployedContracts.launchFactory,  // factory
      deployer.address   // platform treasury
    );
    await bondingCurveTemplate.waitForDeployment();
    deployedContracts.bondingCurveTemplate = await bondingCurveTemplate.getAddress();
    console.log("   ✅ BondingCurve template deployed to:", deployedContracts.bondingCurveTemplate);

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("🎉 DEPLOYMENT SUCCESSFUL!");
    console.log("=".repeat(60));
    console.log("\n📋 Contract Addresses for backend/.env:\n");
    console.log(`LAUNCH_FACTORY_ADDRESS=${deployedContracts.launchFactory}`);
    console.log(`PLATFORM_ROUTER_ADDRESS=${deployedContracts.platformRouter}`);
    console.log(`REWARDS_VAULT_ADDRESS=${deployedContracts.rewardsVault}`);
    console.log(`BONDING_CURVE_TEMPLATE=${deployedContracts.bondingCurveTemplate}`);
    console.log("\n" + "=".repeat(60));

    // Save to file
    const fs = require('fs');
    const deploymentData = {
      network: "abstract-testnet",
      chainId: 11124,
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      contracts: deployedContracts
    };

    if (!fs.existsSync('./deployments')) {
      fs.mkdirSync('./deployments');
    }

    fs.writeFileSync(
      './deployments/abstract-testnet.json',
      JSON.stringify(deploymentData, null, 2)
    );
    console.log("\n💾 Deployment data saved to deployments/abstract-testnet.json");

  } catch (error: any) {
    console.error("\n❌ Deployment failed:");
    console.error("Error:", error.message);
    
    if (error.reason) {
      console.error("Reason:", error.reason);
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
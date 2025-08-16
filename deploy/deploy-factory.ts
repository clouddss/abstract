import { Wallet } from "zksync-ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync";
import * as fs from "fs";
import * as path from "path";

// ANSI color codes for better output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m"
};

export default async function (hre: HardhatRuntimeEnvironment) {
  console.log(`\n${colors.cyan}${colors.bright}🚀 Abstract Token Launch Platform - zkSync Deployment${colors.reset}\n`);
  console.log("=" .repeat(60));

  // Initialize wallet from private key
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Please set PRIVATE_KEY in your .env file");
  }

  const wallet = new Wallet(privateKey);
  console.log(`${colors.blue}📝 Deployer address:${colors.reset} ${wallet.address}`);

  // Create deployer object
  const deployer = new Deployer(hre, wallet);
  
  // Check deployer balance
  const balance = await deployer.zkWallet.getBalance();
  console.log(`${colors.blue}💰 Deployer balance:${colors.reset} ${hre.ethers.formatEther(balance)} ETH`);

  if (balance < hre.ethers.parseEther("0.03")) {
    console.log(`${colors.red}❌ Insufficient balance. Need at least 0.03 ETH for deployment.${colors.reset}`);
    process.exit(1);
  }

  console.log("\n" + "=" .repeat(60) + "\n");

  // Contract addresses object
  const deployedContracts: any = {
    network: "abstract-testnet",
    chainId: 11124,
    deployedAt: new Date().toISOString(),
    deployer: wallet.address,
    contracts: {}
  };

  try {
    // Step 1: Deploy LaunchFactoryLib
    console.log(`${colors.yellow}📦 Step 1: Deploying LaunchFactoryLib...${colors.reset}`);
    const libArtifact = await deployer.loadArtifact("LaunchFactoryLib");
    const launchFactoryLib = await deployer.deploy(libArtifact);
    await launchFactoryLib.waitForDeployment();
    const libAddress = await launchFactoryLib.getAddress();
    console.log(`${colors.green}✅ LaunchFactoryLib deployed to:${colors.reset} ${libAddress}`);
    deployedContracts.contracts.LaunchFactoryLib = libAddress;

    // Step 2: Deploy LaunchFactory
    console.log(`\n${colors.yellow}📦 Step 2: Deploying LaunchFactory...${colors.reset}`);
    const factoryArtifact = await deployer.loadArtifact("LaunchFactory");
    
    // Deploy with constructor arguments
    const factory = await deployer.deploy(factoryArtifact, [
      wallet.address,  // owner
      wallet.address   // platform treasury (can be changed later)
    ]);
    
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log(`${colors.green}✅ LaunchFactory deployed to:${colors.reset} ${factoryAddress}`);
    deployedContracts.contracts.LaunchFactory = factoryAddress;

    // Step 3: Verify deployment
    console.log(`\n${colors.yellow}📋 Step 3: Verifying deployment...${colors.reset}`);
    
    const launchFee = await factory.launchFee();
    const treasury = await factory.platformTreasury();
    const owner = await factory.owner();
    
    console.log(`${colors.blue}  • Launch Fee:${colors.reset} ${hre.ethers.formatEther(launchFee)} ETH`);
    console.log(`${colors.blue}  • Treasury:${colors.reset} ${treasury}`);
    console.log(`${colors.blue}  • Owner:${colors.reset} ${owner}`);

    // Step 4: Save deployment info
    console.log(`\n${colors.yellow}📁 Step 4: Saving deployment info...${colors.reset}`);
    
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    const filename = `deployment-${Date.now()}.json`;
    const filepath = path.join(deploymentsDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(deployedContracts, null, 2));
    console.log(`${colors.green}✅ Deployment info saved to:${colors.reset} ${filepath}`);
    
    // Also save as latest
    const latestPath = path.join(deploymentsDir, "latest.json");
    fs.writeFileSync(latestPath, JSON.stringify(deployedContracts, null, 2));

    // Step 5: Display summary
    console.log("\n" + "=" .repeat(60));
    console.log(`${colors.green}${colors.bright}🎉 DEPLOYMENT SUCCESSFUL!${colors.reset}`);
    console.log("=" .repeat(60) + "\n");
    
    console.log(`${colors.bright}📋 Summary:${colors.reset}`);
    console.log(`  • LaunchFactoryLib: ${libAddress}`);
    console.log(`  • LaunchFactory: ${factoryAddress}`);
    console.log(`  • Launch Fee: ${hre.ethers.formatEther(launchFee)} ETH`);
    
    console.log(`\n${colors.bright}📝 Environment Variables:${colors.reset}`);
    console.log(`${colors.cyan}
# Add these to your backend .env file:
LAUNCH_FACTORY_ADDRESS=${factoryAddress}
LAUNCH_FACTORY_LIB_ADDRESS=${libAddress}
PLATFORM_TREASURY=${treasury}
${colors.reset}`);
    
    console.log(`${colors.bright}📌 Next Steps:${colors.reset}`);
    console.log("  1. Update backend with new contract addresses");
    console.log("  2. Run: cd backend && npm run build");
    console.log("  3. Run: pm2 restart backend");
    console.log("  4. Clear browser cache and test token launch");
    
    console.log(`\n${colors.bright}🔗 Useful Links:${colors.reset}`);
    console.log(`  • Explorer: https://sepolia.abscan.org/address/${factoryAddress}`);
    console.log(`  • Frontend: https://blastabs.fun`);
    console.log(`  • Launch Page: https://blastabs.fun/launch`);

  } catch (error: any) {
    console.error(`\n${colors.red}❌ Deployment failed:${colors.reset}`, error.message);
    if (error.reason) {
      console.error(`${colors.red}Reason:${colors.reset}`, error.reason);
    }
    
    // Save partial deployment if any contracts were deployed
    if (Object.keys(deployedContracts.contracts).length > 0) {
      const deploymentsDir = path.join(__dirname, "../deployments");
      if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
      }
      const filename = `partial-deployment-${Date.now()}.json`;
      const filepath = path.join(deploymentsDir, filename);
      fs.writeFileSync(filepath, JSON.stringify(deployedContracts, null, 2));
      console.log(`\n${colors.yellow}⚠️  Partial deployment saved to:${colors.reset} ${filepath}`);
    }
    
    process.exit(1);
  }
}
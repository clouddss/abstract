import { ethers } from "hardhat";
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

async function main() {
  console.log(`\n${colors.cyan}${colors.bright}🚀 Abstract Token Launch Platform - Full Deployment${colors.reset}\n`);
  console.log("=" .repeat(60));

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`${colors.blue}📝 Deployer address:${colors.reset} ${deployer.address}`);
  
  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`${colors.blue}💰 Deployer balance:${colors.reset} ${ethers.formatEther(balance)} ETH`);
  
  if (balance < ethers.parseEther("0.03")) {
    console.log(`${colors.red}❌ Insufficient balance. Need at least 0.03 ETH for deployment.${colors.reset}`);
    process.exit(1);
  }

  console.log("\n" + "=" .repeat(60) + "\n");

  // Contract addresses object to store all deployed addresses
  const deployedContracts: any = {
    network: "abstract-testnet",
    chainId: 11124,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {}
  };

  try {
    // Step 1: Deploy LaunchFactory
    console.log(`${colors.yellow}📦 Step 1: Deploying LaunchFactory...${colors.reset}`);
    const LaunchFactory = await ethers.getContractFactory("LaunchFactory");
    
    // Use deployer as both owner and treasury initially (can be updated later)
    const factory = await LaunchFactory.deploy(
      deployer.address,  // owner
      deployer.address   // platform treasury
    );
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log(`${colors.green}✅ LaunchFactory deployed to:${colors.reset} ${factoryAddress}`);
    deployedContracts.contracts.LaunchFactory = factoryAddress;

    // Step 2: Verify deployment configuration
    console.log(`\n${colors.yellow}📋 Step 2: Verifying deployment...${colors.reset}`);
    
    const launchFee = await factory.launchFee();
    const treasury = await factory.platformTreasury();
    const owner = await factory.owner();
    
    console.log(`${colors.blue}  • Launch Fee:${colors.reset} ${ethers.formatEther(launchFee)} ETH`);
    console.log(`${colors.blue}  • Treasury:${colors.reset} ${treasury}`);
    console.log(`${colors.blue}  • Owner:${colors.reset} ${owner}`);
    
    // Step 3: Deploy a test token (optional)
    const deployTestToken = process.env.DEPLOY_TEST_TOKEN === "true";
    if (deployTestToken) {
      console.log(`\n${colors.yellow}📦 Step 3: Deploying test token...${colors.reset}`);
      
      const tokenMetadata = {
        name: "Test Token",
        symbol: "TEST",
        description: "A test token for the Abstract platform",
        imageUrl: "https://example.com/token.png",
        website: "https://example.com",
        twitter: "@testtoken",
        telegram: "@testtoken"
      };
      
      const tx = await factory.launchToken(tokenMetadata, { 
        value: launchFee 
      });
      const receipt = await tx.wait();
      
      // Parse events to get token and bonding curve addresses
      const tokenLaunchedEvent = receipt?.logs.find(
        (log: any) => log.fragment?.name === 'TokenLaunched'
      );
      
      if (tokenLaunchedEvent) {
        const { tokenAddress, bondingCurve } = tokenLaunchedEvent.args;
        console.log(`${colors.green}✅ Test token deployed:${colors.reset}`);
        console.log(`${colors.blue}  • Token:${colors.reset} ${tokenAddress}`);
        console.log(`${colors.blue}  • Bonding Curve:${colors.reset} ${bondingCurve}`);
        
        deployedContracts.contracts.TestToken = {
          token: tokenAddress,
          bondingCurve: bondingCurve
        };
      }
    }

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
    
    // Step 5: Generate environment variables
    console.log(`\n${colors.yellow}📝 Step 5: Environment variables for backend:${colors.reset}`);
    console.log(`${colors.cyan}
# Add these to your backend .env file:
LAUNCH_FACTORY_ADDRESS=${factoryAddress}
PLATFORM_TREASURY=${treasury}
${colors.reset}`);

    // Step 6: Display summary
    console.log("\n" + "=" .repeat(60));
    console.log(`${colors.green}${colors.bright}🎉 DEPLOYMENT SUCCESSFUL!${colors.reset}`);
    console.log("=" .repeat(60) + "\n");
    
    console.log(`${colors.bright}📋 Summary:${colors.reset}`);
    console.log(`  • LaunchFactory: ${factoryAddress}`);
    console.log(`  • Launch Fee: ${ethers.formatEther(launchFee)} ETH`);
    console.log(`  • Total Contracts Deployed: ${Object.keys(deployedContracts.contracts).length}`);
    
    console.log(`\n${colors.bright}📌 Next Steps:${colors.reset}`);
    console.log("  1. Update backend with new contract addresses");
    console.log("  2. Run: cd backend && npm run build");
    console.log("  3. Run: pm2 restart backend");
    console.log("  4. Clear browser cache and test token launch");
    
    console.log(`\n${colors.bright}🔗 Useful Links:${colors.reset}`);
    console.log(`  • Explorer: https://explorer.testnet.abs.xyz/address/${factoryAddress}`);
    console.log(`  • Frontend: https://blastabs.fun`);
    console.log(`  • Launch Page: https://blastabs.fun/launch`);

  } catch (error: any) {
    console.error(`\n${colors.red}❌ Deployment failed:${colors.reset}`, error.message);
    if (error.reason) {
      console.error(`${colors.red}Reason:${colors.reset}`, error.reason);
    }
    if (error.code) {
      console.error(`${colors.red}Error code:${colors.reset}`, error.code);
    }
    if (error.transaction) {
      console.error(`${colors.red}Failed transaction:${colors.reset}`, error.transaction);
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

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
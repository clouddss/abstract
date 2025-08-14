import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Minimal deployment test...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "ETH\n");

  try {
    // Try deploying just PlatformRouter since LaunchFactory is failing
    console.log("Deploying PlatformRouter...");
    const PlatformRouter = await ethers.getContractFactory("PlatformRouter");
    
    const router = await PlatformRouter.deploy(
      "0x96ff7D9dbf52FdcAe79157d3b249282c7FABd409", // Uniswap V2 Router
      deployer.address // treasury
    );
    
    await router.waitForDeployment();
    const routerAddress = await router.getAddress();
    console.log("✅ PlatformRouter:", routerAddress);

    // Try RewardsVault
    console.log("\nDeploying RewardsVault...");
    const RewardsVault = await ethers.getContractFactory("RewardsVault");
    const vault = await RewardsVault.deploy();
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log("✅ RewardsVault:", vaultAddress);

    console.log("\n📋 Addresses:");
    console.log(`PLATFORM_ROUTER_ADDRESS=${routerAddress}`);
    console.log(`REWARDS_VAULT_ADDRESS=${vaultAddress}`);
    
    // For LaunchFactory, we might need to check the contract size or simplify it
    console.log("\n⚠️  LaunchFactory deployment skipped (failing on testnet)");
    console.log("You can use the existing BaseToken for testing: 0x7460E84a9f89BDF62c24a4dD0442651a21D63389");

  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    if (error.data) {
      console.error("Data:", error.data);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
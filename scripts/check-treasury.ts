import { ethers } from "hardhat";

async function main() {
  const LAUNCH_FACTORY = "0xE19264ea91C04A60e7d44fECcDdf70C31b0adeFB";
  
  console.log("🔍 Checking LaunchFactory contract...\n");
  
  // Get the contract
  const LaunchFactory = await ethers.getContractFactory("LaunchFactory");
  const factory = LaunchFactory.attach(LAUNCH_FACTORY);
  
  // Check current settings
  const owner = await factory.owner();
  const treasury = await factory.platformTreasury();
  const launchFee = await factory.launchFee();
  
  console.log("📊 Current Settings:");
  console.log("===================");
  console.log(`Owner: ${owner}`);
  console.log(`Treasury: ${treasury}`);
  console.log(`Launch Fee: ${ethers.formatEther(launchFee)} ETH`);
  
  // Get signer
  const [signer] = await ethers.getSigners();
  console.log(`\nYour address: ${signer.address}`);
  
  if (owner.toLowerCase() === signer.address.toLowerCase()) {
    console.log("✅ You are the owner! You can update the treasury.");
    
    // Example: Update treasury to your address
    // Uncomment to execute:
    /*
    console.log("\n🔄 Updating treasury to your address...");
    const tx = await factory.updatePlatformTreasury(signer.address);
    await tx.wait();
    console.log("✅ Treasury updated!");
    */
  } else {
    console.log("❌ You are not the owner. Cannot update treasury.");
  }
  
  // Check treasury balance
  const treasuryBalance = await ethers.provider.getBalance(treasury);
  console.log(`\n💰 Treasury Balance: ${ethers.formatEther(treasuryBalance)} ETH`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
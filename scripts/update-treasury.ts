import { ethers } from "hardhat";

async function main() {
  const LAUNCH_FACTORY = "0xE19264ea91C04A60e7d44fECcDdf70C31b0adeFB";
  
  console.log("🔄 Updating Platform Treasury...\n");
  
  // Get signer
  const [signer] = await ethers.getSigners();
  console.log("Your address:", signer.address);
  
  // Get the contract
  const LaunchFactory = await ethers.getContractFactory("LaunchFactory");
  const factory = LaunchFactory.attach(LAUNCH_FACTORY);
  
  // Check if we're the owner
  const owner = await factory.owner();
  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error("❌ You are not the owner of this contract!");
    console.error(`Owner is: ${owner}`);
    return;
  }
  
  // Get current treasury
  const currentTreasury = await factory.platformTreasury();
  console.log(`Current treasury: ${currentTreasury}`);
  
  // Update to signer's address
  console.log(`\nUpdating treasury to: ${signer.address}`);
  const tx = await factory.updatePlatformTreasury(signer.address);
  console.log(`Transaction sent: ${tx.hash}`);
  
  // Wait for confirmation
  const receipt = await tx.wait();
  console.log(`✅ Treasury updated in block ${receipt.blockNumber}`);
  
  // Verify the update
  const newTreasury = await factory.platformTreasury();
  console.log(`\nNew treasury: ${newTreasury}`);
  console.log("\n🎉 All future launch fees will be sent to your address!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
import { ethers } from "hardhat";
import { writeFileSync } from "fs";
import { join } from "path";

async function main() {
    console.log("🚀 Starting deployment to Abstract testnet...");

    const [deployer] = await ethers.getSigners();
    console.log("📝 Deploying contracts with account:", deployer.address);
    console.log("💰 Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");

    // Configuration
    const PLATFORM_TREASURY = process.env.PLATFORM_TREASURY_ADDRESS || deployer.address;
    const UNISWAP_V2_ROUTER = process.env.UNISWAP_V2_ROUTER || "0x0000000000000000000000000000000000000000";
    const UNISWAP_V3_ROUTER = process.env.UNISWAP_V3_ROUTER || "0x0000000000000000000000000000000000000000";
    const USDC_TOKEN = process.env.USDC_TOKEN || "0x0000000000000000000000000000000000000000";

    console.log("⚙️  Configuration:");
    console.log("  Platform Treasury:", PLATFORM_TREASURY);
    console.log("  Uniswap V2 Router:", UNISWAP_V2_ROUTER);
    console.log("  Uniswap V3 Router:", UNISWAP_V3_ROUTER);
    console.log("  USDC Token:", USDC_TOKEN);

    // Deploy contracts
    console.log("\n📦 Deploying LaunchFactory...");
    const LaunchFactory = await ethers.getContractFactory("LaunchFactory");
    const launchFactory = await LaunchFactory.deploy(deployer.address, PLATFORM_TREASURY);
    await launchFactory.waitForDeployment();
    const launchFactoryAddress = await launchFactory.getAddress();
    console.log("✅ LaunchFactory deployed to:", launchFactoryAddress);

    console.log("\n📦 Deploying RewardsVault...");
    const RewardsVault = await ethers.getContractFactory("RewardsVault");
    const rewardsVault = await RewardsVault.deploy(
        deployer.address,       // owner
        deployer.address,       // platformRouter (will be updated later)
        deployer.address,       // snapshotOracle
        USDC_TOKEN             // usdcToken
    );
    await rewardsVault.waitForDeployment();
    const rewardsVaultAddress = await rewardsVault.getAddress();
    console.log("✅ RewardsVault deployed to:", rewardsVaultAddress);

    console.log("\n📦 Deploying PlatformRouter...");
    const PlatformRouter = await ethers.getContractFactory("PlatformRouter");
    const platformRouter = await PlatformRouter.deploy(
        deployer.address,       // owner
        PLATFORM_TREASURY,      // platformTreasury
        rewardsVaultAddress,    // rewardsVault
        UNISWAP_V2_ROUTER,     // uniswapV2Router
        UNISWAP_V3_ROUTER      // uniswapV3Router
    );
    await platformRouter.waitForDeployment();
    const platformRouterAddress = await platformRouter.getAddress();
    console.log("✅ PlatformRouter deployed to:", platformRouterAddress);

    // Update RewardsVault with correct PlatformRouter address
    console.log("\n🔄 Updating RewardsVault configuration...");
    await rewardsVault.updatePlatformRouter(platformRouterAddress);
    console.log("✅ RewardsVault platform router updated");

    // Deploy test helper contracts for verification
    console.log("\n📦 Deploying test helper contracts...");
    const BondingCurveMathTester = await ethers.getContractFactory("BondingCurveMathTester");
    const mathTester = await BondingCurveMathTester.deploy();
    await mathTester.waitForDeployment();
    const mathTesterAddress = await mathTester.getAddress();
    console.log("✅ BondingCurveMathTester deployed to:", mathTesterAddress);

    // Test deployment by launching a demo token
    console.log("\n🧪 Testing deployment with demo token...");
    const demoMetadata = {
        name: "Demo Token",
        symbol: "DEMO",
        description: "A demo token to test the platform",
        imageUrl: "https://via.placeholder.com/200",
        website: "https://abstract.money",
        twitter: "@AbstractChain",
        telegram: "AbstractChain"
    };

    const launchFee = await launchFactory.getLaunchFee();
    console.log("💸 Launch fee:", ethers.formatEther(launchFee), "ETH");

    const launchTx = await launchFactory.launchToken(demoMetadata, {
        value: launchFee
    });
    const launchReceipt = await launchTx.wait();

    // Find the TokenLaunched event
    const tokenLaunchedEvent = launchReceipt?.logs.find((log: any) => {
        try {
            const parsed = launchFactory.interface.parseLog(log);
            return parsed?.name === "TokenLaunched";
        } catch {
            return false;
        }
    });

    if (tokenLaunchedEvent) {
        const parsedEvent = launchFactory.interface.parseLog(tokenLaunchedEvent);
        const demoTokenAddress = parsedEvent?.args[0];
        const demoBondingCurve = parsedEvent?.args[2];
        
        console.log("✅ Demo token deployed to:", demoTokenAddress);
        console.log("✅ Demo bonding curve deployed to:", demoBondingCurve);

        // Test a small purchase
        console.log("\n🛒 Testing token purchase...");
        const bondingCurve = await ethers.getContractAt("BondingCurve", demoBondingCurve);
        const purchaseAmount = ethers.parseEther("0.1");
        
        const purchaseTx = await bondingCurve.buyTokens(0, { value: purchaseAmount });
        await purchaseTx.wait();
        console.log("✅ Test purchase completed");

        // Check token balance
        const demoToken = await ethers.getContractAt("BaseToken", demoTokenAddress);
        const balance = await demoToken.balanceOf(deployer.address);
        console.log("🪙 Received tokens:", ethers.formatEther(balance));
    }

    // Create deployment summary
    const deploymentInfo = {
        network: "abstract-testnet",
        chainId: 11124,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        gasUsed: {
            // These would be calculated from transaction receipts in a full implementation
            total: "~2,000,000",
            launchFactory: "~800,000",
            rewardsVault: "~600,000",
            platformRouter: "~600,000"
        },
        contracts: {
            LaunchFactory: launchFactoryAddress,
            RewardsVault: rewardsVaultAddress,
            PlatformRouter: platformRouterAddress,
            BondingCurveMathTester: mathTesterAddress
        },
        configuration: {
            platformTreasury: PLATFORM_TREASURY,
            uniswapV2Router: UNISWAP_V2_ROUTER,
            uniswapV3Router: UNISWAP_V3_ROUTER,
            usdcToken: USDC_TOKEN,
            launchFee: ethers.formatEther(launchFee) + " ETH"
        }
    };

    // Save deployment info
    const deploymentPath = join(__dirname, "../deployments/abstract-testnet.json");
    writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("\n📄 Deployment info saved to:", deploymentPath);

    // Print summary
    console.log("\n🎉 Deployment completed successfully!");
    console.log("📋 Contract Addresses:");
    console.log("  LaunchFactory:", launchFactoryAddress);
    console.log("  RewardsVault:", rewardsVaultAddress);
    console.log("  PlatformRouter:", platformRouterAddress);
    console.log("  MathTester:", mathTesterAddress);

    console.log("\n🔗 Verification commands:");
    console.log(`npx hardhat verify --network abstract-testnet ${launchFactoryAddress} "${deployer.address}" "${PLATFORM_TREASURY}"`);
    console.log(`npx hardhat verify --network abstract-testnet ${rewardsVaultAddress} "${deployer.address}" "${platformRouterAddress}" "${deployer.address}" "${USDC_TOKEN}"`);
    console.log(`npx hardhat verify --network abstract-testnet ${platformRouterAddress} "${deployer.address}" "${PLATFORM_TREASURY}" "${rewardsVaultAddress}" "${UNISWAP_V2_ROUTER}" "${UNISWAP_V3_ROUTER}"`);

    console.log("\n📚 Next steps:");
    console.log("1. Verify contracts on Abstract explorer");
    console.log("2. Update frontend configuration with contract addresses");
    console.log("3. Start the backend indexer service");
    console.log("4. Update Uniswap router addresses when available");
    console.log("5. Set up proper USDC token address");
    console.log("6. Configure snapshot oracle for rewards");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment failed:", error);
        process.exit(1);
    });
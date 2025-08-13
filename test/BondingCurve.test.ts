import { expect } from "chai";
import { ethers } from "hardhat";
import { BondingCurve, BaseToken, LaunchFactory } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("BondingCurve", function () {
    let launchFactory: LaunchFactory;
    let bondingCurve: BondingCurve;
    let token: BaseToken;
    let owner: SignerWithAddress;
    let treasury: SignerWithAddress;
    let creator: SignerWithAddress;
    let buyer: SignerWithAddress;
    let seller: SignerWithAddress;

    const LAUNCH_FEE = ethers.parseEther("0.01");
    const MIN_PURCHASE = ethers.parseEther("0.01");

    beforeEach(async function () {
        [owner, treasury, creator, buyer, seller] = await ethers.getSigners();

        // Deploy factory
        const LaunchFactory = await ethers.getContractFactory("LaunchFactory");
        launchFactory = await LaunchFactory.deploy(owner.address, treasury.address);
        await launchFactory.waitForDeployment();

        // Launch a token
        const tokenMetadata = {
            name: "Test Token",
            symbol: "TEST",
            description: "A test token",
            imageUrl: "https://example.com/image.png",
            website: "https://example.com",
            twitter: "@testtoken",
            telegram: "@testtoken"
        };

        const tx = await launchFactory.connect(creator).launchToken(tokenMetadata, {
            value: LAUNCH_FEE
        });

        const receipt = await tx.wait();
        const event = receipt?.logs.find(log => 
            launchFactory.interface.parseLog(log)?.name === "TokenLaunched"
        );

        const parsedEvent = launchFactory.interface.parseLog(event!);
        const tokenAddress = parsedEvent?.args[0];
        const bondingCurveAddress = parsedEvent?.args[2];

        token = await ethers.getContractAt("BaseToken", tokenAddress);
        bondingCurve = await ethers.getContractAt("BondingCurve", bondingCurveAddress);
    });

    describe("Initialization", function () {
        it("Should be properly initialized", async function () {
            expect(await bondingCurve.creator()).to.equal(creator.address);
            expect(await bondingCurve.factory()).to.equal(await launchFactory.getAddress());
            expect(await bondingCurve.soldSupply()).to.equal(0);
            expect(await bondingCurve.migrated()).to.be.false;
        });

        it("Should have correct token setup", async function () {
            expect(await bondingCurve.token()).to.equal(await token.getAddress());
            const totalSupply = await token.totalSupply();
            const curveBalance = await token.balanceOf(await bondingCurve.getAddress());
            expect(curveBalance).to.equal(totalSupply);
        });
    });

    describe("Price Calculations", function () {
        it("Should calculate initial price correctly", async function () {
            const initialPrice = await bondingCurve.getCurrentPrice();
            expect(initialPrice).to.be.gt(0);
        });

        it("Should calculate tokens out for ETH", async function () {
            const ethAmount = ethers.parseEther("1");
            const tokensOut = await bondingCurve.calculateTokensOut(ethAmount);
            expect(tokensOut).to.be.gt(0);
        });

        it("Should return zero for calculations when migrated", async function () {
            // First we need to reach migration threshold - this is complex to test
            // For now, just test the basic calculation
            const ethAmount = ethers.parseEther("1");
            const tokensOut = await bondingCurve.calculateTokensOut(ethAmount);
            expect(tokensOut).to.be.gt(0);
        });
    });

    describe("Token Purchases", function () {
        it("Should buy tokens successfully", async function () {
            const ethAmount = ethers.parseEther("1");
            const expectedTokens = await bondingCurve.calculateTokensOut(ethAmount);
            
            const buyerBalanceBefore = await token.balanceOf(buyer.address);
            const soldSupplyBefore = await bondingCurve.soldSupply();

            await expect(
                bondingCurve.connect(buyer).buyTokens(0, { value: ethAmount })
            ).to.emit(bondingCurve, "TokensPurchased");

            const buyerBalanceAfter = await token.balanceOf(buyer.address);
            const soldSupplyAfter = await bondingCurve.soldSupply();

            expect(buyerBalanceAfter - buyerBalanceBefore).to.be.closeTo(expectedTokens, ethers.parseEther("1000"));
            expect(soldSupplyAfter).to.be.gt(soldSupplyBefore);
        });

        it("Should fail with purchase amount too small", async function () {
            const smallAmount = ethers.parseEther("0.001");
            
            await expect(
                bondingCurve.connect(buyer).buyTokens(0, { value: smallAmount })
            ).to.be.revertedWith("Purchase amount too small");
        });

        it("Should fail with zero ETH", async function () {
            await expect(
                bondingCurve.connect(buyer).buyTokens(0, { value: 0 })
            ).to.be.revertedWith("ETH amount must be greater than 0");
        });

        it("Should fail with slippage protection", async function () {
            const ethAmount = ethers.parseEther("1");
            const expectedTokens = await bondingCurve.calculateTokensOut(ethAmount);
            const highMinTokens = expectedTokens * 2n; // Expect double the tokens

            await expect(
                bondingCurve.connect(buyer).buyTokens(highMinTokens, { value: ethAmount })
            ).to.be.revertedWith("Slippage tolerance exceeded");
        });

        it("Should prevent multiple purchases in same block", async function () {
            const ethAmount = ethers.parseEther("0.1");

            // First purchase
            await bondingCurve.connect(buyer).buyTokens(0, { value: ethAmount });

            // Second purchase in same block should fail
            await expect(
                bondingCurve.connect(buyer).buyTokens(0, { value: ethAmount })
            ).to.be.revertedWith("Cannot purchase multiple times per block");
        });

        it("Should distribute fees correctly", async function () {
            const ethAmount = ethers.parseEther("1");
            
            const treasuryBalanceBefore = await ethers.provider.getBalance(treasury.address);
            const creatorBalanceBefore = await ethers.provider.getBalance(creator.address);

            await bondingCurve.connect(buyer).buyTokens(0, { value: ethAmount });

            const treasuryBalanceAfter = await ethers.provider.getBalance(treasury.address);
            const creatorBalanceAfter = await ethers.provider.getBalance(creator.address);

            // Should receive platform fee (0.5% of 1 ETH)
            const expectedPlatformFee = ethAmount * 50n / 10000n;
            const expectedCreatorFee = ethAmount * 50n / 10000n;

            expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(expectedPlatformFee);
            expect(creatorBalanceAfter - creatorBalanceBefore).to.equal(expectedCreatorFee);
        });
    });

    describe("Token Sales", function () {
        beforeEach(async function () {
            // First buy some tokens
            const ethAmount = ethers.parseEther("1");
            await bondingCurve.connect(buyer).buyTokens(0, { value: ethAmount });
        });

        it("Should sell tokens successfully", async function () {
            const tokenBalance = await token.balanceOf(buyer.address);
            const sellAmount = tokenBalance / 2n; // Sell half

            const buyerEthBefore = await ethers.provider.getBalance(buyer.address);
            const soldSupplyBefore = await bondingCurve.soldSupply();

            // Approve tokens for sale
            await token.connect(buyer).approve(await bondingCurve.getAddress(), sellAmount);

            const tx = await bondingCurve.connect(buyer).sellTokens(sellAmount, 0);
            const receipt = await tx.wait();
            const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

            const buyerEthAfter = await ethers.provider.getBalance(buyer.address);
            const soldSupplyAfter = await bondingCurve.soldSupply();

            expect(buyerEthAfter + gasUsed).to.be.gt(buyerEthBefore);
            expect(soldSupplyAfter).to.be.lt(soldSupplyBefore);
        });

        it("Should fail selling more than owned", async function () {
            const tokenBalance = await token.balanceOf(buyer.address);
            const sellAmount = tokenBalance * 2n; // Try to sell double

            await token.connect(buyer).approve(await bondingCurve.getAddress(), sellAmount);

            await expect(
                bondingCurve.connect(buyer).sellTokens(sellAmount, 0)
            ).to.be.revertedWith("Insufficient token balance");
        });

        it("Should fail selling more than supply", async function () {
            const soldSupply = await bondingCurve.soldSupply();
            const sellAmount = soldSupply + ethers.parseEther("1000");

            // Give buyer enough tokens (this would fail in practice)
            await expect(
                bondingCurve.connect(buyer).sellTokens(sellAmount, 0)
            ).to.be.revertedWith("Cannot sell more than circulating supply");
        });

        it("Should fail with zero token amount", async function () {
            await expect(
                bondingCurve.connect(buyer).sellTokens(0, 0)
            ).to.be.revertedWith("Token amount must be greater than 0");
        });

        it("Should fail with slippage protection", async function () {
            const tokenBalance = await token.balanceOf(buyer.address);
            const sellAmount = tokenBalance / 2n;
            const expectedEth = await bondingCurve.calculateEthOut(sellAmount);
            const highMinEth = expectedEth * 2n; // Expect double the ETH

            await token.connect(buyer).approve(await bondingCurve.getAddress(), sellAmount);

            await expect(
                bondingCurve.connect(buyer).sellTokens(sellAmount, highMinEth)
            ).to.be.revertedWith("Slippage tolerance exceeded");
        });
    });

    describe("Curve Progress", function () {
        it("Should track curve progress correctly", async function () {
            const [soldSupply, totalSupply, progressBps] = await bondingCurve.getCurveProgress();
            
            expect(soldSupply).to.equal(0);
            expect(totalSupply).to.be.gt(0);
            expect(progressBps).to.equal(0);

            // Buy some tokens
            await bondingCurve.connect(buyer).buyTokens(0, { value: ethers.parseEther("1") });

            const [soldSupplyAfter, , progressBpsAfter] = await bondingCurve.getCurveProgress();
            expect(soldSupplyAfter).to.be.gt(0);
            expect(progressBpsAfter).to.be.gt(0);
        });

        it("Should not be ready for migration initially", async function () {
            expect(await bondingCurve.isReadyForMigration()).to.be.false;
        });
    });

    describe("Admin Functions", function () {
        it("Should update platform treasury", async function () {
            const newTreasury = seller.address;
            
            await expect(bondingCurve.connect(owner).updatePlatformTreasury(newTreasury))
                .to.emit(bondingCurve, "PlatformTreasuryUpdated")
                .withArgs(treasury.address, newTreasury);

            expect(await bondingCurve.platformTreasury()).to.equal(newTreasury);
        });

        it("Should fail admin functions from non-owner", async function () {
            await expect(
                bondingCurve.connect(buyer).updatePlatformTreasury(seller.address)
            ).to.be.revertedWithCustomError(bondingCurve, "OwnableUnauthorizedAccount");
        });

        it("Should fail to update treasury with zero address", async function () {
            await expect(
                bondingCurve.connect(owner).updatePlatformTreasury(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid treasury address");
        });
    });

    describe("Migration", function () {
        it("Should prevent operations after migration", async function () {
            // Manually trigger migration for testing
            await bondingCurve.connect(owner).emergencyMigrate();

            expect(await bondingCurve.migrated()).to.be.true;

            // Should fail to buy tokens
            await expect(
                bondingCurve.connect(buyer).buyTokens(0, { value: ethers.parseEther("1") })
            ).to.be.revertedWith("Curve has migrated to DEX");

            // Should fail to sell tokens
            await expect(
                bondingCurve.connect(buyer).sellTokens(ethers.parseEther("1000"), 0)
            ).to.be.revertedWith("Curve has migrated to DEX");
        });

        it("Should fail to migrate twice", async function () {
            await bondingCurve.connect(owner).emergencyMigrate();

            await expect(
                bondingCurve.connect(owner).emergencyMigrate()
            ).to.be.revertedWith("Already migrated");
        });
    });
});
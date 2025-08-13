import { expect } from "chai";
import { ethers } from "hardhat";
import { LaunchFactory, BaseToken, BondingCurve } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("LaunchFactory", function () {
    let launchFactory: LaunchFactory;
    let owner: SignerWithAddress;
    let treasury: SignerWithAddress;
    let creator: SignerWithAddress;
    let user: SignerWithAddress;

    const LAUNCH_FEE = ethers.parseEther("0.01");

    beforeEach(async function () {
        [owner, treasury, creator, user] = await ethers.getSigners();

        const LaunchFactory = await ethers.getContractFactory("LaunchFactory");
        launchFactory = await LaunchFactory.deploy(owner.address, treasury.address);
        await launchFactory.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(await launchFactory.owner()).to.equal(owner.address);
        });

        it("Should set the right platform treasury", async function () {
            expect(await launchFactory.platformTreasury()).to.equal(treasury.address);
        });

        it("Should set the correct launch fee", async function () {
            expect(await launchFactory.getLaunchFee()).to.equal(LAUNCH_FEE);
        });
    });

    describe("Token Launch", function () {
        const tokenMetadata = {
            name: "Test Token",
            symbol: "TEST",
            description: "A test token for the platform",
            imageUrl: "https://example.com/image.png",
            website: "https://example.com",
            twitter: "@testtoken",
            telegram: "@testtoken"
        };

        it("Should launch a token successfully", async function () {
            const balanceBefore = await ethers.provider.getBalance(treasury.address);

            const tx = await launchFactory.connect(creator).launchToken(tokenMetadata, {
                value: LAUNCH_FEE
            });

            const receipt = await tx.wait();
            const event = receipt?.logs.find(log => 
                launchFactory.interface.parseLog(log)?.name === "TokenLaunched"
            );

            expect(event).to.not.be.undefined;

            const parsedEvent = launchFactory.interface.parseLog(event!);
            const tokenAddress = parsedEvent?.args[0];
            const bondingCurveAddress = parsedEvent?.args[2];

            // Check token deployment
            const token = await ethers.getContractAt("BaseToken", tokenAddress);
            expect(await token.name()).to.equal(tokenMetadata.name);
            expect(await token.symbol()).to.equal(tokenMetadata.symbol);
            expect(await token.owner()).to.equal(creator.address);

            // Check bonding curve deployment
            const bondingCurve = await ethers.getContractAt("BondingCurve", bondingCurveAddress);
            expect(await bondingCurve.creator()).to.equal(creator.address);

            // Check fee transfer
            const balanceAfter = await ethers.provider.getBalance(treasury.address);
            expect(balanceAfter - balanceBefore).to.equal(LAUNCH_FEE);

            // Check token info storage
            const [metadata, creatorAddr, bondingCurveAddr, migrated] = await launchFactory.getTokenInfo(tokenAddress);
            expect(metadata.name).to.equal(tokenMetadata.name);
            expect(creatorAddr).to.equal(creator.address);
            expect(bondingCurveAddr).to.equal(bondingCurveAddress);
            expect(migrated).to.be.false;
        });

        it("Should fail with insufficient launch fee", async function () {
            await expect(
                launchFactory.connect(creator).launchToken(tokenMetadata, {
                    value: ethers.parseEther("0.005")
                })
            ).to.be.revertedWith("Insufficient launch fee");
        });

        it("Should fail with empty token name", async function () {
            const invalidMetadata = { ...tokenMetadata, name: "" };
            
            await expect(
                launchFactory.connect(creator).launchToken(invalidMetadata, {
                    value: LAUNCH_FEE
                })
            ).to.be.revertedWith("Token name required");
        });

        it("Should fail with empty token symbol", async function () {
            const invalidMetadata = { ...tokenMetadata, symbol: "" };
            
            await expect(
                launchFactory.connect(creator).launchToken(invalidMetadata, {
                    value: LAUNCH_FEE
                })
            ).to.be.revertedWith("Token symbol required");
        });

        it("Should fail with token symbol too long", async function () {
            const invalidMetadata = { ...tokenMetadata, symbol: "VERYLONGSYMBOL" };
            
            await expect(
                launchFactory.connect(creator).launchToken(invalidMetadata, {
                    value: LAUNCH_FEE
                })
            ).to.be.revertedWith("Token symbol too long");
        });

        it("Should validate URLs correctly", async function () {
            const invalidMetadata = { ...tokenMetadata, website: "invalid-url" };
            
            await expect(
                launchFactory.connect(creator).launchToken(invalidMetadata, {
                    value: LAUNCH_FEE
                })
            ).to.be.revertedWith("Invalid website URL");
        });
    });

    describe("Token Management", function () {
        let tokenAddress: string;
        let bondingCurveAddress: string;

        beforeEach(async function () {
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
            tokenAddress = parsedEvent?.args[0];
            bondingCurveAddress = parsedEvent?.args[2];
        });

        it("Should get all tokens", async function () {
            const tokens = await launchFactory.getAllTokens();
            expect(tokens).to.include(tokenAddress);
            expect(tokens.length).to.equal(1);
        });

        it("Should get tokens by creator", async function () {
            const tokens = await launchFactory.getTokensByCreator(creator.address);
            expect(tokens).to.include(tokenAddress);
            expect(tokens.length).to.equal(1);

            const emptyTokens = await launchFactory.getTokensByCreator(user.address);
            expect(emptyTokens.length).to.equal(0);
        });

        it("Should get tokens with pagination", async function () {
            const [tokens, total] = await launchFactory.getTokensPaginated(0, 10);
            expect(tokens).to.include(tokenAddress);
            expect(total).to.equal(1);

            const [emptyTokens] = await launchFactory.getTokensPaginated(10, 10);
            expect(emptyTokens.length).to.equal(0);
        });

        it("Should get token count", async function () {
            expect(await launchFactory.getTokenCount()).to.equal(1);
        });
    });

    describe("Admin Functions", function () {
        it("Should update launch fee", async function () {
            const newFee = ethers.parseEther("0.02");
            
            await expect(launchFactory.connect(owner).updateLaunchFee(newFee))
                .to.emit(launchFactory, "LaunchFeeUpdated")
                .withArgs(LAUNCH_FEE, newFee);

            expect(await launchFactory.getLaunchFee()).to.equal(newFee);
        });

        it("Should update platform treasury", async function () {
            const newTreasury = user.address;
            
            await expect(launchFactory.connect(owner).updatePlatformTreasury(newTreasury))
                .to.emit(launchFactory, "PlatformTreasuryUpdated")
                .withArgs(treasury.address, newTreasury);

            expect(await launchFactory.platformTreasury()).to.equal(newTreasury);
        });

        it("Should fail to update treasury with zero address", async function () {
            await expect(
                launchFactory.connect(owner).updatePlatformTreasury(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid treasury address");
        });

        it("Should fail admin functions from non-owner", async function () {
            await expect(
                launchFactory.connect(user).updateLaunchFee(ethers.parseEther("0.02"))
            ).to.be.revertedWithCustomError(launchFactory, "OwnableUnauthorizedAccount");

            await expect(
                launchFactory.connect(user).updatePlatformTreasury(user.address)
            ).to.be.revertedWithCustomError(launchFactory, "OwnableUnauthorizedAccount");
        });
    });

    describe("URL Validation", function () {
        const baseMetadata = {
            name: "Test Token",
            symbol: "TEST",
            description: "A test token",
            imageUrl: "",
            website: "",
            twitter: "",
            telegram: ""
        };

        it("Should accept valid HTTP URLs", async function () {
            const metadata = { 
                ...baseMetadata, 
                website: "http://example.com",
                imageUrl: "https://example.com/image.png"
            };

            await expect(
                launchFactory.connect(creator).launchToken(metadata, {
                    value: LAUNCH_FEE
                })
            ).to.not.be.reverted;
        });

        it("Should accept valid social handles", async function () {
            const metadata = { 
                ...baseMetadata,
                twitter: "@validhandle",
                telegram: "validhandle"
            };

            await expect(
                launchFactory.connect(creator).launchToken(metadata, {
                    value: LAUNCH_FEE
                })
            ).to.not.be.reverted;
        });

        it("Should reject invalid URLs", async function () {
            const metadata = { ...baseMetadata, website: "invalid" };

            await expect(
                launchFactory.connect(creator).launchToken(metadata, {
                    value: LAUNCH_FEE
                })
            ).to.be.revertedWith("Invalid website URL");
        });

        it("Should reject invalid Twitter handles", async function () {
            const metadata = { ...baseMetadata, twitter: "@" };

            await expect(
                launchFactory.connect(creator).launchToken(metadata, {
                    value: LAUNCH_FEE
                })
            ).to.be.revertedWith("Invalid Twitter handle");
        });
    });
});
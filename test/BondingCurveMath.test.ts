import { expect } from "chai";
import { ethers } from "hardhat";

describe("BondingCurveMath", function () {
    let mathContract: any;

    before(async function () {
        // Deploy a test contract that exposes the library functions
        const MathTester = await ethers.getContractFactory("BondingCurveMathTester");
        mathContract = await MathTester.deploy();
        await mathContract.waitForDeployment();
    });

    describe("Price Calculations", function () {
        it("Should calculate base price correctly", async function () {
            const basePrice = await mathContract.getBasePrice();
            expect(basePrice).to.equal(ethers.parseEther("0.00001"));
        });

        it("Should calculate price at zero supply", async function () {
            const price = await mathContract.calculatePrice(0);
            const basePrice = await mathContract.getBasePrice();
            expect(price).to.equal(basePrice);
        });

        it("Should calculate increasing prices with supply", async function () {
            const supply1 = ethers.parseEther("1000000"); // 1M tokens
            const supply2 = ethers.parseEther("2000000"); // 2M tokens

            const price1 = await mathContract.calculatePrice(supply1);
            const price2 = await mathContract.calculatePrice(supply2);

            expect(price2).to.be.gt(price1);
        });

        it("Should have exponential growth in prices", async function () {
            const supplies = [
                ethers.parseEther("1000000"),   // 1M
                ethers.parseEther("10000000"),  // 10M
                ethers.parseEther("100000000"), // 100M
            ];

            const prices = [];
            for (const supply of supplies) {
                prices.push(await mathContract.calculatePrice(supply));
            }

            // Each price should be significantly higher than the previous
            expect(prices[1]).to.be.gt(prices[0] * 10n);
            expect(prices[2]).to.be.gt(prices[1] * 10n);
        });
    });

    describe("Integral Calculations", function () {
        it("Should calculate zero integral for zero supply", async function () {
            const integral = await mathContract.calculateIntegral(0);
            expect(integral).to.equal(0);
        });

        it("Should calculate increasing integrals", async function () {
            const supply1 = ethers.parseEther("1000000");
            const supply2 = ethers.parseEther("2000000");

            const integral1 = await mathContract.calculateIntegral(supply1);
            const integral2 = await mathContract.calculateIntegral(supply2);

            expect(integral2).to.be.gt(integral1);
        });

        it("Should have correct relationship with price", async function () {
            const supply = ethers.parseEther("1000000");
            const smallIncrement = ethers.parseEther("1000");

            const integral1 = await mathContract.calculateIntegral(supply);
            const integral2 = await mathContract.calculateIntegral(supply + smallIncrement);
            const price = await mathContract.calculatePrice(supply);

            // The difference in integrals should approximate price * increment
            const integralDiff = integral2 - integral1;
            const expectedDiff = price * smallIncrement / ethers.parseEther("1");

            // Allow for some tolerance due to discrete approximation
            const tolerance = expectedDiff / 100n; // 1% tolerance
            expect(integralDiff).to.be.closeTo(expectedDiff, tolerance);
        });
    });

    describe("Token Calculations", function () {
        it("Should calculate tokens out for ETH amount", async function () {
            const currentSupply = ethers.parseEther("1000000");
            const ethAmount = ethers.parseEther("1");

            const tokensOut = await mathContract.calculateTokensOut(currentSupply, ethAmount);
            expect(tokensOut).to.be.gt(0);
        });

        it("Should calculate ETH out for token amount", async function () {
            const currentSupply = ethers.parseEther("1000000");
            const tokenAmount = ethers.parseEther("100000");

            const ethOut = await mathContract.calculateEthOut(currentSupply, tokenAmount);
            expect(ethOut).to.be.gt(0);
        });

        it("Should have reciprocal relationship", async function () {
            const currentSupply = ethers.parseEther("1000000");
            const ethAmount = ethers.parseEther("1");

            // Calculate tokens for ETH
            const tokensOut = await mathContract.calculateTokensOut(currentSupply, ethAmount);
            
            // Calculate ETH for those tokens (from increased supply)
            const newSupply = currentSupply + tokensOut;
            const ethBack = await mathContract.calculateEthOut(newSupply, tokensOut);

            // Should get back approximately the same ETH (minus some due to curve shape)
            expect(ethBack).to.be.lt(ethAmount);
            expect(ethBack).to.be.gt(ethAmount * 90n / 100n); // At least 90% back
        });

        it("Should fail when selling more than supply", async function () {
            const currentSupply = ethers.parseEther("1000000");
            const tokenAmount = ethers.parseEther("2000000"); // More than supply

            await expect(
                mathContract.calculateEthOut(currentSupply, tokenAmount)
            ).to.be.revertedWith("Cannot sell more than supply");
        });

        it("Should respect curve supply limit", async function () {
            const maxSupply = await mathContract.getMaxCurveSupply();
            const largeEthAmount = ethers.parseEther("1000000");

            const tokensOut = await mathContract.calculateTokensOut(0, largeEthAmount);
            expect(tokensOut).to.be.lte(maxSupply);
        });
    });

    describe("Migration and Progress", function () {
        it("Should report correct max curve supply", async function () {
            const maxSupply = await mathContract.getMaxCurveSupply();
            const expectedMax = ethers.parseEther("700000000"); // 700M tokens
            expect(maxSupply).to.equal(expectedMax);
        });

        it("Should calculate progress correctly", async function () {
            const maxSupply = await mathContract.getMaxCurveSupply();
            const halfSupply = maxSupply / 2n;

            const progress = await mathContract.calculateProgress(halfSupply);
            expect(progress).to.equal(5000); // 50% in basis points
        });

        it("Should indicate ready for migration at max supply", async function () {
            const maxSupply = await mathContract.getMaxCurveSupply();
            const ready = await mathContract.isReadyForMigration(maxSupply);
            expect(ready).to.be.true;
        });

        it("Should not be ready for migration below max supply", async function () {
            const maxSupply = await mathContract.getMaxCurveSupply();
            const partialSupply = maxSupply - 1n;
            
            const ready = await mathContract.isReadyForMigration(partialSupply);
            expect(ready).to.be.false;
        });

        it("Should cap progress at 100%", async function () {
            const maxSupply = await mathContract.getMaxCurveSupply();
            const overSupply = maxSupply + ethers.parseEther("1000000");

            const progress = await mathContract.calculateProgress(overSupply);
            expect(progress).to.equal(10000); // 100% in basis points
        });
    });

    describe("Square Root Function", function () {
        it("Should calculate square root of zero", async function () {
            const sqrt = await mathContract.sqrt(0);
            expect(sqrt).to.equal(0);
        });

        it("Should calculate perfect squares correctly", async function () {
            const testCases = [
                [4n, 2n],
                [9n, 3n],
                [16n, 4n],
                [25n, 5n],
                [100n, 10n],
            ];

            for (const [input, expected] of testCases) {
                const sqrt = await mathContract.sqrt(input);
                expect(sqrt).to.equal(expected);
            }
        });

        it("Should approximate non-perfect squares", async function () {
            const sqrt8 = await mathContract.sqrt(8n);
            expect(sqrt8).to.be.closeTo(2n, 1n); // √8 ≈ 2.83

            const sqrt15 = await mathContract.sqrt(15n);
            expect(sqrt15).to.be.closeTo(3n, 1n); // √15 ≈ 3.87
        });

        it("Should handle large numbers", async function () {
            const largeNumber = ethers.parseEther("1000000"); // 10^24
            const sqrt = await mathContract.sqrt(largeNumber);
            expect(sqrt).to.be.gt(0);
            
            // √(10^24) = 10^12
            const expectedSqrt = ethers.parseEther("1000000") / 1000000n;
            expect(sqrt).to.be.closeTo(expectedSqrt, expectedSqrt / 1000n);
        });
    });

    describe("Edge Cases and Security", function () {
        it("Should handle zero ETH amount", async function () {
            const currentSupply = ethers.parseEther("1000000");
            const tokensOut = await mathContract.calculateTokensOut(currentSupply, 0);
            expect(tokensOut).to.equal(0);
        });

        it("Should handle maximum supply edge case", async function () {
            const maxSupply = await mathContract.getMaxCurveSupply();
            const nearMaxSupply = maxSupply - 1n;

            // Should be able to calculate for supply just under max
            const tokensOut = await mathContract.calculateTokensOut(nearMaxSupply, ethers.parseEther("0.001"));
            expect(tokensOut).to.be.lte(1n); // Should be at most 1 token
        });

        it("Should prevent overflow in calculations", async function () {
            // Test with very large numbers that might cause overflow
            const largeSupply = ethers.parseEther("500000000"); // 500M tokens
            const largeEthAmount = ethers.parseEther("10000"); // 10,000 ETH

            // Should not revert due to overflow
            await expect(
                mathContract.calculateTokensOut(largeSupply, largeEthAmount)
            ).to.not.be.reverted;
        });
    });
});

// We also need to create a test contract that exposes the library functions
// This would go in a separate contracts/test/ directory
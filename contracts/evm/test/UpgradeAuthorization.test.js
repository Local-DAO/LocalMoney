const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Upgrade Authorization Security Tests", function () {
    let hub, trade, escrow, offer, profile, priceOracle, arbitratorManager;
    let hubImplementationV2;
    let owner, admin, attacker, timelockController;
    let minDelay = 2 * 24 * 60 * 60; // 2 days in seconds

    beforeEach(async function () {
        [owner, admin, attacker, ...addrs] = await ethers.getSigners();

        // Deploy Hub with timelock
        const Hub = await ethers.getContractFactory("Hub");
        const initialConfig = {
            burnFeePct: 100,      // 1%
            chainFeePct: 50,       // 0.5%
            warchestFeePct: 50,    // 0.5%
            conversionFeePct: 100, // 1%
            arbitratorFeePct: 50,  // 0.5%
            treasury: owner.address,
            localMarket: owner.address,
            priceProvider: owner.address,
            globalPause: false,
            pauseNewTrades: false,
            pauseDeposits: false,
            pauseWithdrawals: false,
            tradeExpirationTimer: 86400, // 1 day
            tradeDisputeTimer: 259200,   // 3 days
            minTradeAmount: ethers.parseEther("10"),
            maxTradeAmount: ethers.parseEther("10000"),
            maxActiveOffers: 10,
            maxActiveTrades: 5
        };

        hub = await upgrades.deployProxy(Hub, [initialConfig, minDelay], {
            initializer: "initialize",
            kind: "uups"
        });
        await hub.waitForDeployment();

        // Get the deployed TimelockController address
        const timelockAddress = await hub.timelockController();
        timelockController = await ethers.getContractAt("TimelockController", timelockAddress);

        // Deploy Profile first as it has no dependencies
        const Profile = await ethers.getContractFactory("Profile");
        profile = await upgrades.deployProxy(Profile, [hub.target], {
            initializer: "initialize",
            kind: "uups"
        });
        await profile.waitForDeployment();

        // Deploy Offer
        const Offer = await ethers.getContractFactory("Offer");
        offer = await upgrades.deployProxy(Offer, [hub.target, profile.target], {
            initializer: "initialize",
            kind: "uups"
        });
        await offer.waitForDeployment();

        // Deploy PriceOracle
        const PriceOracle = await ethers.getContractFactory("PriceOracle");
        priceOracle = await upgrades.deployProxy(PriceOracle, [
            hub.target,
            "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" // ETH/USD Chainlink feed on mainnet
        ], {
            initializer: "initialize",
            kind: "uups"
        });
        await priceOracle.waitForDeployment();

        // Deploy ArbitratorManager 
        const ArbitratorManager = await ethers.getContractFactory("ArbitratorManager");
        arbitratorManager = await upgrades.deployProxy(ArbitratorManager, [
            hub.target,
            owner.address // Trade contract placeholder - will be updated
        ], {
            initializer: "initialize",
            kind: "uups"
        });
        await arbitratorManager.waitForDeployment();

        // Deploy Escrow
        const Escrow = await ethers.getContractFactory("Escrow");
        escrow = await upgrades.deployProxy(Escrow, [
            hub.target,
            priceOracle.target,
            owner.address // Trade contract placeholder - will be updated
        ], {
            initializer: "initialize",
            kind: "uups"
        });
        await escrow.waitForDeployment();

        // Deploy Trade with all dependencies
        const Trade = await ethers.getContractFactory("Trade");
        trade = await upgrades.deployProxy(Trade, [
            hub.target,
            offer.target,
            profile.target,
            escrow.target,
            arbitratorManager.target
        ], {
            initializer: "initialize",
            kind: "uups"
        });
        await trade.waitForDeployment();

        // Update Trade contract in dependent contracts if they have setters
        // Note: These contracts may need setters added if not present
        // For now we'll assume they're set correctly or handle in individual tests
    });

    describe("SECURITY FIX UPG-003: Strict Timelock Enforcement", function () {
        it("Should prevent direct admin upgrades to Hub", async function () {
            // Deploy a V2 implementation
            const HubV2 = await ethers.getContractFactory("Hub");
            hubImplementationV2 = await HubV2.deploy();
            await hubImplementationV2.waitForDeployment();

            // Try to upgrade directly as admin (should fail)
            await expect(
                hub.connect(owner).upgradeToAndCall(hubImplementationV2.target, "0x")
            ).to.be.revertedWith("Hub: Only timelock can upgrade");
        });

        it("Should allow upgrades only through timelock", async function () {
            // Deploy a V2 implementation
            const HubV2 = await ethers.getContractFactory("Hub");
            hubImplementationV2 = await HubV2.deploy();
            await hubImplementationV2.waitForDeployment();

            // Grant proposer and executor roles to owner
            const PROPOSER_ROLE = await timelockController.PROPOSER_ROLE();
            const EXECUTOR_ROLE = await timelockController.EXECUTOR_ROLE();
            
            await timelockController.grantRole(PROPOSER_ROLE, owner.address);
            await timelockController.grantRole(EXECUTOR_ROLE, owner.address);

            // Schedule upgrade through timelock
            const upgradeCalldata = hub.interface.encodeFunctionData(
                "upgradeToAndCall",
                [hubImplementationV2.target, "0x"]
            );

            const salt = ethers.randomBytes(32);
            
            await timelockController.schedule(
                hub.target,
                0,
                upgradeCalldata,
                ethers.ZeroHash,
                salt,
                minDelay
            );

            // Fast forward time
            await ethers.provider.send("evm_increaseTime", [minDelay + 1]);
            await ethers.provider.send("evm_mine");

            // Execute upgrade through timelock (should succeed)
            await timelockController.execute(
                hub.target,
                0,
                upgradeCalldata,
                ethers.ZeroHash,
                salt
            );

            // Verify upgrade succeeded
            const implementation = await upgrades.erc1967.getImplementationAddress(hub.target);
            expect(implementation).to.equal(hubImplementationV2.target);
        });

        it("Should prevent attacker from bypassing timelock", async function () {
            // Deploy a malicious implementation
            const HubV2 = await ethers.getContractFactory("Hub");
            const maliciousImplementation = await HubV2.deploy();
            await maliciousImplementation.waitForDeployment();

            // Attacker tries various bypass attempts
            
            // 1. Direct upgrade attempt
            await expect(
                hub.connect(attacker).upgradeToAndCall(maliciousImplementation.target, "0x")
            ).to.be.revertedWith("Hub: Only timelock can upgrade");

            // 2. Try to call through unauthorized timelock
            await expect(
                timelockController.connect(attacker).execute(
                    hub.target,
                    0,
                    hub.interface.encodeFunctionData("upgradeToAndCall", [maliciousImplementation.target, "0x"]),
                    ethers.ZeroHash,
                    ethers.randomBytes(32)
                )
            ).to.be.reverted;
        });

        it("Should enforce minimum delay on timelock operations", async function () {
            const HubV2 = await ethers.getContractFactory("Hub");
            hubImplementationV2 = await HubV2.deploy();
            await hubImplementationV2.waitForDeployment();

            const PROPOSER_ROLE = await timelockController.PROPOSER_ROLE();
            const EXECUTOR_ROLE = await timelockController.EXECUTOR_ROLE();
            
            await timelockController.grantRole(PROPOSER_ROLE, owner.address);
            await timelockController.grantRole(EXECUTOR_ROLE, owner.address);

            const upgradeCalldata = hub.interface.encodeFunctionData(
                "upgradeToAndCall",
                [hubImplementationV2.target, "0x"]
            );

            const salt = ethers.randomBytes(32);
            
            await timelockController.schedule(
                hub.target,
                0,
                upgradeCalldata,
                ethers.ZeroHash,
                salt,
                minDelay
            );

            // Try to execute immediately (should fail)
            await expect(
                timelockController.execute(
                    hub.target,
                    0,
                    upgradeCalldata,
                    ethers.ZeroHash,
                    salt
                )
            ).to.be.revertedWith("TimelockController: operation is not ready");
        });

        it("Should protect all upgradeable contracts", async function () {
            // Test Trade contract
            await expect(
                trade.connect(attacker).upgradeToAndCall(owner.address, "0x")
            ).to.be.reverted;

            // Test Escrow contract
            await expect(
                escrow.connect(attacker).upgradeToAndCall(owner.address, "0x")
            ).to.be.reverted;

            // Test Offer contract
            await expect(
                offer.connect(attacker).upgradeToAndCall(owner.address, "0x")
            ).to.be.reverted;

            // Test Profile contract
            await expect(
                profile.connect(attacker).upgradeToAndCall(owner.address, "0x")
            ).to.be.reverted;

            // Test ArbitratorManager contract
            await expect(
                arbitratorManager.connect(attacker).upgradeToAndCall(owner.address, "0x")
            ).to.be.reverted;

            // Test PriceOracle contract
            await expect(
                priceOracle.connect(attacker).upgradeToAndCall(owner.address, "0x")
            ).to.be.reverted;
        });
    });
});
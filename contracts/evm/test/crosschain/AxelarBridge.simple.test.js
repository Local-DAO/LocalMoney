const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");

describe("AxelarBridge Simple Test", function () {
    let axelarBridge, hub, owner;
    let mockGateway, mockGasService;
    
    beforeEach(async function () {
        [owner] = await ethers.getSigners();
        
        // Deploy mock Axelar components
        const MockGateway = await ethers.getContractFactory("MockAxelarGateway");
        mockGateway = await MockGateway.deploy();
        await mockGateway.waitForDeployment();
        
        const MockGasService = await ethers.getContractFactory("MockAxelarGasService");
        mockGasService = await MockGasService.deploy();
        await mockGasService.waitForDeployment();
        
        // Deploy minimal Hub for testing (using zero addresses for simplicity)
        const Hub = await ethers.getContractFactory("Hub");
        const hubConfig = {
            offerContract: ethers.ZeroAddress,
            tradeContract: ethers.ZeroAddress,
            profileContract: ethers.ZeroAddress,
            priceContract: ethers.ZeroAddress,
            treasury: owner.address,
            localMarket: owner.address,
            priceProvider: owner.address,
            localTokenAddress: ethers.ZeroAddress,
            chainFeeCollector: owner.address,
            swapRouter: ethers.ZeroAddress,
            burnFeePct: 100,
            chainFeePct: 100,
            warchestFeePct: 100,
            conversionFeePct: 100,
            arbitratorFeePct: 100,
            minTradeAmount: ethers.parseEther("10"),
            maxTradeAmount: ethers.parseEther("10000"),
            maxActiveOffers: 10,
            maxActiveTrades: 5,
            tradeExpirationTimer: 24 * 60 * 60,
            tradeDisputeTimer: 7 * 24 * 60 * 60,
            globalPause: false,
            pauseNewTrades: false,
            pauseDeposits: false,
            pauseWithdrawals: false
        };
        
        const minDelay = 2 * 24 * 60 * 60; // 2 days
        hub = await upgrades.deployProxy(Hub, [hubConfig, minDelay], {
            initializer: "initialize",
            kind: "uups"
        });
        await hub.waitForDeployment();
        
        // Deploy AxelarBridge
        const AxelarBridge = await ethers.getContractFactory("AxelarBridge");
        axelarBridge = await upgrades.deployProxy(
            AxelarBridge,
            [await hub.getAddress(), await mockGasService.getAddress()],
            {
                constructorArgs: [await mockGateway.getAddress()],
                initializer: "initialize"
            }
        );
        await axelarBridge.waitForDeployment();
    });
    
    describe("Basic Functionality", function () {
        it("should deploy and initialize correctly", async function () {
            expect(await axelarBridge.getHub()).to.equal(await hub.getAddress());
            expect(await axelarBridge.getGasService()).to.equal(await mockGasService.getAddress());
            expect(await axelarBridge.getGateway()).to.equal(await mockGateway.getAddress());
            expect(await axelarBridge.getMessageExpiry()).to.equal(3600); // 1 hour
        });
        
        it("should register a chain", async function () {
            await axelarBridge.registerChain("Polygon", "0x1234567890123456789012345678901234567890");
            expect(await axelarBridge.isChainRegistered("Polygon")).to.be.true;
            expect(await axelarBridge.getSatelliteAddress("Polygon"))
                .to.equal("0x1234567890123456789012345678901234567890");
        });
    });
});
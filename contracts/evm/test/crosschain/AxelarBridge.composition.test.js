const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");

describe("AxelarBridge with Composition Pattern", function () {
    let axelarBridge, axelarHandler, hub, owner;
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
        
        // Deploy minimal Hub for testing
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
        
        // Deploy AxelarHandler (non-upgradeable)
        const AxelarHandler = await ethers.getContractFactory("AxelarHandler");
        axelarHandler = await AxelarHandler.deploy(await mockGateway.getAddress());
        await axelarHandler.waitForDeployment();
        
        // Deploy AxelarBridge (upgradeable)
        const AxelarBridge = await ethers.getContractFactory("AxelarBridge");
        axelarBridge = await upgrades.deployProxy(
            AxelarBridge,
            [
                await hub.getAddress(),
                await mockGasService.getAddress(),
                await axelarHandler.getAddress()
            ],
            {
                initializer: "initialize",
                kind: "uups"
            }
        );
        await axelarBridge.waitForDeployment();
        
        // Connect AxelarHandler to AxelarBridge
        await axelarHandler.setBridge(await axelarBridge.getAddress());
    });
    
    describe("Basic Functionality", function () {
        it("should deploy and initialize correctly", async function () {
            expect(await axelarBridge.getHub()).to.equal(await hub.getAddress());
            expect(await axelarBridge.getGasService()).to.equal(await mockGasService.getAddress());
            expect(await axelarBridge.getAxelarHandler()).to.equal(await axelarHandler.getAddress());
            expect(await axelarBridge.getMessageExpiry()).to.equal(3600); // 1 hour
            
            // Check handler configuration
            expect(await axelarHandler.axelarBridge()).to.equal(await axelarBridge.getAddress());
            expect(await axelarHandler.getGateway()).to.equal(await mockGateway.getAddress());
        });
        
        it("should register a chain", async function () {
            await axelarBridge.registerChain("Polygon", "0x1234567890123456789012345678901234567890");
            expect(await axelarBridge.isChainRegistered("Polygon")).to.be.true;
            expect(await axelarBridge.getSatelliteAddress("Polygon"))
                .to.equal("0x1234567890123456789012345678901234567890");
        });
        
        it("should handle incoming message through handler", async function () {
            // Register chain first
            await axelarBridge.registerChain("Polygon", "0xSatelliteAddress");
            
            // Prepare message
            const message = {
                messageType: 0, // CREATE_OFFER
                sender: owner.address,
                sourceChainId: 137,
                nonce: 1,
                payload: ethers.AbiCoder.defaultAbiCoder().encode(
                    ["address", "uint256", "uint256", "bool", "string", "uint256", "uint256"],
                    [ethers.ZeroAddress, ethers.parseEther("100"), ethers.parseEther("1"), true, "USD", ethers.parseEther("10"), ethers.parseEther("1000")]
                )
            };
            
            const encodedMessage = ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint8", "address", "uint256", "uint256", "bytes"],
                [message.messageType, message.sender, message.sourceChainId, message.nonce, message.payload]
            );
            
            // Simulate Axelar callback through the handler
            await mockGateway.callExecute(
                await axelarHandler.getAddress(),
                "Polygon",
                "0xSatelliteAddress",
                encodedMessage
            );
            
            // Verify message was processed
            const messageId = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["string", "address", "uint256", "uint256", "uint8"],
                    ["Polygon", message.sender, message.sourceChainId, message.nonce, message.messageType]
                )
            );
            
            expect(await axelarBridge.isMessageProcessed(messageId)).to.be.true;
        });
        
        it("should allow bridge upgrades while keeping handler stable", async function () {
            // Deploy new implementation of AxelarBridge
            const AxelarBridgeV2 = await ethers.getContractFactory("AxelarBridge");
            
            // Upgrade the bridge
            const upgraded = await upgrades.upgradeProxy(
                await axelarBridge.getAddress(),
                AxelarBridgeV2
            );
            
            // Handler should still point to the same bridge address
            expect(await axelarHandler.axelarBridge()).to.equal(await upgraded.getAddress());
            
            // Bridge should still work with the same handler
            expect(await upgraded.getAxelarHandler()).to.equal(await axelarHandler.getAddress());
        });
    });
});
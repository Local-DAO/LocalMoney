const { ethers, upgrades } = require("hardhat");
const { expect } = require("chai");
const { deployAllContractsWithRoles } = require("../helpers/deploymentHelper");

describe("AxelarBridge", function () {
    let axelarBridge, hub, owner, admin, emergency, user1, user2;
    let mockGateway, mockGasService;
    let ADMIN_ROLE, EMERGENCY_ROLE;
    
    beforeEach(async function () {
        [owner, admin, emergency, user1, user2] = await ethers.getSigners();
        
        // Deploy mock Axelar components
        const MockGateway = await ethers.getContractFactory("MockAxelarGateway");
        mockGateway = await MockGateway.deploy();
        await mockGateway.waitForDeployment();
        
        const MockGasService = await ethers.getContractFactory("MockAxelarGasService");
        mockGasService = await MockGasService.deploy();
        await mockGasService.waitForDeployment();
        
        // Deploy hub and other contracts
        const contracts = await deployAllContractsWithRoles();
        hub = contracts.hub;
        
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
        
        // Get role constants
        ADMIN_ROLE = await axelarBridge.ADMIN_ROLE();
        EMERGENCY_ROLE = await axelarBridge.EMERGENCY_ROLE();
        
        // Grant roles
        await axelarBridge.grantRole(ADMIN_ROLE, admin.address);
        await axelarBridge.grantRole(EMERGENCY_ROLE, emergency.address);
    });
    
    describe("Initialization", function () {
        it("should initialize with correct parameters", async function () {
            expect(await axelarBridge.getHub()).to.equal(await hub.getAddress());
            expect(await axelarBridge.getGasService()).to.equal(await mockGasService.getAddress());
            expect(await axelarBridge.getGateway()).to.equal(await mockGateway.getAddress());
            expect(await axelarBridge.getMessageExpiry()).to.equal(3600); // 1 hour
        });
        
        it("should set up roles correctly", async function () {
            expect(await axelarBridge.hasRole(ADMIN_ROLE, owner.address)).to.be.true;
            expect(await axelarBridge.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
            expect(await axelarBridge.hasRole(EMERGENCY_ROLE, emergency.address)).to.be.true;
        });
        
        it("should prevent re-initialization", async function () {
            await expect(
                axelarBridge.initialize(hub.getAddress(), mockGasService.getAddress())
            ).to.be.revertedWithCustomError(axelarBridge, "InvalidInitialization");
        });
    });
    
    describe("Chain Registration", function () {
        it("should register new chain", async function () {
            await axelarBridge.connect(admin).registerChain(
                "Polygon",
                "0x1234567890123456789012345678901234567890"
            );
            
            expect(await axelarBridge.isChainRegistered("Polygon")).to.be.true;
            expect(await axelarBridge.getSatelliteAddress("Polygon"))
                .to.equal("0x1234567890123456789012345678901234567890");
        });
        
        it("should prevent duplicate registration", async function () {
            await axelarBridge.connect(admin).registerChain("Polygon", "0x123");
            
            await expect(
                axelarBridge.connect(admin).registerChain("Polygon", "0x456")
            ).to.be.revertedWith("Chain already registered");
        });
        
        it("should update satellite address", async function () {
            await axelarBridge.connect(admin).registerChain("Polygon", "0x123");
            
            await axelarBridge.connect(admin).updateSatellite("Polygon", "0x456");
            
            expect(await axelarBridge.getSatelliteAddress("Polygon"))
                .to.equal("0x456");
        });
        
        it("should unregister chain", async function () {
            await axelarBridge.connect(admin).registerChain("Polygon", "0x123");
            
            await axelarBridge.connect(admin).unregisterChain("Polygon");
            
            expect(await axelarBridge.isChainRegistered("Polygon")).to.be.false;
        });
        
        it("should only allow admin to register chains", async function () {
            await expect(
                axelarBridge.connect(user1).registerChain("Polygon", "0x123")
            ).to.be.revertedWithCustomError(axelarBridge, "AccessControlUnauthorizedAccount");
        });
    });
    
    describe("Message Processing", function () {
        beforeEach(async function () {
            // Register chain for testing
            await axelarBridge.connect(admin).registerChain(
                "Polygon",
                "0xSatelliteAddress"
            );
        });
        
        it("should process CREATE_OFFER message", async function () {
            // Prepare message
            const MessageTypes = await ethers.getContractFactory("contracts/crosschain/MessageTypes.sol:MessageTypes");
            
            const message = {
                messageType: 0, // CREATE_OFFER
                sender: user1.address,
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
            
            // Simulate Axelar callback
            await mockGateway.callExecute(
                await axelarBridge.getAddress(),
                "Polygon",
                "0xSatelliteAddress",
                encodedMessage
            );
            
            // Verify processing
            const messageId = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ["string", "address", "uint256", "uint256", "uint8"],
                    ["Polygon", message.sender, message.sourceChainId, message.nonce, message.messageType]
                )
            );
            
            expect(await axelarBridge.isMessageProcessed(messageId)).to.be.true;
        });
        
        it("should prevent replay attacks", async function () {
            const message = {
                messageType: 0, // CREATE_OFFER
                sender: user1.address,
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
            
            // First execution should succeed
            await mockGateway.callExecute(
                await axelarBridge.getAddress(),
                "Polygon",
                "0xSatelliteAddress",
                encodedMessage
            );
            
            // Second execution should fail
            await expect(
                mockGateway.callExecute(
                    await axelarBridge.getAddress(),
                    "Polygon",
                    "0xSatelliteAddress",
                    encodedMessage
                )
            ).to.be.revertedWith("Already processed");
        });
        
        it("should reject messages from unregistered chains", async function () {
            const message = {
                messageType: 0,
                sender: user1.address,
                sourceChainId: 43114, // Avalanche
                nonce: 1,
                payload: "0x"
            };
            
            const encodedMessage = ethers.AbiCoder.defaultAbiCoder().encode(
                ["uint8", "address", "uint256", "uint256", "bytes"],
                [message.messageType, message.sender, message.sourceChainId, message.nonce, message.payload]
            );
            
            await expect(
                mockGateway.callExecute(
                    await axelarBridge.getAddress(),
                    "Avalanche",
                    "0xSomeAddress",
                    encodedMessage
                )
            ).to.be.revertedWith("Unregistered chain");
        });
    });
    
    describe("Message Sending", function () {
        beforeEach(async function () {
            await axelarBridge.connect(admin).registerChain(
                "Polygon",
                "0xSatelliteAddress"
            );
        });
        
        it("should send message to registered chain", async function () {
            const message = {
                messageType: 0,
                sender: user1.address,
                sourceChainId: 56, // BSC
                nonce: await axelarBridge.getMessageNonce(),
                payload: "0x1234"
            };
            
            await expect(
                axelarBridge.connect(user1).sendMessage("Polygon", message)
            ).to.emit(axelarBridge, "MessageSent");
        });
        
        it("should send message with gas payment", async function () {
            const message = {
                messageType: 0,
                sender: user1.address,
                sourceChainId: 56,
                nonce: await axelarBridge.getMessageNonce(),
                payload: "0x1234"
            };
            
            const gasAmount = ethers.parseEther("0.1");
            
            await expect(
                axelarBridge.connect(user1).sendMessageWithGas(
                    "Polygon",
                    message,
                    300000,
                    user1.address,
                    { value: gasAmount }
                )
            ).to.emit(axelarBridge, "MessageSent");
            
            // Verify gas payment was recorded
            // This would be checked in the mock gas service
        });
        
        it("should reject message to unregistered chain", async function () {
            const message = {
                messageType: 0,
                sender: user1.address,
                sourceChainId: 56,
                nonce: 1,
                payload: "0x1234"
            };
            
            await expect(
                axelarBridge.connect(user1).sendMessage("Avalanche", message)
            ).to.be.revertedWith("Unregistered chain");
        });
    });
    
    describe("Emergency Functions", function () {
        beforeEach(async function () {
            await axelarBridge.connect(admin).registerChain(
                "Polygon",
                "0xSatelliteAddress"
            );
        });
        
        it("should pause specific chain", async function () {
            await axelarBridge.connect(emergency).pauseChain("Polygon");
            
            const message = {
                messageType: 0,
                sender: user1.address,
                sourceChainId: 56,
                nonce: 1,
                payload: "0x1234"
            };
            
            await expect(
                axelarBridge.connect(user1).sendMessage("Polygon", message)
            ).to.be.revertedWith("Chain paused");
        });
        
        it("should unpause specific chain", async function () {
            await axelarBridge.connect(emergency).pauseChain("Polygon");
            await axelarBridge.connect(emergency).unpauseChain("Polygon");
            
            const message = {
                messageType: 0,
                sender: user1.address,
                sourceChainId: 56,
                nonce: 1,
                payload: "0x1234"
            };
            
            await expect(
                axelarBridge.connect(user1).sendMessage("Polygon", message)
            ).to.emit(axelarBridge, "MessageSent");
        });
        
        it("should pause all operations", async function () {
            await axelarBridge.connect(emergency).pauseAll();
            
            const message = {
                messageType: 0,
                sender: user1.address,
                sourceChainId: 56,
                nonce: 1,
                payload: "0x1234"
            };
            
            await expect(
                axelarBridge.connect(user1).sendMessage("Polygon", message)
            ).to.be.revertedWithCustomError(axelarBridge, "EnforcedPause");
        });
        
        it("should only allow emergency role to pause", async function () {
            await expect(
                axelarBridge.connect(user1).pauseChain("Polygon")
            ).to.be.revertedWithCustomError(axelarBridge, "AccessControlUnauthorizedAccount");
        });
    });
    
    describe("Configuration", function () {
        it("should update hub address", async function () {
            const newHub = user2.address; // Using user2 as mock new hub
            
            await axelarBridge.connect(admin).setHub(newHub);
            
            expect(await axelarBridge.hub()).to.equal(newHub);
        });
        
        it("should update gas service", async function () {
            const newGasService = user2.address; // Using user2 as mock new gas service
            
            await axelarBridge.connect(admin).setGasService(newGasService);
            
            expect(await axelarBridge.gasService()).to.equal(newGasService);
        });
        
        it("should update message expiry", async function () {
            const newExpiry = 7200; // 2 hours
            
            await axelarBridge.connect(admin).setMessageExpiry(newExpiry);
            
            expect(await axelarBridge.messageExpiry()).to.equal(newExpiry);
        });
        
        it("should reject invalid message expiry", async function () {
            await expect(
                axelarBridge.connect(admin).setMessageExpiry(600) // 10 minutes - too short
            ).to.be.revertedWith("Invalid expiry");
            
            await expect(
                axelarBridge.connect(admin).setMessageExpiry(100000) // Too long
            ).to.be.revertedWith("Invalid expiry");
        });
    });
    
    describe("Upgrade Authorization", function () {
        it("should allow admin to authorize upgrade", async function () {
            const AxelarBridgeV2 = await ethers.getContractFactory("AxelarBridge");
            
            await expect(
                upgrades.upgradeProxy(
                    await axelarBridge.getAddress(),
                    AxelarBridgeV2
                )
            ).to.not.be.reverted;
        });
        
        it("should prevent non-admin from authorizing upgrade", async function () {
            // This test would need a custom implementation to properly test
            // as the upgrade authorization is internal
        });
    });
});
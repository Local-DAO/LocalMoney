const { ethers, upgrades } = require("hardhat");

async function deployAllContractsWithRoles() {
    const [admin, user1, user2, user3, user4, user5] = await ethers.getSigners();
    
    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const mockToken = await MockERC20.deploy("Test Token", "TEST");
    await mockToken.waitForDeployment();
    
    const localToken = await MockERC20.deploy("Local Token", "LOCAL");
    await localToken.waitForDeployment();
    
    // Create hub configuration
    const hubConfig = {
        offerContract: ethers.ZeroAddress,
        tradeContract: ethers.ZeroAddress,
        profileContract: ethers.ZeroAddress,
        priceContract: ethers.ZeroAddress,
        treasury: admin.address,
        localMarket: admin.address,
        priceProvider: admin.address,
        localTokenAddress: await localToken.getAddress(),
        chainFeeCollector: admin.address,
        swapRouter: ethers.ZeroAddress,
        burnFeePct: 100,   // 1%
        chainFeePct: 100,  // 1%
        warchestFeePct: 100, // 1%
        conversionFeePct: 100, // 1%
        arbitratorFeePct: 100, // 1%
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
    
    // Deploy Hub with timelock
    const Hub = await ethers.getContractFactory("Hub");
    const minDelay = 2 * 24 * 60 * 60; // 2 days
    const hub = await upgrades.deployProxy(Hub, [hubConfig, minDelay], {
        initializer: "initialize",
        kind: "uups"
    });
    await hub.waitForDeployment();
    
    // Deploy Profile
    const Profile = await ethers.getContractFactory("Profile");
    const profile = await upgrades.deployProxy(Profile, [await hub.getAddress()], {
        initializer: "initialize",
        kind: "uups"
    });
    await profile.waitForDeployment();
    
    // Deploy Offer
    const Offer = await ethers.getContractFactory("Offer");
    const offer = await upgrades.deployProxy(Offer, [await hub.getAddress(), await profile.getAddress()], {
        initializer: "initialize",
        kind: "uups"
    });
    await offer.waitForDeployment();
    
    // Deploy PriceOracle
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    const priceOracle = await upgrades.deployProxy(PriceOracle, 
        [await hub.getAddress(), ethers.ZeroAddress], {
        initializer: "initialize",
        kind: "uups"
    });
    await priceOracle.waitForDeployment();
    
    // Deploy Escrow
    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await upgrades.deployProxy(Escrow, 
        [await hub.getAddress(), await priceOracle.getAddress(), ethers.ZeroAddress], {
        initializer: "initialize",
        kind: "uups"
    });
    await escrow.waitForDeployment();
    
    // Deploy ArbitratorManager
    const ArbitratorManager = await ethers.getContractFactory("ArbitratorManager");
    const arbitratorManager = await upgrades.deployProxy(ArbitratorManager, 
        [await hub.getAddress(), ethers.ZeroAddress], {
        initializer: "initialize",
        kind: "uups"
    });
    await arbitratorManager.waitForDeployment();
    
    // Deploy Trade
    const Trade = await ethers.getContractFactory("Trade");
    const trade = await upgrades.deployProxy(Trade, [
        await hub.getAddress(),
        await offer.getAddress(),
        await profile.getAddress(),
        await escrow.getAddress(),
        await arbitratorManager.getAddress()
    ], {
        initializer: "initialize",
        kind: "uups"
    });
    await trade.waitForDeployment();
    
    // Update hub config with all contract addresses
    hubConfig.offerContract = await offer.getAddress();
    hubConfig.tradeContract = await trade.getAddress();
    hubConfig.profileContract = await profile.getAddress();
    hubConfig.priceContract = await priceOracle.getAddress();
    await hub.updateConfig(hubConfig);
    
    // Grant necessary roles
    const TRADE_CONTRACT_ROLE = await escrow.TRADE_CONTRACT_ROLE();
    await escrow.grantRole(TRADE_CONTRACT_ROLE, await trade.getAddress());
    
    const ARB_TRADE_ROLE = await arbitratorManager.TRADE_CONTRACT_ROLE();
    await arbitratorManager.grantRole(ARB_TRADE_ROLE, await trade.getAddress());
    
    return {
        hub,
        profile,
        offer,
        trade,
        escrow,
        arbitratorManager,
        priceOracle,
        mockToken,
        localToken,
        signers: [admin, user1, user2, user3, user4, user5]
    };
}

module.exports = { deployAllContractsWithRoles };
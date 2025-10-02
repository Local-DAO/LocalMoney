const { ethers, upgrades } = require("hardhat");

async function deployAllContracts(signers) {
    const [admin] = signers;
    
    // Deploy mock token
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
    
    // Deploy Hub
    const Hub = await ethers.getContractFactory("Hub");
    const minDelay = 2 * 24 * 60 * 60; // 2 days timelock
    const hub = await upgrades.deployProxy(Hub, [hubConfig, minDelay]);
    await hub.waitForDeployment();
    
    // Deploy Profile
    const Profile = await ethers.getContractFactory("Profile");
    const profile = await upgrades.deployProxy(Profile, [await hub.getAddress()]);
    await profile.waitForDeployment();
    
    // Deploy Offer
    const Offer = await ethers.getContractFactory("Offer");
    const offer = await upgrades.deployProxy(Offer, [await hub.getAddress(), await profile.getAddress()]);
    await offer.waitForDeployment();
    
    // Deploy PriceOracle
    const PriceOracle = await ethers.getContractFactory("PriceOracle");
    const priceOracle = await upgrades.deployProxy(PriceOracle, 
        [await hub.getAddress(), ethers.ZeroAddress]
    );
    await priceOracle.waitForDeployment();
    
    // Deploy Escrow
    const Escrow = await ethers.getContractFactory("Escrow");
    const escrow = await upgrades.deployProxy(Escrow, 
        [await hub.getAddress(), await priceOracle.getAddress(), ethers.ZeroAddress]
    );
    await escrow.waitForDeployment();
    
    // Deploy ArbitratorManager
    const ArbitratorManager = await ethers.getContractFactory("ArbitratorManager");
    const arbitratorManager = await upgrades.deployProxy(ArbitratorManager, 
        [await hub.getAddress(), ethers.ZeroAddress]
    );
    await arbitratorManager.waitForDeployment();
    
    // Deploy Trade
    const Trade = await ethers.getContractFactory("Trade");
    const trade = await upgrades.deployProxy(Trade, [
        await hub.getAddress(),
        await offer.getAddress(),
        await profile.getAddress(),
        await escrow.getAddress(),
        await arbitratorManager.getAddress()
    ]);
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
    await arbitratorManager.grantRole(TRADE_CONTRACT_ROLE, await trade.getAddress());
    
    return {
        hub,
        profile,
        offer,
        trade,
        escrow,
        arbitratorManager,
        priceOracle,
        mockToken,
        localToken
    };
}

async function createOffer(offer, seller, tokenAddress, minAmount, maxAmount, rate, fiatCurrency, instructions) {
    const tx = await offer.connect(seller).createOffer(
        0, // sell offer
        tokenAddress,
        minAmount,
        maxAmount,
        rate,
        fiatCurrency,
        instructions
    );
    const receipt = await tx.wait();
    
    // Extract offer ID from event
    const event = receipt.logs.find(log => {
        try {
            const parsed = offer.interface.parseLog(log);
            return parsed.name === "OfferCreated";
        } catch {
            return false;
        }
    });
    
    if (event) {
        const parsed = offer.interface.parseLog(event);
        return parsed.args.offerId;
    }
    
    // Fallback to sequential ID
    return 1n;
}

async function createTrade(trade, buyer, offerId, amount, contact) {
    const tx = await trade.connect(buyer).createTrade(offerId, amount, contact);
    const receipt = await tx.wait();
    
    // Extract trade ID from event
    const event = receipt.logs.find(log => {
        try {
            const parsed = trade.interface.parseLog(log);
            return parsed.name === "TradeCreated";
        } catch {
            return false;
        }
    });
    
    if (event) {
        const parsed = trade.interface.parseLog(event);
        return parsed.args.tradeId;
    }
    
    // Fallback
    return 1n;
}

module.exports = {
    deployAllContracts,
    createOffer,
    createTrade
};
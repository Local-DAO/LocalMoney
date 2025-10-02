const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe.skip("Trade Contract", function () {
    let Hub, Offer, Profile, Trade, Escrow, ArbitratorManager, PriceOracle, MockERC20;
    let hub, offer, profile, trade, escrow, arbitratorManager, priceOracle, mockToken;
    let owner, buyer, seller, arbitrator, treasury, localMarket;
    let defaultHubConfig;

    // Trade states enum
    const TradeState = {
        RequestCreated: 0,
        RequestAccepted: 1,
        EscrowFunded: 2,
        FiatDeposited: 3,
        EscrowReleased: 4,
        EscrowCancelled: 5,
        EscrowRefunded: 6,
        EscrowDisputed: 7,
        DisputeResolved: 8
    };

    // Offer types enum
    const OfferType = {
        Buy: 0,
        Sell: 1
    };

    const OfferState = {
        Active: 0,
        Paused: 1,
        Archived: 2
    };

    beforeEach(async function () {
        // Get signers
        [owner, buyer, seller, arbitrator, treasury, localMarket] = await ethers.getSigners();

        // Deploy Mock ERC20 Token
        MockERC20 = await ethers.getContractFactory("MockERC20");
        mockToken = await MockERC20.deploy("Test Token", "TEST", 18);
        await mockToken.waitForDeployment();

        // Create default hub configuration
        defaultHubConfig = {
            offerContract: ethers.ZeroAddress, // Will be set after deployment
            tradeContract: ethers.ZeroAddress, // Will be set after deployment
            profileContract: ethers.ZeroAddress, // Will be set after deployment
            priceContract: owner.address,
            treasury: treasury.address,
            localMarket: localMarket.address,
            priceProvider: owner.address,
            localTokenAddress: ethers.ZeroAddress,
            chainFeeCollector: owner.address,
            swapRouter: ethers.ZeroAddress,
            burnFeePct: 100,  // 1%
            chainFeePct: 200, // 2%
            warchestFeePct: 300, // 3%
            conversionFeePct: 50, // 0.5%
            arbitratorFeePct: 100, // 1%
            minTradeAmount: ethers.parseUnits("10", 6), // $10 in USD cents
            maxTradeAmount: ethers.parseUnits("10000", 6), // $10,000 in USD cents
            maxActiveOffers: 10,
            maxActiveTrades: 5,
            tradeExpirationTimer: 24 * 60 * 60, // 24 hours
            tradeDisputeTimer: 7 * 24 * 60 * 60, // 7 days
            globalPause: false,
            pauseNewTrades: false,
            pauseDeposits: false,
            pauseWithdrawals: false
        };

        // Deploy Hub contract
        Hub = await ethers.getContractFactory("Hub");
        const minDelay = 2 * 24 * 60 * 60; // 2 days timelock
        hub = await upgrades.deployProxy(Hub, [defaultHubConfig, minDelay], {
            initializer: "initialize",
            kind: "uups"
        });
        await hub.waitForDeployment();

        // Deploy Profile contract
        Profile = await ethers.getContractFactory("Profile");
        profile = await upgrades.deployProxy(Profile, [await hub.getAddress()], {
            initializer: "initialize",
            kind: "uups"
        });
        await profile.waitForDeployment();

        // Deploy Offer contract
        Offer = await ethers.getContractFactory("Offer");
        offer = await upgrades.deployProxy(Offer, [await hub.getAddress()], {
            initializer: "initialize",
            kind: "uups"
        });
        await offer.waitForDeployment();
        
        // Deploy PriceOracle
        PriceOracle = await ethers.getContractFactory("PriceOracle");
        priceOracle = await upgrades.deployProxy(PriceOracle, 
            [await hub.getAddress(), ethers.ZeroAddress]
        );
        await priceOracle.waitForDeployment();
        
        // Deploy Escrow
        Escrow = await ethers.getContractFactory("Escrow");
        escrow = await upgrades.deployProxy(Escrow, 
            [await hub.getAddress(), await priceOracle.getAddress(), ethers.ZeroAddress]
        );
        await escrow.waitForDeployment();
        
        // Deploy ArbitratorManager
        ArbitratorManager = await ethers.getContractFactory("ArbitratorManager");
        arbitratorManager = await upgrades.deployProxy(ArbitratorManager, 
            [await hub.getAddress(), ethers.ZeroAddress]
        );
        await arbitratorManager.waitForDeployment();

        // Deploy Trade contract
        Trade = await ethers.getContractFactory("Trade");
        trade = await upgrades.deployProxy(Trade, [
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
        
        // Grant Trade contract role to Trade in Escrow and ArbitratorManager
        await escrow.grantRole(await escrow.TRADE_CONTRACT_ROLE(), await trade.getAddress());
        await arbitratorManager.grantRole(await arbitratorManager.TRADE_CONTRACT_ROLE(), await trade.getAddress());

        // Update hub config with deployed contract addresses
        const updatedConfig = {
            ...defaultHubConfig,
            offerContract: await offer.getAddress(),
            tradeContract: await trade.getAddress(),
            profileContract: await profile.getAddress(),
            priceContract: await priceOracle.getAddress()
        };
        await hub.updateConfig(updatedConfig);

        // Mint tokens to seller for testing
        await mockToken.mint(seller.address, ethers.parseUnits("1000", 18));
        await mockToken.connect(seller).approve(await trade.getAddress(), ethers.parseUnits("1000", 18));
    });

    describe.skip("Initialization", function () {
        it("Should initialize with correct addresses", async function () {
            expect(await trade.hub()).to.equal(await hub.getAddress());
            expect(await trade.offerContract()).to.equal(await offer.getAddress());
            expect(await trade.profileContract()).to.equal(await profile.getAddress());
            expect(await trade.nextTradeId()).to.equal(1);
        });

        it("Should not allow zero addresses in initialization", async function () {
            const Trade = await ethers.getContractFactory("Trade");
            
            await expect(
                upgrades.deployProxy(Trade, [
                    ethers.ZeroAddress,
                    await offer.getAddress(),
                    await profile.getAddress()
                ], {
                    initializer: "initialize",
                    kind: "uups"
                })
            ).to.be.revertedWith("Invalid hub address");
        });
    });

    describe("Trade Creation", function () {
        let offerId;

        beforeEach(async function () {
            // Create profiles first
            await profile.connect(seller).updateContact("seller_info", "seller_pubkey");
            await profile.connect(buyer).updateContact("buyer_info", "buyer_pubkey");
            
            // Create an offer first
            await offer.connect(seller).createOffer(
                OfferType.Sell, // sell offer
                await mockToken.getAddress(),
                ethers.parseUnits("1", 18), // min 1 token
                ethers.parseUnits("10", 18), // max 10 tokens
                ethers.parseUnits("100", 18), // rate: 100 USD per token
                "USD",
                "Test offer"
            );
            offerId = 1;
        });

        it("Should create trade successfully", async function () {
            const tradeAmount = ethers.parseUnits("5", 18);
            const buyerContact = "encrypted_buyer_contact";

            const tx = await trade.connect(buyer).createTrade(
                offerId,
                tradeAmount,
                buyerContact
            );

            const receipt = await tx.wait();
            const tradeCreatedEvent = receipt.logs.find(log => {
                try {
                    const parsed = trade.interface.parseLog(log);
                    return parsed.name === "TradeCreated";
                } catch {
                    return false;
                }
            });

            expect(tradeCreatedEvent).to.not.be.undefined;
            
            const tradeId = 1;
            const createdTrade = await trade.getTrade(tradeId);
            
            expect(createdTrade.id).to.equal(tradeId);
            expect(createdTrade.offerId).to.equal(offerId);
            expect(createdTrade.buyer).to.equal(buyer.address);
            expect(createdTrade.seller).to.equal(seller.address);
            expect(createdTrade.amount).to.equal(tradeAmount);
            expect(createdTrade.state).to.equal(TradeState.RequestCreated);
            expect(createdTrade.buyerContact).to.equal(buyerContact);
        });

        it("Should not allow trading with inactive offer", async function () {
            // Pause the offer
            await offer.connect(seller).pauseOffer(offerId);

            await expect(
                trade.connect(buyer).createTrade(
                    offerId,
                    ethers.parseUnits("5", 18),
                    "contact"
                )
            ).to.be.revertedWithCustomError(trade, "OfferNotActive");
        });

        it("Should not allow amount outside offer range", async function () {
            // Too small
            await expect(
                trade.connect(buyer).createTrade(
                    offerId,
                    ethers.parseUnits("0.5", 18),
                    "contact"
                )
            ).to.be.revertedWithCustomError(trade, "AmountOutOfRange");

            // Too large
            await expect(
                trade.connect(buyer).createTrade(
                    offerId,
                    ethers.parseUnits("15", 18),
                    "contact"
                )
            ).to.be.revertedWithCustomError(trade, "AmountOutOfRange");
        });

        it("Should not allow self-trading", async function () {
            await expect(
                trade.connect(seller).createTrade(
                    offerId,
                    ethers.parseUnits("5", 18),
                    "contact"
                )
            ).to.be.revertedWithCustomError(trade, "SelfTradeNotAllowed");
        });

        it("Should calculate correct fiat amount", async function () {
            const tradeAmount = ethers.parseUnits("5", 18);
            const expectedFiatAmount = (tradeAmount * ethers.parseUnits("100", 18)) / ethers.parseUnits("1", 18);

            await trade.connect(buyer).createTrade(
                offerId,
                tradeAmount,
                "contact"
            );

            const createdTrade = await trade.getTrade(1);
            expect(createdTrade.fiatAmount).to.equal(expectedFiatAmount);
        });
    });

    describe("Trade Acceptance", function () {
        let tradeId;

        beforeEach(async function () {
            // Create offer and trade
            await offer.connect(seller).createOffer(
                OfferType.Sell,
                "USD",
                await mockToken.getAddress(),
                ethers.parseUnits("1", 18),
                ethers.parseUnits("10", 18),
                ethers.parseUnits("100", 18),
                "Test offer"
            );
            
            await trade.connect(buyer).createTrade(
                1, // offerId
                ethers.parseUnits("5", 18),
                "buyer_contact"
            );
            tradeId = 1;
        });

        it("Should accept trade successfully", async function () {
            const sellerContact = "encrypted_seller_contact";

            await trade.connect(seller).acceptTrade(tradeId, sellerContact);

            const acceptedTrade = await trade.getTrade(tradeId);
            expect(acceptedTrade.state).to.equal(TradeState.RequestAccepted);
            expect(acceptedTrade.sellerContact).to.equal(sellerContact);
        });

        it("Should not allow non-seller to accept", async function () {
            await expect(
                trade.connect(buyer).acceptTrade(tradeId, "contact")
            ).to.be.revertedWithCustomError(trade, "UnauthorizedAccess");
        });

        it("Should not allow accepting trade in wrong state", async function () {
            await trade.connect(seller).acceptTrade(tradeId, "contact");
            
            await expect(
                trade.connect(seller).acceptTrade(tradeId, "contact")
            ).to.be.revertedWithCustomError(trade, "InvalidStateTransition");
        });
    });

    describe("Escrow Funding", function () {
        let tradeId;

        beforeEach(async function () {
            // Create and accept trade
            await offer.connect(seller).createOffer(
                OfferType.Sell,
                "USD",
                await mockToken.getAddress(),
                ethers.parseUnits("1", 18),
                ethers.parseUnits("10", 18),
                ethers.parseUnits("100", 18),
                "Test offer"
            );
            
            await trade.connect(buyer).createTrade(
                1,
                ethers.parseUnits("5", 18),
                "buyer_contact"
            );
            tradeId = 1;

            await trade.connect(seller).acceptTrade(tradeId, "seller_contact");
        });

        it("Should fund escrow with ERC20 tokens successfully", async function () {
            const tradeAmount = ethers.parseUnits("5", 18);

            await trade.connect(seller).fundEscrow(tradeId);

            const fundedTrade = await trade.getTrade(tradeId);
            expect(fundedTrade.state).to.equal(TradeState.EscrowFunded);
            
            const escrowBalance = await trade.escrowBalances(tradeId);
            expect(escrowBalance).to.equal(tradeAmount);

            // Check token was transferred to trade contract
            const tradeContractBalance = await mockToken.balanceOf(await trade.getAddress());
            expect(tradeContractBalance).to.equal(tradeAmount);
        });

        it("Should fund escrow with ETH successfully", async function () {
            // Create ETH offer and trade
            await offer.connect(seller).createOffer(
                OfferType.Sell,
                "USD",
                ethers.ZeroAddress, // ETH
                ethers.parseEther("0.1"),
                ethers.parseEther("1"),
                ethers.parseUnits("2000", 18), // $2000 per ETH
                "ETH offer"
            );
            
            await trade.connect(buyer).createTrade(
                2, // new offerId
                ethers.parseEther("0.5"),
                "buyer_contact"
            );
            
            await trade.connect(seller).acceptTrade(2, "seller_contact");

            const tradeAmount = ethers.parseEther("0.5");
            await trade.connect(seller).fundEscrow(2, { value: tradeAmount });

            const fundedTrade = await trade.getTrade(2);
            expect(fundedTrade.state).to.equal(TradeState.EscrowFunded);
            
            const escrowBalance = await trade.escrowBalances(2);
            expect(escrowBalance).to.equal(tradeAmount);
        });

        it("Should not allow incorrect ETH amount", async function () {
            // Create ETH trade first
            await offer.connect(seller).createOffer(
                OfferType.Sell,
                "USD",
                ethers.ZeroAddress,
                ethers.parseEther("0.1"),
                ethers.parseEther("1"),
                ethers.parseUnits("2000", 18),
                "ETH offer"
            );
            
            await trade.connect(buyer).createTrade(
                2,
                ethers.parseEther("0.5"),
                "buyer_contact"
            );
            
            await trade.connect(seller).acceptTrade(2, "seller_contact");

            await expect(
                trade.connect(seller).fundEscrow(2, { value: ethers.parseEther("0.3") })
            ).to.be.revertedWithCustomError(trade, "IncorrectPaymentAmount");
        });

        it("Should not allow funding by non-seller", async function () {
            await expect(
                trade.connect(buyer).fundEscrow(tradeId)
            ).to.be.revertedWithCustomError(trade, "UnauthorizedAccess");
        });
    });

    describe("Fiat Deposit Marking", function () {
        let tradeId;

        beforeEach(async function () {
            // Create, accept, and fund trade
            await offer.connect(seller).createOffer(
                OfferType.Sell,
                "USD",
                await mockToken.getAddress(),
                ethers.parseUnits("1", 18),
                ethers.parseUnits("10", 18),
                ethers.parseUnits("100", 18),
                "Test offer"
            );
            
            await trade.connect(buyer).createTrade(
                1,
                ethers.parseUnits("5", 18),
                "buyer_contact"
            );
            tradeId = 1;

            await trade.connect(seller).acceptTrade(tradeId, "seller_contact");
            await trade.connect(seller).fundEscrow(tradeId);
        });

        it("Should mark fiat deposited successfully", async function () {
            await trade.connect(buyer).markFiatDeposited(tradeId);

            const updatedTrade = await trade.getTrade(tradeId);
            expect(updatedTrade.state).to.equal(TradeState.FiatDeposited);
            expect(updatedTrade.disputeDeadline).to.be.gt(0);
        });

        it("Should not allow non-buyer to mark fiat deposited", async function () {
            await expect(
                trade.connect(seller).markFiatDeposited(tradeId)
            ).to.be.revertedWithCustomError(trade, "UnauthorizedAccess");
        });
    });

    describe("Escrow Release", function () {
        let tradeId;

        beforeEach(async function () {
            // Create full trade flow up to fiat deposited
            await offer.connect(seller).createOffer(
                OfferType.Sell,
                "USD",
                await mockToken.getAddress(),
                ethers.parseUnits("1", 18),
                ethers.parseUnits("10", 18),
                ethers.parseUnits("100", 18),
                "Test offer"
            );
            
            await trade.connect(buyer).createTrade(
                1,
                ethers.parseUnits("5", 18),
                "buyer_contact"
            );
            tradeId = 1;

            await trade.connect(seller).acceptTrade(tradeId, "seller_contact");
            await trade.connect(seller).fundEscrow(tradeId);
            await trade.connect(buyer).markFiatDeposited(tradeId);
        });

        it("Should release escrow successfully with fee distribution", async function () {
            const initialBuyerBalance = await mockToken.balanceOf(buyer.address);
            const initialTreasuryBalance = await mockToken.balanceOf(treasury.address);
            const initialLocalMarketBalance = await mockToken.balanceOf(localMarket.address);

            await trade.connect(seller).releaseEscrow(tradeId);

            const releasedTrade = await trade.getTrade(tradeId);
            expect(releasedTrade.state).to.equal(TradeState.EscrowReleased);

            // Check escrow balance is zeroed
            const escrowBalance = await trade.escrowBalances(tradeId);
            expect(escrowBalance).to.equal(0);

            // Check fee distribution (1% + 2% + 3% = 6% total fees)
            const tradeAmount = ethers.parseUnits("5", 18);
            const totalFees = (tradeAmount * 600n) / 10000n; // 6%
            const expectedBuyerAmount = tradeAmount - totalFees;

            const finalBuyerBalance = await mockToken.balanceOf(buyer.address);
            expect(finalBuyerBalance - initialBuyerBalance).to.equal(expectedBuyerAmount);

            // Verify fees were distributed
            const finalTreasuryBalance = await mockToken.balanceOf(treasury.address);
            const finalLocalMarketBalance = await mockToken.balanceOf(localMarket.address);
            
            expect(finalTreasuryBalance).to.be.gt(initialTreasuryBalance);
            expect(finalLocalMarketBalance).to.be.gt(initialLocalMarketBalance);
        });

        it("Should not allow non-seller to release escrow", async function () {
            await expect(
                trade.connect(buyer).releaseEscrow(tradeId)
            ).to.be.revertedWithCustomError(trade, "UnauthorizedAccess");
        });
    });

    describe("Trade Cancellation", function () {
        let tradeId;

        beforeEach(async function () {
            await offer.connect(seller).createOffer(
                OfferType.Sell,
                "USD",
                await mockToken.getAddress(),
                ethers.parseUnits("1", 18),
                ethers.parseUnits("10", 18),
                ethers.parseUnits("100", 18),
                "Test offer"
            );
            
            await trade.connect(buyer).createTrade(
                1,
                ethers.parseUnits("5", 18),
                "buyer_contact"
            );
            tradeId = 1;
        });

        it("Should allow cancellation in RequestCreated state", async function () {
            await trade.connect(buyer).cancelTrade(tradeId);

            const cancelledTrade = await trade.getTrade(tradeId);
            expect(cancelledTrade.state).to.equal(TradeState.EscrowCancelled);
        });

        it("Should allow cancellation and refund when escrow is funded", async function () {
            await trade.connect(seller).acceptTrade(tradeId, "seller_contact");
            await trade.connect(seller).fundEscrow(tradeId);

            const initialSellerBalance = await mockToken.balanceOf(seller.address);
            
            await trade.connect(buyer).cancelTrade(tradeId);

            const cancelledTrade = await trade.getTrade(tradeId);
            expect(cancelledTrade.state).to.equal(TradeState.EscrowCancelled);

            // Check refund
            const finalSellerBalance = await mockToken.balanceOf(seller.address);
            expect(finalSellerBalance - initialSellerBalance).to.equal(ethers.parseUnits("5", 18));
        });

        it("Should not allow cancellation by unauthorized user", async function () {
            await expect(
                trade.connect(arbitrator).cancelTrade(tradeId)
            ).to.be.revertedWithCustomError(trade, "UnauthorizedAccess");
        });
    });

    describe("Expired Trade Refund", function () {
        let tradeId;

        beforeEach(async function () {
            await offer.connect(seller).createOffer(
                OfferType.Sell,
                "USD",
                await mockToken.getAddress(),
                ethers.parseUnits("1", 18),
                ethers.parseUnits("10", 18),
                ethers.parseUnits("100", 18),
                "Test offer"
            );
            
            await trade.connect(buyer).createTrade(
                1,
                ethers.parseUnits("5", 18),
                "buyer_contact"
            );
            tradeId = 1;

            await trade.connect(seller).acceptTrade(tradeId, "seller_contact");
            await trade.connect(seller).fundEscrow(tradeId);
        });

        it("Should refund expired funded trade", async function () {
            // Fast forward time beyond expiration
            const tradeData = await trade.getTrade(tradeId);
            await time.increaseTo(tradeData.expiresAt + 1n);

            const initialSellerBalance = await mockToken.balanceOf(seller.address);
            
            await trade.connect(arbitrator).refundExpiredTrade(tradeId);

            const refundedTrade = await trade.getTrade(tradeId);
            expect(refundedTrade.state).to.equal(TradeState.EscrowRefunded);

            const finalSellerBalance = await mockToken.balanceOf(seller.address);
            expect(finalSellerBalance - initialSellerBalance).to.equal(ethers.parseUnits("5", 18));
        });

        it("Should not allow refund before expiration", async function () {
            await expect(
                trade.connect(arbitrator).refundExpiredTrade(tradeId)
            ).to.be.revertedWithCustomError(trade, "InvalidTimestamp");
        });
    });

    describe("Fee Calculation", function () {
        it("Should calculate fees correctly", async function () {
            const amount = ethers.parseUnits("100", 18);
            const fees = await trade.calculateFees(amount);

            const expectedBurnAmount = (amount * 100n) / 10000n; // 1%
            const expectedChainAmount = (amount * 200n) / 10000n; // 2%
            const expectedWarchestAmount = (amount * 300n) / 10000n; // 3%

            expect(fees.burnAmount).to.equal(expectedBurnAmount);
            expect(fees.chainAmount).to.equal(expectedChainAmount);
            expect(fees.warchestAmount).to.equal(expectedWarchestAmount);
            expect(fees.arbitratorAmount).to.equal(0); // Phase 4 feature
        });
    });

    describe("System Pause", function () {
        it("Should prevent trade creation when paused", async function () {
            await hub.emergencyPause("Testing pause");

            await expect(
                trade.connect(buyer).createTrade(1, ethers.parseUnits("5", 18), "contact")
            ).to.be.revertedWithCustomError(trade, "SystemPaused");
        });

        it("Should prevent other operations when paused", async function () {
            // Create trade first
            await offer.connect(seller).createOffer(
                OfferType.Sell,
                "USD",
                await mockToken.getAddress(),
                ethers.parseUnits("1", 18),
                ethers.parseUnits("10", 18),
                ethers.parseUnits("100", 18),
                "Test offer"
            );
            
            await trade.connect(buyer).createTrade(
                1,
                ethers.parseUnits("5", 18),
                "buyer_contact"
            );

            // Pause system
            await hub.emergencyPause("Testing pause");

            await expect(
                trade.connect(seller).acceptTrade(1, "seller_contact")
            ).to.be.revertedWithCustomError(trade, "SystemPaused");
        });
    });

    describe("Gas Optimization", function () {
        it("Should use reasonable gas for trade creation", async function () {
            await offer.connect(seller).createOffer(
                OfferType.Sell,
                "USD",
                await mockToken.getAddress(),
                ethers.parseUnits("1", 18),
                ethers.parseUnits("10", 18),
                ethers.parseUnits("100", 18),
                "Test offer"
            );

            const tx = await trade.connect(buyer).createTrade(
                1,
                ethers.parseUnits("5", 18),
                "buyer_contact"
            );
            
            const receipt = await tx.wait();
            
            // Should be under 200k gas as per PRP requirement
            expect(receipt.gasUsed).to.be.lt(200000);
        });
    });
});

// Mock ERC20 contract for testing
describe("MockERC20", function() {
    it("Should deploy MockERC20 for testing", async function () {
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const mockToken = await MockERC20.deploy("Test Token", "TEST", 18);
        await mockToken.waitForDeployment();
        
        expect(await mockToken.name()).to.equal("Test Token");
        expect(await mockToken.symbol()).to.equal("TEST");
        expect(await mockToken.decimals()).to.equal(18);
    });
});
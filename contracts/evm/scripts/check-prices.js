require("dotenv").config();
const { ethers } = require("hardhat");

async function main() {
    console.log("=".repeat(70));
    console.log("Checking PriceOracle on BSC Mainnet");
    console.log("=".repeat(70));
    
    const PRICE_ORACLE_ADDRESS = "0x5C1e0CE9F02434241d8950ea13D96B5Ed6af44E2";
    
    const provider = ethers.provider;
    const network = await provider.getNetwork();
    
    console.log("\nNetwork: BSC Mainnet");
    console.log("Chain ID:", network.chainId);
    console.log("PriceOracle Address:", PRICE_ORACLE_ADDRESS);
    
    try {
        // Get PriceOracle contract
        const priceOracle = await ethers.getContractAt("PriceOracle", PRICE_ORACLE_ADDRESS);
        
        // Check some common currency prices
        const currencies = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "CNY", "COP", "MXN", "BRL", "ARS", "NGN", "ZAR", "EGP", "KES", "VND", "THB", "SGD", "MYR", "PHP", "IDR"];
        
        console.log("\n📊 Current Prices (in cents per USD):");
        console.log("=".repeat(70));
        
        for (const currency of currencies) {
            try {
                const price = await priceOracle.getFiatPrice(currency);
                const formattedPrice = price > 0 ? (Number(price) / 100).toFixed(4) : "NOT SET";
                console.log(`   ${currency.padEnd(5)}: ${formattedPrice}`);
            } catch (error) {
                console.log(`   ${currency.padEnd(5)}: ERROR - ${error.message}`);
            }
        }
        
        // Check if price updater role is set
        console.log("\n🔐 Access Control:");
        console.log("=".repeat(70));
        
        try {
            // Check who has PRICE_UPDATER_ROLE
            const PRICE_UPDATER_ROLE = await priceOracle.PRICE_UPDATER_ROLE();
            console.log("   PRICE_UPDATER_ROLE hash:", PRICE_UPDATER_ROLE);
            
            // Check if deployer has the role
            const deployer = "0x5f6acb320B94b2A954dC0C28e037D5A761C76571";
            const hasRole = await priceOracle.hasRole(PRICE_UPDATER_ROLE, deployer);
            console.log(`   Deployer has PRICE_UPDATER_ROLE: ${hasRole}`);
            
            // Check DEFAULT_ADMIN_ROLE
            const DEFAULT_ADMIN_ROLE = await priceOracle.DEFAULT_ADMIN_ROLE();
            const hasAdminRole = await priceOracle.hasRole(DEFAULT_ADMIN_ROLE, deployer);
            console.log(`   Deployer has DEFAULT_ADMIN_ROLE: ${hasAdminRole}`);
            
        } catch (error) {
            console.log("   Could not check roles:", error.message);
        }
        
        // Check staleness parameters
        console.log("\n⏰ Staleness Configuration:");
        console.log("=".repeat(70));
        
        try {
            const maxPriceAge = await priceOracle.maxPriceAge();
            console.log(`   Max Price Age: ${maxPriceAge} seconds (${Number(maxPriceAge) / 3600} hours)`);
            
            // Check price age for USD
            const priceAge = await priceOracle.getPriceAge("USD");
            console.log(`   USD Price Age: ${priceAge} seconds (${(Number(priceAge) / 3600).toFixed(2)} hours)`);
            
            // Check if USD price is valid
            const isValid = await priceOracle.isPriceValid("USD");
            
            if (!isValid) {
                console.log("   ⚠️  WARNING: USD price is stale!");
            } else {
                console.log("   ✅ USD price is fresh");
            }
            
        } catch (error) {
            console.log("   Could not check staleness parameters:", error.message);
        }
        
        console.log("\n" + "=".repeat(70));
        console.log("✅ Price check complete!");
        console.log("=".repeat(70));
        
    } catch (error) {
        console.error("\n❌ Error:", error.message);
        console.error("\nMake sure:");
        console.error("1. You have BSC RPC configured in .env or hardhat.config.js");
        console.error("2. The network is accessible");
        console.error("3. The contract is deployed at the specified address");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
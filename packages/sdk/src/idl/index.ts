/**
 * IDL exports for the LocalMoney programs
 * These are imported as JSON modules
 */

import hub from "./hub.json";
import profile from "./profile.json";
import offer from "./offer.json";
import trade from "./trade.json";
import escrow from "./escrow.json";
import arbitrator from "./arbitrator.json";
import priceOracle from "./price_oracle.json";

export const HubIDL = hub;
export const ProfileIDL = profile;
export const OfferIDL = offer;
export const TradeIDL = trade;
export const EscrowIDL = escrow;
export const ArbitratorIDL = arbitrator;
export const PriceOracleIDL = priceOracle;

export { hub, profile, offer, trade, escrow, arbitrator, priceOracle };

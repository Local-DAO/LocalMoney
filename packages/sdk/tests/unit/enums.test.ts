/**
 * Enum conversion tests
 */

import {
  OfferType,
  OfferState,
  TradeState,
  toOfferType,
  toOfferState,
  toTradeState,
  fromOfferType,
  fromOfferState,
  isTerminalTradeState,
  canCancelTrade,
  canFundEscrow,
  canConfirmFiat,
  canReleaseEscrow,
  canInitiateDispute,
} from "../../src/types/enums";

describe("Enum Conversions", () => {
  describe("OfferType", () => {
    it("should convert Anchor enum to SDK enum", () => {
      expect(toOfferType({ buy: {} })).toBe(OfferType.Buy);
      expect(toOfferType({ sell: {} })).toBe(OfferType.Sell);
    });

    it("should convert SDK enum to Anchor format", () => {
      expect(fromOfferType(OfferType.Buy)).toEqual({ buy: {} });
      expect(fromOfferType(OfferType.Sell)).toEqual({ sell: {} });
    });

    it("should throw on unknown OfferType", () => {
      expect(() => toOfferType({ unknown: {} })).toThrow();
    });
  });

  describe("OfferState", () => {
    it("should convert Anchor enum to SDK enum", () => {
      expect(toOfferState({ active: {} })).toBe(OfferState.Active);
      expect(toOfferState({ paused: {} })).toBe(OfferState.Paused);
      expect(toOfferState({ deleted: {} })).toBe(OfferState.Deleted);
    });

    it("should convert SDK enum to Anchor format", () => {
      expect(fromOfferState(OfferState.Active)).toEqual({ active: {} });
      expect(fromOfferState(OfferState.Paused)).toEqual({ paused: {} });
      expect(fromOfferState(OfferState.Deleted)).toEqual({ deleted: {} });
    });
  });

  describe("TradeState", () => {
    it("should convert all Anchor trade states", () => {
      expect(toTradeState({ requestCreated: {} })).toBe(TradeState.RequestCreated);
      expect(toTradeState({ requestAccepted: {} })).toBe(TradeState.RequestAccepted);
      expect(toTradeState({ escrowFunded: {} })).toBe(TradeState.EscrowFunded);
      expect(toTradeState({ fiatDeposited: {} })).toBe(TradeState.FiatDeposited);
      expect(toTradeState({ escrowReleased: {} })).toBe(TradeState.EscrowReleased);
      expect(toTradeState({ requestCanceled: {} })).toBe(TradeState.RequestCanceled);
      expect(toTradeState({ requestExpired: {} })).toBe(TradeState.RequestExpired);
      expect(toTradeState({ escrowRefunded: {} })).toBe(TradeState.EscrowRefunded);
      expect(toTradeState({ disputed: {} })).toBe(TradeState.Disputed);
      expect(toTradeState({ disputeResolved: {} })).toBe(TradeState.DisputeResolved);
    });
  });
});

describe("Trade State Helpers", () => {
  describe("isTerminalTradeState", () => {
    it("should identify terminal states", () => {
      expect(isTerminalTradeState(TradeState.EscrowReleased)).toBe(true);
      expect(isTerminalTradeState(TradeState.RequestCanceled)).toBe(true);
      expect(isTerminalTradeState(TradeState.RequestExpired)).toBe(true);
      expect(isTerminalTradeState(TradeState.EscrowRefunded)).toBe(true);
    });

    it("should identify non-terminal states", () => {
      expect(isTerminalTradeState(TradeState.RequestCreated)).toBe(false);
      expect(isTerminalTradeState(TradeState.RequestAccepted)).toBe(false);
      expect(isTerminalTradeState(TradeState.EscrowFunded)).toBe(false);
      expect(isTerminalTradeState(TradeState.FiatDeposited)).toBe(false);
      expect(isTerminalTradeState(TradeState.Disputed)).toBe(false);
    });
  });

  describe("canCancelTrade", () => {
    it("should return true for cancelable states", () => {
      expect(canCancelTrade(TradeState.RequestCreated)).toBe(true);
      expect(canCancelTrade(TradeState.RequestAccepted)).toBe(true);
    });

    it("should return false for non-cancelable states", () => {
      expect(canCancelTrade(TradeState.EscrowFunded)).toBe(false);
      expect(canCancelTrade(TradeState.FiatDeposited)).toBe(false);
      expect(canCancelTrade(TradeState.EscrowReleased)).toBe(false);
    });
  });

  describe("canFundEscrow", () => {
    it("should return true only for RequestAccepted", () => {
      expect(canFundEscrow(TradeState.RequestAccepted)).toBe(true);
      expect(canFundEscrow(TradeState.RequestCreated)).toBe(false);
      expect(canFundEscrow(TradeState.EscrowFunded)).toBe(false);
    });
  });

  describe("canConfirmFiat", () => {
    it("should return true only for EscrowFunded", () => {
      expect(canConfirmFiat(TradeState.EscrowFunded)).toBe(true);
      expect(canConfirmFiat(TradeState.RequestAccepted)).toBe(false);
      expect(canConfirmFiat(TradeState.FiatDeposited)).toBe(false);
    });
  });

  describe("canReleaseEscrow", () => {
    it("should return true for releasable states", () => {
      expect(canReleaseEscrow(TradeState.FiatDeposited)).toBe(true);
      expect(canReleaseEscrow(TradeState.DisputeResolved)).toBe(true);
    });

    it("should return false for non-releasable states", () => {
      expect(canReleaseEscrow(TradeState.EscrowFunded)).toBe(false);
      expect(canReleaseEscrow(TradeState.Disputed)).toBe(false);
      expect(canReleaseEscrow(TradeState.RequestCreated)).toBe(false);
    });
  });

  describe("canInitiateDispute", () => {
    it("should return true for disputable states", () => {
      expect(canInitiateDispute(TradeState.EscrowFunded)).toBe(true);
      expect(canInitiateDispute(TradeState.FiatDeposited)).toBe(true);
    });

    it("should return false for non-disputable states", () => {
      expect(canInitiateDispute(TradeState.RequestCreated)).toBe(false);
      expect(canInitiateDispute(TradeState.RequestAccepted)).toBe(false);
      expect(canInitiateDispute(TradeState.Disputed)).toBe(false);
      expect(canInitiateDispute(TradeState.EscrowReleased)).toBe(false);
    });
  });
});

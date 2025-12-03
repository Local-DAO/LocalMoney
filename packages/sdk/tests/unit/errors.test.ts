/**
 * Error handling tests
 */

import {
  LocalMoneyError,
  LocalMoneyErrorCode,
  parseAnchorError,
  isLocalMoneyError,
  Errors,
} from "../../src/errors";

describe("LocalMoneyError", () => {
  it("should create error with code and message", () => {
    const error = new LocalMoneyError("Test error", LocalMoneyErrorCode.INVALID_AMOUNT);
    expect(error.message).toBe("Test error");
    expect(error.code).toBe(LocalMoneyErrorCode.INVALID_AMOUNT);
    expect(error.name).toBe("LocalMoneyError");
  });

  it("should include logs when provided", () => {
    const logs = ["log1", "log2"];
    const error = new LocalMoneyError("Test", LocalMoneyErrorCode.UNKNOWN_ERROR, logs);
    expect(error.logs).toEqual(logs);
  });

  it("should include program error code", () => {
    const error = new LocalMoneyError(
      "Test",
      LocalMoneyErrorCode.INVALID_AMOUNT,
      undefined,
      6000
    );
    expect(error.programError).toBe(6000);
  });

  it("should serialize to JSON correctly", () => {
    const error = new LocalMoneyError("Test", LocalMoneyErrorCode.INVALID_AMOUNT, ["log"], 6000);
    const json = error.toJSON();
    expect(json).toEqual({
      name: "LocalMoneyError",
      code: LocalMoneyErrorCode.INVALID_AMOUNT,
      message: "Test",
      programError: 6000,
      logs: ["log"],
    });
  });
});

describe("parseAnchorError", () => {
  it("should parse error with errorCode", () => {
    const anchorError = {
      error: {
        errorCode: { number: 6000 },
      },
    };
    const result = parseAnchorError(anchorError);
    expect(result).toBeInstanceOf(LocalMoneyError);
    expect(result?.code).toBe(LocalMoneyErrorCode.INVALID_AMOUNT);
    expect(result?.programError).toBe(6000);
  });

  it("should parse error from message", () => {
    const error = new Error("custom program error: 0x1770");
    const result = parseAnchorError(error);
    expect(result).toBeInstanceOf(LocalMoneyError);
    expect(result?.programError).toBe(6000);
  });

  it("should return null for non-anchor errors", () => {
    const result = parseAnchorError("just a string");
    expect(result).toBeNull();
  });

  it("should return null for null/undefined", () => {
    expect(parseAnchorError(null)).toBeNull();
    expect(parseAnchorError(undefined)).toBeNull();
  });
});

describe("isLocalMoneyError", () => {
  it("should identify LocalMoneyError", () => {
    const error = new LocalMoneyError("Test", LocalMoneyErrorCode.INVALID_AMOUNT);
    expect(isLocalMoneyError(error)).toBe(true);
  });

  it("should identify LocalMoneyError with specific code", () => {
    const error = new LocalMoneyError("Test", LocalMoneyErrorCode.INVALID_AMOUNT);
    expect(isLocalMoneyError(error, LocalMoneyErrorCode.INVALID_AMOUNT)).toBe(true);
    expect(isLocalMoneyError(error, LocalMoneyErrorCode.UNAUTHORIZED)).toBe(false);
  });

  it("should return false for non-LocalMoneyError", () => {
    expect(isLocalMoneyError(new Error("test"))).toBe(false);
    expect(isLocalMoneyError("string")).toBe(false);
    expect(isLocalMoneyError(null)).toBe(false);
  });
});

describe("Error Factories", () => {
  it("should create walletNotConnected error", () => {
    const error = Errors.walletNotConnected();
    expect(error.code).toBe(LocalMoneyErrorCode.WALLET_NOT_CONNECTED);
  });

  it("should create accountNotFound error", () => {
    const error = Errors.accountNotFound("Profile");
    expect(error.message).toContain("Profile");
    expect(error.code).toBe(LocalMoneyErrorCode.ACCOUNT_NOT_FOUND);
  });

  it("should create invalidParameter error", () => {
    const error = Errors.invalidParameter("amount", "must be positive");
    expect(error.message).toContain("amount");
    expect(error.message).toContain("must be positive");
    expect(error.code).toBe(LocalMoneyErrorCode.INVALID_PARAMETER);
  });

  it("should create simulationFailed error", () => {
    const error = Errors.simulationFailed("out of compute", ["log1"]);
    expect(error.message).toContain("out of compute");
    expect(error.logs).toEqual(["log1"]);
    expect(error.code).toBe(LocalMoneyErrorCode.SIMULATION_FAILED);
  });
});

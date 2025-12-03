import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Trade } from "../target/types/trade";
import { TestUser } from "./utils";

describe("Trade Program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Trade as Program<Trade>;

  it("Creates trade request", async () => {
    // TODO: Implement test after Trade program is implemented
  });

  it("Completes successful trade flow", async () => {
    // TODO: Implement test after Trade program is implemented
  });

  it("Handles trade cancellation", async () => {
    // TODO: Implement test after Trade program is implemented
  });
});

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Offer } from "../target/types/offer";
import { TestUser } from "./utils";

describe("Offer Program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Offer as Program<Offer>;

  it("Creates new offer", async () => {
    // TODO: Implement test after Offer program is implemented
  });

  it("Updates offer parameters", async () => {
    // TODO: Implement test after Offer program is implemented
  });

  it("Pauses and resumes offer", async () => {
    // TODO: Implement test after Offer program is implemented
  });
});

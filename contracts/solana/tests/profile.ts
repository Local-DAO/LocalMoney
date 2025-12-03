import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Profile } from "../target/types/profile";
import { TestUser } from "./utils";

describe("Profile Program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Profile as Program<Profile>;

  it("Creates user profile", async () => {
    // TODO: Implement test after Profile program is implemented
  });

  it("Updates contact information", async () => {
    // TODO: Implement test after Profile program is implemented
  });

  it("Tracks trading statistics", async () => {
    // TODO: Implement test after Profile program is implemented
  });
});

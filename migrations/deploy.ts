// migrations/deploy.ts
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { EscrowContract } from "../target/types/escrow_contract";

module.exports = async function (provider: anchor.AnchorProvider) {
  // Configure client to use the provider.
  anchor.setProvider(provider);

  // Add your deploy script here.
  const program = anchor.workspace.EscrowContract as Program<EscrowContract>;
  console.log("Deploying EscrowContract program with ID:", program.programId.toBase58());

  // You can add more deployment logic here if needed, e.g., initializing global state.
};
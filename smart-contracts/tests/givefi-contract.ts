import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { GivefiContract } from "../target/types/givefi_contract";
import { Keypair, SystemProgram, PublicKey } from "@solana/web3.js";

describe("givefi-contract", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.givefiContract as Program<GivefiContract>;

  // Generate a new treasury wallet for the test
  const treasuryWallet = Keypair.generate();

  // Derive the PDA for program state
  const [programStatePda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("program_state")],
    program.programId
  );

  it("Initializes the program", async () => {
    const tx = await program.methods
      .initializeProgram(treasuryWallet.publicKey)
      .accounts({
        programState: programStatePda,
        authority: anchor.AnchorProvider.env().wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([])
      .rpc();

    console.log("Your transaction signature", tx);
  });
});
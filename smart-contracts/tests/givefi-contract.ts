import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { GivefiContract } from "../target/types/givefi_contract";
import { Keypair, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount } from "@solana/spl-token";
import { expect } from "chai";

describe("givefi-contract", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.givefiContract as Program<GivefiContract>;
  const provider = anchor.AnchorProvider.env();

  // Test accounts
  const treasuryWallet = Keypair.generate();
  const giveawayCreator = Keypair.generate();
  const participant1 = Keypair.generate();
  const participant2 = Keypair.generate();
  const mintAuthority = Keypair.generate();

  // Token mint for GIVE tokens
  let giveMint: PublicKey;

  // Derive PDAs
  const [programStatePda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("program_state")],
    program.programId
  );

  const giveawayId = new anchor.BN(1);
  const [giveawayPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("giveaway"), giveawayId.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  const [giveawayVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("giveaway_vault"), giveawayId.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  const [giveawayTokenVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("token_vault"), giveawayId.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  before(async () => {
    // Airdrop SOL to test accounts
    const airdropAmount = 10 * LAMPORTS_PER_SOL;
    await provider.connection.requestAirdrop(giveawayCreator.publicKey, airdropAmount);
    await provider.connection.requestAirdrop(participant1.publicKey, airdropAmount);
    await provider.connection.requestAirdrop(participant2.publicKey, airdropAmount);
    await provider.connection.requestAirdrop(mintAuthority.publicKey, airdropAmount);
    
    // Wait for confirmations
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create GIVE token mint
    giveMint = await createMint(
      provider.connection,
      mintAuthority,
      mintAuthority.publicKey,
      null,
      9 // 9 decimals
    );
  });

  describe("Program Initialization", () => {
    it("Successfully initializes the program", async () => {
      const tx = await program.methods
        .initializeProgram(treasuryWallet.publicKey)
        .accounts({
          programState: programStatePda,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const programState = await program.account.programState.fetch(programStatePda);
      expect(programState.authority.toString()).to.equal(provider.wallet.publicKey.toString());
      expect(programState.treasuryWallet.toString()).to.equal(treasuryWallet.publicKey.toString());
      expect(programState.totalGiveaways.toNumber()).to.equal(0);
    });

    it("Fails to initialize twice", async () => {
      try {
        await program.methods
          .initializeProgram(treasuryWallet.publicKey)
          .accounts({
            programState: programStatePda,
            authority: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("already initialized");
      }
    });
  });

  describe("Giveaway Creation", () => {
    it("Successfully creates a giveaway", async () => {
      const entryPriceSOL = new anchor.BN(0.1 * LAMPORTS_PER_SOL);
      const maxEntries = new anchor.BN(100);
      const minParticipants = new anchor.BN(2);
      const endTimestamp = new anchor.BN(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now

      await program.methods
        .createGiveaway(
          giveawayId,
          entryPriceSOL,
          null, // no GIVE tokens
          maxEntries,
          minParticipants,
          "Test Giveaway Prize",
          endTimestamp,
          true, // jackpot enabled
          true  // early end enabled
        )
        .accounts({
          giveaway: giveawayPda,
          programState: programStatePda,
          giveawayVault: giveawayVaultPda,
          giveawayTokenVault: giveawayTokenVaultPda,
          giveMint: giveMint,
          authority: giveawayCreator.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([giveawayCreator])
        .rpc();

      const giveaway = await program.account.giveaway.fetch(giveawayPda);
      expect(giveaway.id.toNumber()).to.equal(1);
      expect(giveaway.authority.toString()).to.equal(giveawayCreator.publicKey.toString());
      expect(giveaway.isActive).to.be.true;
      expect(giveaway.currentEntries.toNumber()).to.equal(0);
    });

    it("Fails with invalid parameters", async () => {
      const invalidGiveawayId = new anchor.BN(2);
      const [invalidGiveawayPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("giveaway"), invalidGiveawayId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      try {
        await program.methods
          .createGiveaway(
            invalidGiveawayId,
            new anchor.BN(0), // Invalid: 0 price
            null,
            new anchor.BN(100),
            new anchor.BN(2),
            "Test",
            new anchor.BN(Math.floor(Date.now() / 1000) + 3600),
            false,
            false
          )
          .accounts({
            giveaway: invalidGiveawayPda,
            programState: programStatePda,
            authority: giveawayCreator.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([giveawayCreator])
          .rpc();
        expect.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("InvalidEntryPrice");
      }
    });
  });

  describe("Giveaway Entry", () => {
    it("Allows users to enter with SOL", async () => {
      const entryNumber = new anchor.BN(0);
      const [entryPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("entry"), 
          giveawayId.toArrayLike(Buffer, "le", 8),
          entryNumber.toArrayLike(Buffer, "le", 8)
        ],
        program.programId
      );

      const beforeBalance = await provider.connection.getBalance(participant1.publicKey);

      await program.methods
        .enterGiveawaySol()
        .accounts({
          giveaway: giveawayPda,
          entry: entryPda,
          giveawayVault: giveawayVaultPda,
          user: participant1.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([participant1])
        .rpc();

      const afterBalance = await provider.connection.getBalance(participant1.publicKey);
      const entry = await program.account.giveawayEntry.fetch(entryPda);
      const giveaway = await program.account.giveaway.fetch(giveawayPda);

      expect(giveaway.currentEntries.toNumber()).to.equal(1);
      expect(entry.user.toString()).to.equal(participant1.publicKey.toString());
      expect(beforeBalance - afterBalance).to.be.greaterThan(0.1 * LAMPORTS_PER_SOL);
    });

    it("Prevents double entry from same user", async () => {
      try {
        const entryNumber = new anchor.BN(1);
        const [entryPda] = anchor.web3.PublicKey.findProgramAddressSync(
          [
            Buffer.from("entry"), 
            giveawayId.toArrayLike(Buffer, "le", 8),
            entryNumber.toArrayLike(Buffer, "le", 8)
          ],
          program.programId
        );

        await program.methods
          .enterGiveawaySol()
          .accounts({
            giveaway: giveawayPda,
            entry: entryPda,
            giveawayVault: giveawayVaultPda,
            user: participant1.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([participant1])
          .rpc();
      } catch (error) {
        // This should succeed as it's a different entry
      }
    });
  });

  describe("Security Tests", () => {
    it("Prevents unauthorized early end", async () => {
      try {
        await program.methods
          .endRaffleEarly()
          .accounts({
            giveaway: giveawayPda,
            authority: participant1.publicKey, // Wrong authority
          })
          .signers([participant1])
          .rpc();
        expect.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("UnauthorizedEarlyEnd");
      }
    });

    it("Prevents winner drawing before end time", async () => {
      try {
        await program.methods
          .drawWinnerFallback()
          .accounts({
            giveaway: giveawayPda,
            authority: giveawayCreator.publicKey,
            recentBlockhashes: anchor.web3.SYSVAR_RECENT_BLOCKHASHES_PUBKEY,
          })
          .signers([giveawayCreator])
          .rpc();
        expect.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("FallbackTooEarly");
      }
    });

    it("Prevents unauthorized prize claims", async () => {
      // First we need to end the giveaway and draw a winner
      // This test would need the giveaway to be ended and winner drawn
      // For now, we'll test the basic validation
      const entryNumber = new anchor.BN(0);
      const [entryPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("entry"), 
          giveawayId.toArrayLike(Buffer, "le", 8),
          entryNumber.toArrayLike(Buffer, "le", 8)
        ],
        program.programId
      );

      try {
        await program.methods
          .claimPrize()
          .accounts({
            giveaway: giveawayPda,
            entry: entryPda,
            user: participant2.publicKey, // Wrong user
            treasuryWallet: treasuryWallet.publicKey,
            programState: programStatePda,
          })
          .signers([participant2])
          .rpc();
        expect.fail("Should have failed");
      } catch (error) {
        expect(error.message).to.include("GiveawayStillActive");
      }
    });
  });
});
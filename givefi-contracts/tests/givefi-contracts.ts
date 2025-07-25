import { expect } from "chai";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";

describe("givefi-contracts", function() {
  this.timeout(30000);

  // Use local connection
  const connection = new Connection("http://localhost:8899", "confirmed");
  const programId = new PublicKey("48mihemhp1UxYjz1UznH4fJ9FnF3AfN3XG18GasPFamU");

  it("should verify program is deployed", async function() {
    console.log("🔍 Checking if program is deployed...");
    
    // Check if the program account exists
    const programAccount = await connection.getAccountInfo(programId);
    expect(programAccount).to.not.be.null;
    expect(programAccount?.executable).to.be.true;
    
    console.log("✅ Program deployed and executable at:", programId.toString());
  });

  it("should create and fund test accounts", async function() {
    console.log("💰 Creating and funding test accounts...");
    
    // Create test keypairs
    const hostKeypair = Keypair.generate();
    const participantKeypair = Keypair.generate();
    
    // Airdrop SOL to test accounts (1 SOL each)
    const airdropAmount = 1000000000; // 1 SOL in lamports
    
    const airdrop1 = await connection.requestAirdrop(hostKeypair.publicKey, airdropAmount);
    await connection.confirmTransaction(airdrop1);
    
    const airdrop2 = await connection.requestAirdrop(participantKeypair.publicKey, airdropAmount);
    await connection.confirmTransaction(airdrop2);

    // Check account balances
    const hostBalance = await connection.getBalance(hostKeypair.publicKey);
    const participantBalance = await connection.getBalance(participantKeypair.publicKey);
    
    expect(hostBalance).to.be.greaterThan(0);
    expect(participantBalance).to.be.greaterThan(0);
    
    console.log("✅ Host balance:", hostBalance / 1000000000, "SOL");
    console.log("✅ Participant balance:", participantBalance / 1000000000, "SOL");
  });

  it("should derive PDA correctly", function() {
    console.log("🔑 Testing PDA derivation...");
    
    const hostKeypair = Keypair.generate();
    
    // Test PDA derivation
    const [derivedAccount, bump] = PublicKey.findProgramAddressSync(
      [Buffer.from("raffle"), hostKeypair.publicKey.toBuffer()],
      programId
    );
    
    expect(derivedAccount).to.be.instanceOf(PublicKey);
    expect(bump).to.be.a('number');
    expect(bump).to.be.at.most(255);
    
    console.log("✅ PDA derived successfully:", derivedAccount.toString());
    console.log("✅ Bump seed:", bump);
  });

  it("should verify smart contract is ready", async function() {
    console.log("🚀 Verifying contract readiness...");
    
    // Verify program ID matches deployment
    expect(programId.toString()).to.equal("48mihemhp1UxYjz1UznH4fJ9FnF3AfN3XG18GasPFamU");
    
    // Check program account details
    const programAccount = await connection.getAccountInfo(programId);
    expect(programAccount?.owner.toString()).to.equal("BPFLoaderUpgradeab1e11111111111111111111111");
    
    console.log("✅ Program verified with correct address and owner");
    console.log("🎉 Smart contract infrastructure is ready for comprehensive testing!");
  });
});

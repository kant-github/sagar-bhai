import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { EscrowContract } from "../target/types/escrow_contract";
import { assert } from "chai";

describe("escrow_contract", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.EscrowContract as Program<EscrowContract>;

  let depositor = anchor.web3.Keypair.generate();
  let beneficiary = anchor.web3.Keypair.generate();
  let escrowAccount: anchor.web3.PublicKey;
  let escrowBump: number;

  const depositAmount = new anchor.BN(1 * anchor.web3.LAMPORTS_PER_SOL); // 1 SOL

  before(async () => {
    // Airdrop SOL to depositor
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        depositor.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL // 2 SOL for depositor
      ),
      "confirmed"
    );

    // Derive PDA for escrow account
    [escrowAccount, escrowBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        depositor.publicKey.toBuffer(),
        beneficiary.publicKey.toBuffer(),
      ],
      program.programId
    );
  });

  it("Initializes the escrow!", async () => {
    const unlockTimestamp = new anchor.BN(
      Math.floor(Date.now() / 1000) + 5 // 5 seconds from now
    );

    await program.methods
      .initialize(unlockTimestamp, escrowBump)
      .accounts({
        depositor: depositor.publicKey,
        beneficiary: beneficiary.publicKey,
        escrowAccount: escrowAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([depositor])
      .rpc();

    const escrowState = await program.account.escrowAccount.fetch(escrowAccount);

    assert.equal(escrowState.depositor.toBase58(), depositor.publicKey.toBase58());
    assert.equal(escrowState.beneficiary.toBase58(), beneficiary.publicKey.toBase58());
    assert.equal(escrowState.amount.toNumber(), 0);
    assert.equal(escrowState.unlockTimestamp.toNumber(), unlockTimestamp.toNumber());
    assert.deepEqual(escrowState.state, { initialized: {} });
    assert.equal(escrowState.bump, escrowBump);
  });

  it("Fails to initialize with unlock time in the past", async () => {
    const pastUnlockTimestamp = new anchor.BN(
      Math.floor(Date.now() / 1000) - 10 // 10 seconds ago
    );

    const newDepositor = anchor.web3.Keypair.generate();
    const newBeneficiary = anchor.web3.Keypair.generate();
    const [newEscrowAccount, newEscrowBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        newDepositor.publicKey.toBuffer(),
        newBeneficiary.publicKey.toBuffer(),
      ],
      program.programId
    );

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        newDepositor.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      ),
      "confirmed"
    );

    try {
      await program.methods
        .initialize(pastUnlockTimestamp, newEscrowBump)
        .accounts({
          depositor: newDepositor.publicKey,
          beneficiary: newBeneficiary.publicKey,
          escrowAccount: newEscrowAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([newDepositor])
        .rpc();
      assert.fail("Should have failed to initialize with past unlock time.");
    } catch (err) {
      assert.include(err.message, "InvalidAmount", "Error message should indicate invalid unlock time");
    }
  });

  it("Deposits funds into the escrow!", async () => {
    const depositorBalanceBefore = await provider.connection.getBalance(depositor.publicKey);
    const escrowBalanceBefore = await provider.connection.getBalance(escrowAccount);

    await program.methods
      .deposit(depositAmount)
      .accounts({
        depositor: depositor.publicKey,
        escrowAccount: escrowAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([depositor])
      .rpc();

    const escrowState = await program.account.escrowAccount.fetch(escrowAccount);
    const depositorBalanceAfter = await provider.connection.getBalance(depositor.publicKey);
    const escrowBalanceAfter = await provider.connection.getBalance(escrowAccount);

    assert.equal(escrowState.amount.toNumber(), depositAmount.toNumber());
    assert.deepEqual(escrowState.state, { deposited: {} });
    assert.equal(escrowBalanceAfter, escrowBalanceBefore + depositAmount.toNumber());
    // Check depositor balance decreased by depositAmount + transaction fees
    assert.isBelow(depositorBalanceAfter, depositorBalanceBefore - depositAmount.toNumber());
  });

  it("Fails to deposit again into an already deposited escrow", async () => {
    try {
      await program.methods
        .deposit(depositAmount)
        .accounts({
          depositor: depositor.publicKey,
          escrowAccount: escrowAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([depositor])
        .rpc();
      assert.fail("Should have failed to deposit into an already deposited escrow.");
    } catch (err) {
      assert.include(err.message, "EscrowAlreadyDeposited", "Error message should indicate already deposited");
    }
  });

  it("Fails to deposit with zero amount", async () => {
    const newDepositor = anchor.web3.Keypair.generate();
    const newBeneficiary = anchor.web3.Keypair.generate();
    const [newEscrowAccount, newEscrowBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        newDepositor.publicKey.toBuffer(),
        newBeneficiary.publicKey.toBuffer(),
      ],
      program.programId
    );

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        newDepositor.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      ),
      "confirmed"
    );

    const unlockTimestamp = new anchor.BN(Math.floor(Date.now() / 1000) + 10);
    await program.methods
      .initialize(unlockTimestamp, newEscrowBump)
      .accounts({
        depositor: newDepositor.publicKey,
        beneficiary: newBeneficiary.publicKey,
        escrowAccount: newEscrowAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([newDepositor])
      .rpc();

    try {
      await program.methods
        .deposit(new anchor.BN(0))
        .accounts({
          depositor: newDepositor.publicKey,
          escrowAccount: newEscrowAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([newDepositor])
        .rpc();
      assert.fail("Should have failed to deposit zero amount.");
    } catch (err) {
      assert.include(err.message, "InvalidAmount", "Error message should indicate invalid amount");
    }
  });

  it("Fails to withdraw before unlock time", async () => {
    try {
      await program.methods
        .withdraw()
        .accounts({
          beneficiary: beneficiary.publicKey,
          escrowAccount: escrowAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([beneficiary])
        .rpc();
      assert.fail("Should have failed to withdraw before unlock time.");
    } catch (err) {
      assert.include(err.message, "UnlockTimeNotReached", "Error message should indicate unlock time not reached");
    }
  });

  it("Fails to cancel after unlock time (if it were possible)", async () => {
    // This test will pass because the unlock time is still in the future for the current escrow.
    // We need to wait for the unlock time to pass for the next test.
    // For this test, we'll create a new escrow with a very short unlock time, deposit,
    // wait for it to pass, then try to cancel.

    const shortUnlockDepositor = anchor.web3.Keypair.generate();
    const shortUnlockBeneficiary = anchor.web3.Keypair.generate();
    const [shortUnlockEscrowAccount, shortUnlockEscrowBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        shortUnlockDepositor.publicKey.toBuffer(),
        shortUnlockBeneficiary.publicKey.toBuffer(),
      ],
      program.programId
    );

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        shortUnlockDepositor.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      ),
      "confirmed"
    );

    const shortUnlockTimestamp = new anchor.BN(Math.floor(Date.now() / 1000) + 1); // 1 second from now
    await program.methods
      .initialize(shortUnlockTimestamp, shortUnlockEscrowBump)
      .accounts({
        depositor: shortUnlockDepositor.publicKey,
        beneficiary: shortUnlockBeneficiary.publicKey,
        escrowAccount: shortUnlockEscrowAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([shortUnlockDepositor])
      .rpc();

    await program.methods
      .deposit(depositAmount)
      .accounts({
        depositor: shortUnlockDepositor.publicKey,
        escrowAccount: shortUnlockEscrowAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([shortUnlockDepositor])
      .rpc();

    // Wait for unlock time to pass
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

    try {
      await program.methods
        .cancel()
        .accounts({
          depositor: shortUnlockDepositor.publicKey,
          escrowAccount: shortUnlockEscrowAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([shortUnlockDepositor])
        .rpc();
      assert.fail("Should have failed to cancel after unlock time.");
    } catch (err) {
      assert.include(err.message, "UnlockTimeAlreadyReached", "Error message should indicate unlock time already reached");
    }
  });

  it("Withdraws funds after unlock time", async () => {
    // Wait for the initial escrow's unlock time to pass
    const escrowStateBeforeWithdraw = await program.account.escrowAccount.fetch(escrowAccount);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeToWait = escrowStateBeforeWithdraw.unlockTimestamp.toNumber() - currentTime + 1; // Add 1 second buffer
    if (timeToWait > 0) {
      console.log(`Waiting for ${timeToWait} seconds for unlock time to pass...`);
      await new Promise((resolve) => setTimeout(resolve, timeToWait * 1000));
    }

    const beneficiaryBalanceBefore = await provider.connection.getBalance(beneficiary.publicKey);
    const escrowBalanceBefore = await provider.connection.getBalance(escrowAccount);

    await program.methods
      .withdraw()
      .accounts({
        beneficiary: beneficiary.publicKey,
        escrowAccount: escrowAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([beneficiary])
      .rpc();

    const beneficiaryBalanceAfter = await provider.connection.getBalance(beneficiary.publicKey);
    const escrowBalanceAfter = await provider.connection.getBalance(escrowAccount); // Should be 0 as account is closed

    // Check beneficiary balance increased by depositAmount + rent refund
    assert.isAtLeast(beneficiaryBalanceAfter, beneficiaryBalanceBefore + depositAmount.toNumber());
    assert.equal(escrowBalanceAfter, 0); // Account should be closed

    // Verify account is closed
    const accountInfo = await provider.connection.getAccountInfo(escrowAccount);
    assert.isNull(accountInfo);
  });

  it("Fails to withdraw from a closed escrow", async () => {
    try {
      await program.methods
        .withdraw()
        .accounts({
          beneficiary: beneficiary.publicKey,
          escrowAccount: escrowAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([beneficiary])
        .rpc();
      assert.fail("Should have failed to withdraw from a closed escrow.");
    } catch (err) {
      assert.include(err.message, "AccountNotInitialized", "Error message should indicate account is closed/not initialized");
    }
  });

  it("Cancels escrow before unlock time", async () => {
    const cancelDepositor = anchor.web3.Keypair.generate();
    const cancelBeneficiary = anchor.web3.Keypair.generate();
    const [cancelEscrowAccount, cancelEscrowBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        cancelDepositor.publicKey.toBuffer(),
        cancelBeneficiary.publicKey.toBuffer(),
      ],
      program.programId
    );

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        cancelDepositor.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      ),
      "confirmed"
    );

    const unlockTimestamp = new anchor.BN(
      Math.floor(Date.now() / 1000) + 10 // 10 seconds from now
    );

    await program.methods
      .initialize(unlockTimestamp, cancelEscrowBump)
      .accounts({
        depositor: cancelDepositor.publicKey,
        beneficiary: cancelBeneficiary.publicKey,
        escrowAccount: cancelEscrowAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([cancelDepositor])
      .rpc();

    await program.methods
      .deposit(depositAmount)
      .accounts({
        depositor: cancelDepositor.publicKey,
        escrowAccount: cancelEscrowAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([cancelDepositor])
      .rpc();

    const depositorBalanceBefore = await provider.connection.getBalance(cancelDepositor.publicKey);
    const escrowBalanceBefore = await provider.connection.getBalance(cancelEscrowAccount);

    await program.methods
      .cancel()
      .accounts({
        depositor: cancelDepositor.publicKey,
        escrowAccount: cancelEscrowAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([cancelDepositor])
      .rpc();

    const depositorBalanceAfter = await provider.connection.getBalance(cancelDepositor.publicKey);
    const escrowBalanceAfter = await provider.connection.getBalance(cancelEscrowAccount); // Should be 0 as account is closed

    // Check depositor balance increased by depositAmount + rent refund
    assert.isAtLeast(depositorBalanceAfter, depositorBalanceBefore + depositAmount.toNumber());
    assert.equal(escrowBalanceAfter, 0); // Account should be closed

    // Verify account is closed
    const accountInfo = await provider.connection.getAccountInfo(cancelEscrowAccount);
    assert.isNull(accountInfo);
  });

  it("Fails to cancel from a closed escrow", async () => {
    const cancelDepositor = anchor.web3.Keypair.generate();
    const cancelBeneficiary = anchor.web3.Keypair.generate();
    const [cancelEscrowAccount, cancelEscrowBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        cancelDepositor.publicKey.toBuffer(),
        cancelBeneficiary.publicKey.toBuffer(),
      ],
      program.programId
    );

    try {
      await program.methods
        .cancel()
        .accounts({
          depositor: cancelDepositor.publicKey,
          escrowAccount: cancelEscrowAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([cancelDepositor])
        .rpc();
      assert.fail("Should have failed to cancel from a closed/non-existent escrow.");
    } catch (err) {
      assert.include(err.message, "AccountNotInitialized", "Error message should indicate account is closed/not initialized");
    }
  });

  it("Fails to withdraw with unauthorized beneficiary", async () => {
    const unauthorizedDepositor = anchor.web3.Keypair.generate();
    const unauthorizedBeneficiary = anchor.web3.Keypair.generate();
    const [unauthorizedEscrowAccount, unauthorizedEscrowBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        unauthorizedDepositor.publicKey.toBuffer(),
        unauthorizedBeneficiary.publicKey.toBuffer(),
      ],
      program.programId
    );

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        unauthorizedDepositor.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      ),
      "confirmed"
    );

    const unlockTimestamp = new anchor.BN(Math.floor(Date.now() / 1000) + 5);
    await program.methods
      .initialize(unlockTimestamp, unauthorizedEscrowBump)
      .accounts({
        depositor: unauthorizedDepositor.publicKey,
        beneficiary: unauthorizedBeneficiary.publicKey,
        escrowAccount: unauthorizedEscrowAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([unauthorizedDepositor])
      .rpc();

    await program.methods
      .deposit(depositAmount)
      .accounts({
        depositor: unauthorizedDepositor.publicKey,
        escrowAccount: unauthorizedEscrowAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([unauthorizedDepositor])
      .rpc();

    // Wait for unlock time
    await new Promise((resolve) => setTimeout(resolve, 6000));

    const wrongBeneficiary = anchor.web3.Keypair.generate(); // Not the actual beneficiary
    try {
      await program.methods
        .withdraw()
        .accounts({
          beneficiary: wrongBeneficiary.publicKey,
          escrowAccount: unauthorizedEscrowAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([wrongBeneficiary])
        .rpc();
      assert.fail("Should have failed to withdraw with unauthorized beneficiary.");
    } catch (err) {
      assert.include(err.message, "Unauthorized", "Error message should indicate unauthorized action");
    }
  });

  it("Fails to cancel with unauthorized depositor", async () => {
    const unauthorizedDepositor = anchor.web3.Keypair.generate();
    const unauthorizedBeneficiary = anchor.web3.Keypair.generate();
    const [unauthorizedEscrowAccount, unauthorizedEscrowBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        unauthorizedDepositor.publicKey.toBuffer(),
        unauthorizedBeneficiary.publicKey.toBuffer(),
      ],
      program.programId
    );

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        unauthorizedDepositor.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      ),
      "confirmed"
    );

    const unlockTimestamp = new anchor.BN(Math.floor(Date.now() / 1000) + 10);
    await program.methods
      .initialize(unlockTimestamp, unauthorizedEscrowBump)
      .accounts({
        depositor: unauthorizedDepositor.publicKey,
        beneficiary: unauthorizedBeneficiary.publicKey,
        escrowAccount: unauthorizedEscrowAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([unauthorizedDepositor])
      .rpc();

    await program.methods
      .deposit(depositAmount)
      .accounts({
        depositor: unauthorizedDepositor.publicKey,
        escrowAccount: unauthorizedEscrowAccount,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([unauthorizedDepositor])
      .rpc();

    const wrongDepositor = anchor.web3.Keypair.generate(); // Not the actual depositor
    try {
      await program.methods
        .cancel()
        .accounts({
          depositor: wrongDepositor.publicKey,
          escrowAccount: unauthorizedEscrowAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([wrongDepositor])
        .rpc();
      assert.fail("Should have failed to cancel with unauthorized depositor.");
    } catch (err) {
      assert.include(err.message, "Unauthorized", "Error message should indicate unauthorized action");
    }
  });
});
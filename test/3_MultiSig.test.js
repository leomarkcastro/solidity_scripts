const { expect } = require("chai");
const { loadFixture } = require("ethereum-waffle");
const { parseEther } = require("ethers/lib/utils");
const { ethers } = require("hardhat");

let simpleToken, multiSigWallet;
const ST_INITIAL_SUPPLY = 100;
const MS_QUORUM_MAJORITY = 50; // 50% of the total number of owners

describe("Multi Signature Wallet", function () {
  beforeEach(async () => {

    const SimpleToken = await ethers.getContractFactory("Simple_Token");
    const MultiSigWallet = await ethers.getContractFactory("Multi_Sig");

    // We create a simple ERC20 Token for testing
    simpleToken = await SimpleToken.deploy();
    await simpleToken.deployed();

    // We create a Multi Signature Wallet
    // Important: The MultiSig Wallet should contain ether for transactions purposes
    multiSigWallet = await MultiSigWallet.deploy(MS_QUORUM_MAJORITY, {
      value: parseEther("5"),
    });
    await multiSigWallet.deployed();

    // Important: Multisig wallet should also contain tokens
    await simpleToken.mint(multiSigWallet.address, ST_INITIAL_SUPPLY);

  });

  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshopt in every test.
  async function testFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, acct1, acct2] = await ethers.getSigners();

    return { simpleToken, multiSigWallet, owner, acct1, acct2 };
  }

  /*
    Multisig Wallet
    #### - Create an ERC20 Token

    #### - Quorum should always be majority
    #### - only contract owner can add signers
    #### - signers and owner can
        #### - submit transaction for approval
        #### - view pending transactions
        #### - approve and revoke pending transactions
        #### - if quorum is met, contract owner or any of the signers can execute the transaction
    ### - types of transactions
        #### - sending eth
        ### - sending erc20 (create a basic erc20)
  */

  describe("ERC20 Token", async function () {
    it("should be deployable", async function () {
      const { owner } = await loadFixture(testFixture);
      expect(await simpleToken.owner()).to.equal(owner.address);
    });
  });

  describe("Multi Signature Wallet", async function () {
    
    it("should be deployable", async function () {
      const { owner } = await loadFixture(testFixture);
      expect(await multiSigWallet.owner()).to.equal(owner.address);
    });

    it("should set quorum only to be majority", async function () {
      await loadFixture(testFixture);

      expect(await multiSigWallet.quorumMajority()).to.equal(MS_QUORUM_MAJORITY);

      // We can't set quorum to be less than majority
      await expect(multiSigWallet.setQuorumMajority(MS_QUORUM_MAJORITY - 1)).to.be.reverted;

      // We can't set quorum to be greater than 100%
      await expect(multiSigWallet.setQuorumMajority(101)).to.be.reverted;

      // We can set the quorum to be around 50% to 100% including the boundary
      await expect(multiSigWallet.setQuorumMajority(75)).to.be.ok;

    });

    it("should add signers if you are the owner", async function () {
      const { acct1 } = await loadFixture(testFixture);

      // We can't add signers if we are not the owner
      await expect(multiSigWallet.connect(acct1.address).addSigner(acct1.address)).to.be.reverted;

      // We can add signers if we are the owner
      await multiSigWallet.addSigner(acct1.address);
      expect(await multiSigWallet.signerList(acct1.address)).to.equal(true);
      
    });

    describe("Ether Transactions", async function () {
      
      it("should be created by owner and signers", async function () {
        
        const { owner, acct1, acct2 } = await loadFixture(testFixture);

        // We add a signer
        await multiSigWallet.addSigner(acct1.address);

        // We create a transaction as the owner
        await multiSigWallet.connect(owner).createEthTransaction(acct2.address, parseEther("0.1"), "Test");

        // We create a transaction as a signer
        await multiSigWallet.connect(acct1).createEthTransaction(acct2.address, parseEther("0.1"), "Test");

        // The following should fail because they are not the owner or signer
        await expect(multiSigWallet.connect(acct2).createEthTransaction(acct2.address, parseEther("0.1"), "Test")).to.be.reverted;

      
      });

      it("should be viewable by owner and signers", async function () {

        const { owner, acct1, acct2 } = await loadFixture(testFixture);

        // We add a signer
        await multiSigWallet.addSigner(acct1.address);

        // We create a transaction as the owner
        await multiSigWallet.connect(owner).createEthTransaction(acct2.address, parseEther("0.1"), "Test");

        // We view the transaction as the owner
        expect(await multiSigWallet.connect(owner).viewTransactions(0)).to.be.ok;

        // We view the transaction as a signer
        expect(await multiSigWallet.connect(owner).viewTransactions(0)).to.be.ok;
        
        // Viewing transcations out of bounds should fail
        await expect(multiSigWallet.connect(owner).viewTransactions(1)).to.be.reverted;

        // The following should fail because they are not the owner or signer
        await expect(multiSigWallet.connect(acct2).viewTransactions(0)).to.be.reverted;

      });

      it("should be approved and revoked by owner and signers", async function () {
        
        const { owner, acct1, acct2 } = await loadFixture(testFixture);

        // We add a signer
        await multiSigWallet.addSigner(acct1.address);

        // We create a transaction as the owner
        await multiSigWallet.connect(owner).createEthTransaction(acct2.address, parseEther("0.1"), "Test");

        // We approve the transaction as the owner
        await multiSigWallet.connect(owner).approveTransaction(0);
        // ... and we can also revoke it
        await multiSigWallet.connect(owner).revokeVoteTransaction(0);
        // Revoking means we can vote again
        await multiSigWallet.connect(owner).approveTransaction(0);
        // You can only vote once
        await expect(multiSigWallet.connect(owner).approveTransaction(0)).to.be.reverted;

        // The same rules above apply to signers too
        await multiSigWallet.connect(acct1).approveTransaction(0);
        await multiSigWallet.connect(acct1).revokeVoteTransaction(0);
        await multiSigWallet.connect(acct1).approveTransaction(0);
        await expect(multiSigWallet.connect(acct1).approveTransaction(0)).to.be.reverted;

        // The following should fail because they are not the owner or signer
        await expect(multiSigWallet.connect(acct2).approveTransaction(0)).to.be.reverted;
        await expect(multiSigWallet.connect(acct2).revokeVoteTransaction(0)).to.be.reverted;

      });

      it("should be executed by owner and signers if quorum is met", async function () {

        const { owner, acct1, acct2 } = await loadFixture(testFixture);

        // We add a signer
        await multiSigWallet.addSigner(acct1.address);
        await multiSigWallet.addSigner(acct2.address);

        // We create a transaction as the owner
        await multiSigWallet.connect(owner).createEthTransaction(acct2.address, parseEther("0.1"), "Test");

        // This should fail because quorum is not met
        await expect(multiSigWallet.connect(owner).finalizeTransaction(0)).to.be.reverted;

        // We approve the transaction as the owner
        await multiSigWallet.connect(owner).approveTransaction(0); // Qurom should now be 33%
        await multiSigWallet.connect(acct1).approveTransaction(0); // Qurom should now be 66% (quorom majority met)

        // We execute the transaction as the owner
        await expect(
          () => multiSigWallet.connect(owner).finalizeTransaction(0)
        ).to.changeEtherBalance(acct2, parseEther(`0.1`));

      });

    });

    describe("ERC20 Transactions", async function () {
      it("should be created by owner and signers", async function () {
        
        const { owner, acct1, acct2 } = await loadFixture(testFixture);

        // We add a signer
        await multiSigWallet.addSigner(acct1.address);

        // We create a transaction as the owner
        // Same as eth transaction, but we pass the token address
        await multiSigWallet.connect(owner).createE20Transaction(acct2.address, 50, simpleToken.address, "Test");

        // We create a transaction as a signer
        await multiSigWallet.connect(acct1).createE20Transaction(acct2.address, 50, simpleToken.address, "Test");

        // The following should fail because they are not the owner or signer
        await expect(multiSigWallet.connect(acct2).createE20Transaction(acct2.address, 50, simpleToken.address, "Test")).to.be.reverted;

      
      });

      it("should be viewable by owner and signers", async function () {

        const { owner, acct1, acct2 } = await loadFixture(testFixture);

        // We add a signer
        await multiSigWallet.addSigner(acct1.address);

        // We create a transaction as the owner
        await multiSigWallet.connect(owner).createE20Transaction(acct2.address, 50, simpleToken.address, "Test");

        // We view the transaction as the owner
        expect(await multiSigWallet.connect(owner).viewTransactions(0)).to.be.ok;

        // We view the transaction as a signer
        expect(await multiSigWallet.connect(owner).viewTransactions(0)).to.be.ok;
        
        // Viewing transcations out of bounds should fail
        await expect(multiSigWallet.connect(owner).viewTransactions(1)).to.be.reverted;

        // The following should fail because they are not the owner or signer
        await expect(multiSigWallet.connect(acct2).viewTransactions(0)).to.be.reverted;

      });

      it("should be approved and revoked by owner and signers", async function () {
        
        const { owner, acct1, acct2 } = await loadFixture(testFixture);

        // We add a signer
        await multiSigWallet.addSigner(acct1.address);

        // We create a transaction as the owner
        await multiSigWallet.connect(owner).createE20Transaction(acct2.address, 50, simpleToken.address, "Test");

        // We approve the transaction as the owner
        await multiSigWallet.connect(owner).approveTransaction(0);
        // ... and we can also revoke it
        await multiSigWallet.connect(owner).revokeVoteTransaction(0);
        // Revoking means we can vote again
        await multiSigWallet.connect(owner).approveTransaction(0);
        // You can only vote once
        await expect(multiSigWallet.connect(owner).approveTransaction(0)).to.be.reverted;

        // The same rules above apply to signers too
        await multiSigWallet.connect(acct1).approveTransaction(0);
        await multiSigWallet.connect(acct1).revokeVoteTransaction(0);
        await multiSigWallet.connect(acct1).approveTransaction(0);
        await expect(multiSigWallet.connect(acct1).approveTransaction(0)).to.be.reverted;

        // The following should fail because they are not the owner or signer
        await expect(multiSigWallet.connect(acct2).approveTransaction(0)).to.be.reverted;
        await expect(multiSigWallet.connect(acct2).revokeVoteTransaction(0)).to.be.reverted;

      });

      it("should be executed by owner and signers if quorum is met", async function () {

        const { owner, acct1, acct2 } = await loadFixture(testFixture);

        // We add a signer
        await multiSigWallet.addSigner(acct1.address);
        await multiSigWallet.addSigner(acct2.address);

        // We create a transaction as the owner
        await multiSigWallet.connect(owner).createE20Transaction(acct2.address, 50, simpleToken.address, "Test");

        // This should fail because quorum is not met
        await expect(multiSigWallet.connect(owner).finalizeTransaction(0)).to.be.reverted;

        // We approve the transaction as the owner
        await multiSigWallet.connect(owner).approveTransaction(0); // Qurom should now be 33%
        await multiSigWallet.connect(acct1).approveTransaction(0); // Qurom should now be 66% (quorom majority met)

        // Initially the receiver should have no token
        expect(await simpleToken.balanceOf(acct2.address)).to.be.equal(0);

        // We execute the transaction as the owner
        await expect(
          () => multiSigWallet.connect(owner).finalizeTransaction(0)
        ).to.changeTokenBalance(simpleToken, acct2, 50);

        
        // The receiver should now have the token
        expect(await simpleToken.balanceOf(acct2.address)).to.be.equal(50);

      });
    });
  
  });

});

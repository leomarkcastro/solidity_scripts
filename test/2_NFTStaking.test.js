const { expect } = require("chai");
const { loadFixture } = require("ethereum-waffle");
const { parseEther } = require("ethers/lib/utils");
const { ethers } = require("hardhat");

let token, staker;
const LOCKIN_PERDIOD = 30; // in seconds

describe("NFT Token and Staking", function () {
  beforeEach(async () => {
    const [owner, acct1] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("NFT_Token");
    const Staker = await ethers.getContractFactory("NFT_Staker");

    // FIRST: Deploy the NFT Token
    token = await Token.deploy();
    await token.deployed();

    // THEN: Deploy the staker by passing the token address, the lockin period and an initial ether balance
    // Ether Balance was required in order for rewards to properly work
    staker = await Staker.deploy(token.address, LOCKIN_PERDIOD, {
      value: ethers.utils.parseEther("1"),
    });
    await staker.deployed();

    // IMPORTANT: You have to activate the Staker to accept tokens
    await staker.activateStake();
  });

  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshopt in every test.
  async function testFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, acct1, acct2] = await ethers.getSigners();

    return { token, staker, owner, acct1, acct2 };
  }

  /*
    NFT Staking
    #### - Create your own NFT with a max supply of 100

    #### - Set lock in period
    #### - Specify an NFT to be allowed for staking. 1 address only
    #### - Stake method should transfer the NFT from user's wallet to stake contract
    #### - User should onlly be allowed to unstake the NFT after the lock-in period
        | #### - User should earn .001 eth every block while NFT is staked
    ####| #### - ETH rewards accumulation should stop after the user unstaked the NFT
        | #### - User should be able to claim the rewards only after unstaking the NFT

  */

  describe("Token", async function () {
    it("should be deployable", async function () {
      const { owner } = await loadFixture(testFixture);
      expect(await token.owner()).to.equal(owner.address);
    });

    it("should be able to mint (max of 100)", async function () {
      const { owner } = await loadFixture(testFixture);
      await token.mint();
      expect(await token.ownerOf(0)).to.equal(owner.address);

      await Promise.all(
        Array.from({ length: 99 }).map(async () => {
          await token.mint();
        })
      );

      expect(await token.currentSupply()).to.equal(100);

      // Should fail because 100 is the max supply
      await expect(token.mint()).to.be.revertedWith(
        "ERC721: minting limit reached"
      );
    });
  });

  describe("Staker", async function () {
    it("should be deployable", async function () {
      const { owner } = await loadFixture(testFixture);
      expect(await staker.owner()).to.equal(owner.address);
    });

    it("should have a changeable lockin period", async function () {
      await loadFixture(testFixture);

      // The default lockin period
      expect(await staker.lockInPeriod()).to.equal(LOCKIN_PERDIOD);

      // Change the lockin period
      await staker.setLockinPeriod(60);

      // The lockin period should be changed
      expect(await staker.lockInPeriod()).to.equal(60);
    });

    it("should accept a token address for staking", async function () {
      await loadFixture(testFixture);

      // The method is already initialized on the beforeEach of the test
      // where you have to supply an address of the token contract

      // The token address should be the same as the one we supplied
      expect(await staker.targetNFT()).to.equal(token.address);
    });

    it("should be able to stake a token", async function () {
      const { owner } = await loadFixture(testFixture);

      // We first mint a token to our address
      await token.mint();
      expect(await token.ownerOf(0)).to.equal(owner.address);

      // Before staking, we should allow the staker contract in our approved transaction list
      await token.setApprovalForAll(staker.address, true);
      expect(await token.isApprovedForAll(owner.address, staker.address)).to.equal(true);

      // Then, we stake a token
      await staker.stake(0);

      // The token should be staked and the staker should now (temporarily) own it
      expect(await token.ownerOf(0)).to.equal(staker.address);
    });

    it("should only return token after lockin period", async function () {

      const { owner } = await loadFixture(testFixture);

      // We first mint a token to our address
      await token.mint();
      expect(await token.ownerOf(0)).to.equal(owner.address);

      // Before staking, we should allow the staker contract in our approved transaction list
      await token.setApprovalForAll(staker.address, true);
      expect(await token.isApprovedForAll(owner.address, staker.address)).to.equal(true);

      // Then, we stake a token
      await staker.stake(0);

      // The token should be staked and the staker should now (temporarily) own it
      expect(await token.ownerOf(0)).to.equal(staker.address);

      // Pulling out too early will fail
      await expect(staker.unstake(0)).to.be.revertedWith("You're pulling out too early");

      // After the lockin period, the token should be returned to the owner
      await ethers.provider.send("evm_increaseTime", [LOCKIN_PERDIOD + 1]);

      await staker.unstake(0);

      // After unstaking, you should now be the owner of the token again
      expect(await token.ownerOf(0)).to.equal(owner.address);
    });

    it("should be able to giveout proper rewards", async function () {
      
      const { owner } = await loadFixture(testFixture);

      // We first mint a token to our address
      await token.mint();
      expect(await token.ownerOf(0)).to.equal(owner.address);

      // Before staking, we should allow the staker contract in our approved transaction list
      await token.setApprovalForAll(staker.address, true);
      expect(await token.isApprovedForAll(owner.address, staker.address)).to.equal(true);

      // Then, we stake a token
      await staker.stake(0);

      // The token should be staked and the staker should now (temporarily) own it
      expect(await token.ownerOf(0)).to.equal(staker.address);

      // After the lockin period, the token should be returned to the owner
      await ethers.provider.send("evm_increaseTime", [LOCKIN_PERDIOD + 1]);

      // After unstaking, you should now be the owner of the token again 
      //  and earn some reward ( 0.001 eth  * duration of lockin period )
      const currentEthBalance = await ethers.provider.getBalance(owner.address);
      await staker.unstake(0)
      let afterChangeEthBalance = await ethers.provider.getBalance(owner.address);
      parseEther(`${0.001 * (LOCKIN_PERDIOD + 1)}`);
      afterChangeEthBalance = afterChangeEthBalance.sub(currentEthBalance);
      expect(afterChangeEthBalance).to.gte(parseEther(`${0.001 * (LOCKIN_PERDIOD)}`));
    });
  });
});

const { expect } = require("chai");
const { loadFixture } = require("ethereum-waffle");
const { ethers } = require("hardhat");

let contract;

describe("ERC1155", function () {
  beforeEach(async () => {
    const [_, acct1] = await ethers.getSigners();

    const ERC1155_Token = await ethers.getContractFactory("ERC1155_Token");
    contract = await ERC1155_Token.deploy(acct1.address);
    await contract.deployed();
  });

  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshopt in every test.
  async function testFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, acct1, acct2] = await ethers.getSigners();

    return { contract, owner, acct1, acct2 };
  }

  /*
      ERC1155 Token
      ### - Is ERC1155
      ### - Is Ownable
      #### - Each token ID needs to have a max supply of 1
      - Token IDs will be 0, 1, 2, 3 but users can see 1, 2, 3
      #### - Each token should have its own baseURI, meaning I can have two NFTs with different baseURI
      #### - URL for each token should be changeable by contract owner
      #### - Token ID is autogenerated and incremental
      #### - A new token can be minted by contract owner with input parameters: string uri
      #### - Tokens should be minted to fixed address 'treasury'
      #### - 'treasury' should be updatable by owner
  */

  it("should be deployable (and set the right owner)", async function () {
    const { owner } = await loadFixture(testFixture);
    expect(await contract.owner()).to.equal(owner.address);
  });

  describe("Tokens", async function () {
    it("should be able to be minted only by owner and only takes URI", async function () {
      let { acct1 } = await loadFixture(testFixture);

      await contract.mint("http://test.com/1.json");

      // Must fail. Only Owner can mint
      await expect(contract.connect(acct1).mint("http://test.com/1.json")).to.be
        .reverted;

      // Must fail. No URI
      await expect(contract.mint()).to.be
        .reverted;
    });

    it("should track how many tokens were minted", async function () {
      await loadFixture(testFixture);

      expect(await contract.tokenId()).to.equal("0");
      await contract.mint("http://test.com/1.json");
      expect(await contract.tokenId()).to.equal("1");
      await contract.mint("http://test.com/2.json");
      expect(await contract.tokenId()).to.equal("2");
    });

    it("should acccept unique URI for each token", async function () {
      await loadFixture(testFixture);

      const url1 = "http://test.com/1.json";
      const url2 = "http://test.com/2.json";
      await contract.mint(url1);
      await contract.mint(url2);
      expect(await contract.uri("0")).to.equal(url1);
      expect(await contract.uri(1)).to.equal(url2);
    });

    it("URI should be changeable by owner", async function () {
      const { acct1 } = await loadFixture(testFixture);

      const url1 = "http://test.com/1.json";
      const url2 = "http://test.com/2.json";
      await contract.mint(url1);
      await contract.mint(url2);
      expect(await contract.uri("0")).to.equal(url1);
      expect(await contract.uri(1)).to.equal(url2);

      const url1Change = "http://test.com/3.json";
      await contract.setURI(0, url1Change);
      expect(await contract.uri(0)).to.equal(url1Change);

      await expect(contract.connect(acct1).setURI(0, "http://test.com/1.json"))
        .to.be.reverted;
    });

    it("ID should be autogenerated and incremental", async function () {
      await loadFixture(testFixture);

      await contract.mint("test");
      await contract.mint("b");

      expect(contract.uri("0")).to.not.equal("");
      expect(await contract.uri(1)).to.not.equal("");
      expect(await contract.uri(2)).to.equal(""); // Because its not minted yet
    });

    it("should be minted to the treasury address", async function () {
      const { acct1 } = await loadFixture(testFixture);

      const treasuryAddress = await contract.treasury();
      // Acct1 is the declared treasury of this contract when it was created.
      expect(treasuryAddress).to.equal(acct1.address);

      for (let i = 0; i < 5; i++) {
        // Treasury at first dont have the token
        expect(await contract.balanceOf(treasuryAddress, i)).to.equal("0");

        await contract.mint("test");

        // ...and now it does
        expect(await contract.balanceOf(treasuryAddress, i)).to.equal("1");
      }
    });
  });

  describe("Treasury", async function () {
    it("should be updatable by owner", async function () {
      const { acct1, acct2 } = await loadFixture(testFixture);

      let treasuryAddress = await contract.treasury();
      // Acct1 is the declared treasury of this contract when it was created.
      expect(treasuryAddress).to.equal(acct1.address);

      for (let i = 0; i < 5; i++) {
        // Treasury at first dont have the token
        expect(await contract.balanceOf(treasuryAddress, i)).to.equal("0");

        await contract.mint("test");

        // ...and now it does
        expect(await contract.balanceOf(treasuryAddress, i)).to.equal("1");
      }
      
      // We transfered the treasury to acct2 for newly minted tokens
      await contract.updateTreasury(acct2.address);
      treasuryAddress = await contract.treasury();
      expect(treasuryAddress).to.equal(acct2.address);

      // New tokens will be created to the new treasury
      for (let i = 5; i < 10; i++) {
        // Treasury at first dont have the token
        expect(await contract.balanceOf(treasuryAddress, i)).to.equal("0");

        await contract.mint("test");

        // ...and now it does
        expect(await contract.balanceOf(treasuryAddress, i)).to.equal("1");
      }

      // Old tokens will stay in the old treasury
      for (let i = 0; i < 5; i++) {
        expect(await contract.balanceOf(acct1.address, i)).to.equal("1");
      }

      await expect(contract.connect(acct1).updateTreasury(acct2.address)).to.be
        .reverted;
    });
  });
});
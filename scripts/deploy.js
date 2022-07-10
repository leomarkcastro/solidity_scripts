const { parseEther } = require("ethers/lib/utils");

async function deploy_ERC1155_Token(){

  console.log("Deploying ERC1155 Token");
  console.log("------------------------------------------------------");
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const ERC1155_Token = await ethers.getContractFactory("ERC1155_Token");
  const contract = await ERC1155_Token.deploy(deployer.address);
  await contract.deployed();

  console.log("[ERC1155_Token] address:", contract.address);

}

async function deploy_NFT_Staker(){

  console.log("Deploying NFT Staking and Token");
  console.log("------------------------------------------------------");
  
  const LOCKIN_PERDIOD = 30; // in seconds

  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const Token = await ethers.getContractFactory("NFT_Token");
  const Staker = await ethers.getContractFactory("NFT_Staker");

  // FIRST: Deploy the NFT Token
  const token = await Token.deploy();
  await token.deployed();

  // THEN: Deploy the staker by passing the token address, the lockin period and an initial ether balance
  // Ether Balance was required in order for rewards to properly work
  const staker = await Staker.deploy(token.address, LOCKIN_PERDIOD, {
    value: ethers.utils.parseEther("0.00005"),
  });
  await staker.deployed();

  // IMPORTANT: You have to activate the Staker to accept tokens
  await staker.activateStake();

  console.log("[NFT_Token] address:", token.address);
  console.log("[NFT_Staker] address:", staker.address);

}

async function deploy_MultiSig(){

  
  console.log("Deploying MultiSig Wallet");
  console.log("------------------------------------------------------");

  const ST_INITIAL_SUPPLY = 100;
  const MS_QUORUM_MAJORITY = 50; // 50% of the total number of owners

  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());

  const SimpleToken = await ethers.getContractFactory("Simple_Token");
  const MultiSigWallet = await ethers.getContractFactory("Multi_Sig");

  // We create a simple ERC20 Token for testing
  const simpleToken = await SimpleToken.deploy();
  await simpleToken.deployed();

  // We create a Multi Signature Wallet
  // Important: The MultiSig Wallet should contain ether for transactions purposes
  const multiSigWallet = await MultiSigWallet.deploy(MS_QUORUM_MAJORITY, {
    value: parseEther("0.00005"),
  });
  await multiSigWallet.deployed();

  // Important: Multisig wallet should also contain tokens
  await simpleToken.mint(multiSigWallet.address, ST_INITIAL_SUPPLY);

  console.log("[ERC20 Token] address:", simpleToken.address);
  console.log("[MultiSig Wallet] address:", multiSigWallet.address);

}

async function main() {
  console.log("\n");
  console.log("============================================================");
  console.log("Deploying contracts...");
  console.log();
  await deploy_ERC1155_Token();
  console.log();
  await deploy_NFT_Staker();
  console.log();
  await deploy_MultiSig();
  console.log();
  console.log("============================================================");
  console.log("\n");
}

/* 
  NOTE: The Contracts had already been deployed with the following details:

  ERC1155
  --------------------------------------------------
  Deploying contracts with the account: 0x4107F5Cf00BE8A68D34416daEd0F070894b1d91A
  Account balance: 76493242400156322
  [ERC1155_Token] address: 0x849B20F687ef08412D584de0bf42F7736627F5C6

  NFT Staker
  --------------------------------------------------
  Deploying contracts with the account: 0x4107F5Cf00BE8A68D34416daEd0F070894b1d91A
  Account balance: 72148339374086904
  [NFT_Token] address: 0x438844806d150f00CFdE4d25c717fdD7283162AC
  [NFT_Staker] address: 0xeb2C1a570D3dAF34F4CEE1cc0201F62Ffe8D7A98

  MultiSig
  --------------------------------------------------
  Deploying contracts with the account: 0x4107F5Cf00BE8A68D34416daEd0F070894b1d91A
  [ERC20 Token] address: 0xFFF9c967fAd7533B49795562A5B6B7F93989672b
  [MultiSig Wallet] address: 0x12b754a973e57479806bcd3ed5894CEfeF3354Ba
*/

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
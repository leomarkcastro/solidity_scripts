// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

// Used by Token
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Used by Staker
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/*
    NFT Staking
    ### - Create your own NFT with a max supply of 100

    ### - Set lock in period
    ### - Specify an NFT to be allowed for staking. 1 address only
    ### - Stake method should transfer the NFT from user's wallet to stake contract
    ### - User should earn .001 eth every block while NFT is staked
    ### - User should onlly be allowed to unstake the NFT after the lock-in period
    ### - ETH rewards accumulation should stop after the user unstaked the NFT
    ### - User should be able to claim the rewards only after unstaking the NFT

*/

// Simple NFT Token Contract
contract NFT_Token is ERC721, Ownable {
    uint public tokenId = 0;
    uint public currentSupply = 0;
    uint public maxSupply = 100;

    constructor() ERC721("NFT_Token", "NTN") {}
    
    function mint() public {
        uint totalMinted = currentSupply;
        require(totalMinted < maxSupply, "ERC721: minting limit reached");
        _safeMint(msg.sender, totalMinted);
        currentSupply += 1;
    }
}

// NFT Staker
contract NFT_Staker is IERC721Receiver {

    address public owner;
    bool public isStaking = false; // This controls if you can stake, but already staked NFTs are still redeemable
    
    uint public lockInPeriod;

    address public targetNFT;

    uint public rewardPerSecond = 0.001 ether;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only accessible to owner");
        _;
    }

    constructor(address _targetNFT, uint _lockinPeriod) payable {
        require(msg.value > 0 ether, "Stake contract should contain ether for rewards");
        lockInPeriod = _lockinPeriod;
        targetNFT = _targetNFT;
        owner = msg.sender;
    }

    // Admin focused functions

    function activateStake() external onlyOwner {
        isStaking = true;
    }

    function deactivateStake() external onlyOwner {
        isStaking = false;
    }

    function setLockinPeriod(uint _lockinPeriod) public onlyOwner {
        lockInPeriod = _lockinPeriod;
    }

    function rewardBalance() external onlyOwner view returns (uint) {
        return address(this).balance;
    }

    function setReward(uint _reward) external onlyOwner {
        rewardPerSecond = _reward;
    }


    // NFT Holder focused functions

    struct Stake {
        address owner;
        uint256 timestamp;
    }

    // map staker address to stake details
    mapping (uint => Stake) public stakes;
    // map staker address to stake details
    mapping (address => uint) public hasStake;

    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) override external returns (bytes4) {
        require(isStaking, "Contract not accepting additional stakes now");
        operator; data;
        Stake memory newStake = Stake(
            from, block.timestamp
        );
        stakes[tokenId] = newStake;
        hasStake[from] += 1;
        return this.onERC721Received.selector;
    }
    
    function stake(uint256 _tokenId) external payable {
        require(isStaking, "Contract not accepting additional stakes now");
        IERC721(targetNFT).safeTransferFrom(msg.sender, address(this), _tokenId);
    }

    function unstake(uint256 _tokenId) external {
        require(hasStake[msg.sender] > 0, "You currently don't have any staakes yet");
        require(durationOfStake(_tokenId) > lockInPeriod, "You're pulling out too early");

        Stake memory currentStake = stakes[_tokenId];

        IERC721(targetNFT).safeTransferFrom(address(this), currentStake.owner, _tokenId);
        uint duration = durationOfStake(_tokenId);
        uint sentEth = duration * rewardPerSecond;
        payable(msg.sender).transfer(sentEth);

        delete stakes[_tokenId];
        hasStake[msg.sender] -= 1;
        isStaking = true;
    }

    function durationOfStake(uint256 _tokenId) public view returns(uint) {
        return block.timestamp - stakes[_tokenId].timestamp;
    }

}
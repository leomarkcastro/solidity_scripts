// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/*
    ERC1155 Token
    ### - Is ERC1155
    ### - Is Ownable
    ### - Each token ID needs to have a max supply of 1
    - Token IDs will be 0, 1, 2, 3 but users can see 1, 2, 3
    ### - Each token should have its own baseURI, meaning I can have two NFTs with different baseURI
    ### - URL for each token should be changeable by contract owner
    ### - Token ID is autogenerated and incremental
    ### - A new token can be minted by contract owner with input parameters: string uri
    ### - Tokens should be minted to fixed address 'treasury'
    ### - 'treasury' should be updatable by owner
*/

contract ERC1155_Token is ERC1155, Ownable {

    // Used to track how many tokens were minted
    mapping(uint => uint) public tokenSupply;

    // Used to record baseURI for each token
    // baseURI should look like: "https://game.example/api/item/{id}.json"
    mapping(uint => string) public tokenBaseURI;

    uint public tokenId;

    address public treasury; 
    
    // ERC1155 requires a default BaseURI to be used for all token. But since we use different
    // baseURI for each token, we just leave it
    constructor(address _treasury) ERC1155("") {
        treasury = _treasury;
    }

    // sets our URI and makes the ERC1155 OpenSea compatible
    function uri(uint256 _tokenid) override public view returns(string memory) {
        return string(
            abi.encodePacked(
                tokenBaseURI[_tokenid]
            )
        );
    }

    // used to change metadata, only owner access. Provide what token to change and what uri to use now.
    function setURI(uint _tokenId, string memory newuri) external onlyOwner {
        tokenBaseURI[_tokenId] = newuri;
    }

    // Mints a new token to the treasury. Only takes uri
    function mint(string memory _uri) external payable onlyOwner returns (uint) {
        uint _tokenId = tokenId;

        require(tokenSupply[_tokenId] == 0);

        tokenSupply[_tokenId] += 1;

        _mint(treasury, _tokenId, 1, "");
        tokenBaseURI[_tokenId] = _uri;

        tokenId += 1;

        return _tokenId;
    }

    // Update treasury wallet address
    function updateTreasury(address _newTreasury) external onlyOwner {
        treasury = _newTreasury;
    }


}
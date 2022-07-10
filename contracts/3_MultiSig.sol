// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/*
    Multisig Wallet
    #### - Quorum should always be majority
    #### - only contract owner can add signers
    ### - signers and owner can
        #### - submit transaction for approval
        #### - view pending transactions
        ### - approve and revoke pending transactions
        #### - if quorum is met, contract owner or any of the signers can execute the transaction
    ### - types of transactions
        #### - sending eth
        #### - sending erc20 (create a basic erc20)
*/

contract Simple_Token is ERC20, Ownable {
    constructor() ERC20("Simple Token", "SPT") { }

    function mint(address _to, uint256 _amount) public onlyOwner {
        require(_to != address(0));
        require(_amount > 0);
        _mint(_to, _amount);
    }
}

contract Multi_Sig is Ownable {

    enum CoinType{ ETH, E20 }

    uint public quorumMajority;
    mapping(address => bool) public signerList;
    uint public signerCount;

    struct Transaction {
        string reason;
        address recepient;
        uint amount;
        CoinType coinType;
        address eth20Address;
        mapping(address => bool) voters;
        uint approve;
        uint reject;
        bool complete;
    }

    uint transactionCount;
    mapping (uint => Transaction) private transactions;

    modifier onlyAgents() {
        address txSender = msg.sender;
        require(txSender == owner() || signerList[txSender]);
        _;
    }

    constructor(uint _quorumMajority) payable {
        setQuorumMajority(_quorumMajority);
    }

    function setQuorumMajority(uint _quorumMajority) public onlyOwner {
        require(_quorumMajority >= 50, "Given value too low (50 - 100)");
        require(_quorumMajority <= 100, "Given value too high (100 - 100)");
        quorumMajority = _quorumMajority;
    }

    function addSigner(address _newSigner) external onlyOwner {
        signerList[_newSigner] = true;
        signerCount += 1;
    }

    function createEthTransaction(address _recipient, uint _amount, string memory _reason) external onlyAgents {
        Transaction storage newRequest = transactions[transactionCount];
        transactionCount += 1;
        newRequest.reason = _reason;
        newRequest.recepient = _recipient;
        newRequest.amount = _amount;
        newRequest.coinType = CoinType.ETH;
    }

    function createE20Transaction(address _recipient, uint _amount, address _eth20Address, string memory _reason) external onlyAgents {
        Transaction storage newRequest = transactions[transactionCount];
        transactionCount += 1;
        newRequest.reason = _reason;
        newRequest.recepient = _recipient;
        newRequest.amount = _amount;
        newRequest.coinType = CoinType.E20;
        newRequest.eth20Address = _eth20Address;
    }

    function getTransactionCount() external onlyAgents view returns (uint) {
        return signerCount;
    }

    function viewTransactions(uint _transactionId) external onlyAgents view returns 
    (
        string memory,
        address,
        uint,
        CoinType,
        uint,
        uint,
        bool
    ) {
        require(_transactionId < transactionCount, "Transaction id is out of range");
        Transaction storage txTarget = transactions[_transactionId];
        return (
            txTarget.reason, 
            txTarget.recepient, 
            txTarget.amount, 
            txTarget.coinType, 
            txTarget.approve, 
            txTarget.reject, 
            txTarget.complete
        );
    }

    function approveTransaction(uint _transactionId) external onlyAgents {
        Transaction storage txTarget = transactions[_transactionId];
        require(txTarget.voters[msg.sender] == false, "You already voted");
        txTarget.voters[msg.sender] = true;
        txTarget.approve += 1;
    }

    function revokeVoteTransaction(uint _transactionId) external onlyAgents {
        Transaction storage txTarget = transactions[_transactionId];
        require(txTarget.voters[msg.sender] == true, "You haven't voted yet");
        txTarget.voters[msg.sender] = false;
        txTarget.approve -= 1;
    }

    function finalizeTransaction(uint _transactionId) external onlyAgents {
        Transaction storage txTarget = transactions[_transactionId];
        require(txTarget.complete == false, "Transaction already finished");
        require(txTarget.approve / signerCount * 100 > quorumMajority, "Quorum Majority not met yet for transaction");
        txTarget.complete = true;
        
        if (txTarget.coinType == CoinType.E20) {
            IERC20(txTarget.eth20Address).transfer(txTarget.recepient, txTarget.amount);
        } else {
            payable(txTarget.recepient).transfer(txTarget.amount);
        }
        
    }

    
}
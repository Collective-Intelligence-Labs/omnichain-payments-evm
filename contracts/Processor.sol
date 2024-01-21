// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "./OwnableERC20Token.sol";

contract Processor {
    OwnableERC20Token public processedToken;
    IERC20 public usdtToken;
    ERC20Permit public permitToken;

    mapping(uint => function (AssetTransfer memory, Operataion memory) internal returns(bool)) handlers;

    uint public constant TRANSFER = 1;
    uint public constant DEPOSIT = 2;
    uint public constant WITHDRAW = 3;

    struct AssetTransfer {
        uint256 cmd_type;
        uint256 amount;
        address from;
        address to;
    }

    struct Operataion {
        bytes[] commands;
        bytes[] signatures;
        Metadata metadata;
    }

    struct Metadata {
        uint256 id;
        address payee;
        address router;
        uint256 fee;
        uint256 deadline;
    }

    mapping(uint256 => uint256) private _nonces; 

    event TokensProcessed(address indexed sender, uint256 usdtAmount, uint256 processedTokenAmount, uint256 fee);
    event TokensTransfered(address indexed sender, uint256 usdtAmount, uint256 processedTokenAmount);
    event TokensWithdrawn(address indexed recipient, uint256 processedTokenAmount);
    event TokenDeposited(address indexed sender, address recipent, uint256 processedTokenAmount);

    constructor(address _targetTokenAddress, address _internalTokenAddress) {
        processedToken = OwnableERC20Token(_internalTokenAddress);
        usdtToken = IERC20(_targetTokenAddress);
        permitToken = ERC20Permit(_targetTokenAddress);
        handlers[TRANSFER] = transfer;
        handlers[DEPOSIT] = deposit;
        handlers[WITHDRAW] = withdraw;
    }

    function transfer(AssetTransfer memory data, Operataion memory op) internal returns(bool) {
        if (processedToken.balanceOf(data.from) < data.amount) {
                // Skip iteration if the sender has insufficient balance
                return false;
        }

        processedToken.transferFrom(data.from, data.to, data.amount);
        emit TokensTransfered(msg.sender, data.amount, data.amount);
        return true;
    }

    function deposit(AssetTransfer memory data, Operataion memory op) internal returns(bool) {
        (uint8 v, bytes32 r, bytes32 s) = splitSignatureWithSlicing(op.signatures[0]);
        permitToken.permit(data.from, address(this), data.amount, op.metadata.deadline, v, r, s);
                if (!usdtToken.transferFrom(data.from, address(this), data.amount))
                {
                    return false;
                }
                processedToken.mint(data.to, data.amount);
                emit TokenDeposited(msg.sender, data.to, data.amount);
        return true;
    }

    function withdraw(AssetTransfer memory data, Operataion memory op) internal returns(bool) {
         if (processedToken.balanceOf(data.from) > data.amount)
                {
                    processedToken.burn(msg.sender, data.amount);
                    usdtToken.transfer(msg.sender, data.amount);
                    emit TokensWithdrawn(msg.sender, data.amount);
                }
        return true;
    }

    function processCmds(bytes[] calldata ops) external returns (uint256[] memory){
        uint256[] memory ids = new uint256[](ops.length);
        for (uint256 i = 0; i < ops.length; i++) {
            Operataion memory op = abi.decode(ops[i], (Operataion));
            if (processOperation(op))
            {
                ids[i] = op.metadata.id;
            }
        }
        return ids;
    }

    function processOperation(Operataion memory op) internal returns (bool) {
        address[] memory signers = extractSigners(op);
        if (_nonces[op.metadata.id] != 0) {
            return false;
        }
        if (op.metadata.deadline < block.timestamp)
        {
            return false;
        }
        for (uint256 i = 0; i < op.commands.length; i++) {
            processCommand(op.commands[i], op.metadata, signers, op);
        }
        _nonces[op.metadata.id] = block.timestamp;
        if (signers[0] != op.metadata.payee)
        {
            return false;
        }
        processedToken.transferFrom(op.metadata.payee, op.metadata.router, op.metadata.fee);
        return true;
    }

    function processCommand(bytes memory cmdBytes, Metadata memory metadata, address[] memory signers, Operataion memory op) internal returns (bool)
    {   
         AssetTransfer memory cmd = abi.decode(cmdBytes, (AssetTransfer));
         function (AssetTransfer memory, Operataion memory) internal returns(bool)  handler = handlers[cmd.cmd_type];
         return handler(cmd, op);
    }

    function calculateHash(bytes memory data) internal pure returns (bytes32) {
        return keccak256(data);
    }

    function calculateOperaionHash(Operataion memory op) internal pure returns (bytes32) {
        return keccak256(abi.encode(op.commands, op.metadata));
    }

    function extractSigners(Operataion memory op) internal pure returns (address[] memory) {
        bytes32 dataHash = calculateOperaionHash(op);
        address[] memory recovered = new address[](op.signatures.length);
        for (uint i = 0; i < op.signatures.length; i++) {
            (uint8 v, bytes32 r, bytes32 s) = splitSignatureWithSlicing(op.signatures[i]);
            address recoveredAddress = ecrecover(dataHash, v, r, s);
            recovered[i] = recoveredAddress;
        }
        return recovered;
    }

    function splitSignatureWithSlicing(bytes memory signature) public pure returns (uint8 v, bytes32 r, bytes32 s){
            (r, s) = abi.decode(signature, (bytes32, bytes32));
            v = uint8(signature[64]);
    }
    
    function validateSignature(address from, uint8 v, bytes32 r, bytes32 s, bytes32 dataHash) internal pure returns (bool) {
        address recoveredAddress = ecrecover(dataHash, v, r, s);
        return recoveredAddress == from;
    }
}

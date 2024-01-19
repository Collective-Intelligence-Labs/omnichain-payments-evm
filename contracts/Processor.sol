// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "./OwnableERC20Token.sol";

contract Processor {
    OwnableERC20Token public processedToken;
    IERC20 public usdtToken;
    ERC20Permit public permitToken;

    uint public constant TRANSFER = 1;
    uint public constant DEPOSIT = 2;
    uint public constant WITHDRAW = 3;

    struct TransferData {
        bytes32 s;
        bytes32 r;
        uint8 v;
        AssetTransfer data;
    }

    struct AssetTransfer {
        uint256 cmd_id;
        uint256 cmd_type;
        uint256 amount;
        address from;
        address to;
        uint256 fee;
        uint256 deadline;
    }

    mapping(uint256 => uint256) private _nonces; 

    event TokensProcessed(address indexed sender, uint256 usdtAmount, uint256 processedTokenAmount, uint256 fee);
    event TokensTransfered(address indexed sender, uint256 usdtAmount, uint256 processedTokenAmount, uint256 fee);
    event TokensWithdrawn(address indexed recipient, uint256 processedTokenAmount);
    event TokenDeposited(address indexed sender, address recipent, uint256 processedTokenAmount);

    constructor(address _targetTokenAddress, address _internalTokenAddress) {
        processedToken = OwnableERC20Token(_internalTokenAddress);
        usdtToken = IERC20(_targetTokenAddress);
        permitToken = ERC20Permit(_targetTokenAddress);
    }

    function processCmds(TransferData[] memory jsonList) external {
        for (uint256 i = 0; i < jsonList.length; i++) {
            TransferData memory transferData = jsonList[i];
            if (transferData.data.amount == 0) {
                // Skip iteration if the transfer amount is zero
                continue;
            }

            if (_nonces[transferData.data.cmd_id] == 0)
            {
                continue;
            }

            if (transferData.data.deadline < block.timestamp)
            {
                continue;
            }

            // Ensure that the sender has enough balance to perform the transfer
            if (processedToken.balanceOf(transferData.data.from) < transferData.data.amount) {
                // Skip iteration if the sender has insufficient balance
                continue;
            }

            // Validate the signature
            if ((transferData.data.cmd_type != DEPOSIT) && !validateSignature(transferData.data.from, transferData.v, transferData.r, transferData.s, keccak256(abi.encodePacked(transferData.data.cmd_id, transferData.data.cmd_type, transferData.data.amount, transferData.data.from, transferData.data.to, transferData.data.fee, transferData.data.deadline))))
            {   // Skip iteration if the signature is invalid
                continue;
            }

            if (transferData.data.cmd_type == TRANSFER)
            {
                // Perform the transfer
                processedToken.transferFrom(transferData.data.from, transferData.data.to, transferData.data.amount);
                emit TokensTransfered(msg.sender, transferData.data.amount, transferData.data.amount,transferData.data.fee);
            }

            if (transferData.data.cmd_type == DEPOSIT)
            {
                permitToken.permit(transferData.data.from, address(this), transferData.data.amount, transferData.data.deadline, transferData.v, transferData.r, transferData.s);
                if (!usdtToken.transferFrom(transferData.data.from, address(this), transferData.data.amount))
                {
                    continue;
                }
                processedToken.mint(transferData.data.to, transferData.data.amount);
                emit TokenDeposited(msg.sender, transferData.data.to, transferData.data.amount);
            }

            if (transferData.data.cmd_type == WITHDRAW)
            {
                if (processedToken.balanceOf(transferData.data.from) > transferData.data.amount)
                {
                    processedToken.burn(msg.sender, transferData.data.amount);
                    usdtToken.transfer(msg.sender, transferData.data.amount);
                    emit TokensWithdrawn(msg.sender, transferData.data.amount);
                }
            }

            // Perform the transfer fee
            processedToken.transferFrom(transferData.data.from, msg.sender, transferData.data.fee);

            _nonces[transferData.data.cmd_id] = block.timestamp;

            emit TokensProcessed(msg.sender, transferData.data.amount, transferData.data.amount,transferData.data.fee);
        }
    }
    
    function validateSignature(address from,   uint8 v,  bytes32 r, bytes32 s, bytes32 dataHash) internal pure returns (bool) {
        address recoveredAddress = ecrecover(dataHash, v, r, s);
        return recoveredAddress == from;
    }
}

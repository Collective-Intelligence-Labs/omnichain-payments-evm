// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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
        bytes data;
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

    function processCmds(bytes[] calldata jsonList) external {
        for (uint256 i = 0; i < jsonList.length; i++) {
            TransferData memory transferData = abi.decode(jsonList[i], (TransferData));
            AssetTransfer memory data = abi.decode(transferData.data, (AssetTransfer));
            if (data.amount == 0) {
                // Skip iteration if the transfer amount is zero
                continue;
            }

            if (_nonces[data.cmd_id] == 0)
            {
                continue;
            }

            if (data.deadline < block.timestamp)
            {
                continue;
            }

            // Ensure that the sender has enough balance to perform the transfer
            if (processedToken.balanceOf(data.from) < data.amount) {
                // Skip iteration if the sender has insufficient balance
                continue;
            }

            // Validate the signature
            if ((data.cmd_type != DEPOSIT) && !validateSignature(data.from, transferData.v, transferData.r, transferData.s, keccak256(abi.encodePacked(data.cmd_id, data.cmd_type, data.amount, data.from, data.to, data.fee, data.deadline))))
            {   // Skip iteration if the signature is invalid
                continue;
            }

            if (data.cmd_type == TRANSFER)
            {
                // Perform the transfer
                processedToken.transferFrom(data.from, data.to, data.amount);
                emit TokensTransfered(msg.sender, data.amount, data.amount, data.fee);
            }

            if (data.cmd_type == DEPOSIT)
            {
                permitToken.permit(data.from, address(this), data.amount, data.deadline, transferData.v, transferData.r, transferData.s);
                if (!usdtToken.transferFrom(data.from, address(this), data.amount))
                {
                    continue;
                }
                processedToken.mint(data.to, data.amount);
                emit TokenDeposited(msg.sender, data.to, data.amount);
            }

            if (data.cmd_type == WITHDRAW)
            {
                if (processedToken.balanceOf(data.from) > data.amount)
                {
                    processedToken.burn(msg.sender, data.amount);
                    usdtToken.transfer(msg.sender, data.amount);
                    emit TokensWithdrawn(msg.sender, data.amount);
                }
            }

            // Perform the transfer fee
            processedToken.transferFrom(data.from, msg.sender, data.fee);

            _nonces[data.cmd_id] = block.timestamp;

            emit TokensProcessed(msg.sender, data.amount, data.amount, data.fee);
        }
    }

    function calculateDigest() internal pure returns (bytes32) {
    }
    
    function validateSignature(address from, uint8 v, bytes32 r, bytes32 s, bytes32 dataHash) internal pure returns (bool) {
        address recoveredAddress = ecrecover(dataHash, v, r, s);
        return recoveredAddress == from;
    }
}

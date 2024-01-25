// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "./OwnableERC20Token.sol";

contract Processor {
    OwnableERC20Token public processedToken;
    IERC20 public targetToken;
    ERC20Permit public permitToken;

    struct TransferData {
        uint256 deadline;
        uint256 op_id;
        address portal; //the one who pays transaction fee to the router
        AssetTransfer[] commands;
        uint256[] cmd_types;
        bytes[] signatures;
    }

    struct AssetTransfer {
        uint256 amount;
        address from;
        address to;
    }

    mapping(uint256 => uint256) private _nonces;

    // Events
    event OperationProcessed(uint256 op_id);
    event CommandProcessed(address from, address to, uint256 amount);

    constructor(address _targetTokenAddress, address _internalTokenAddress) {
        processedToken = OwnableERC20Token(_internalTokenAddress);
        targetToken = IERC20(_targetTokenAddress);
        permitToken = ERC20Permit(_targetTokenAddress);
    }

    function processOperation(TransferData calldata op) internal {
        require(_nonces[op.op_id] == 0, "Nonce already used");
        require(op.deadline >= block.timestamp);

            for (uint256 j = 0; j < op.commands.length; j++) {
                if (!processCommand(op.commands[j])) {
                    break;
                }
            }
            _nonces[op.op_id] = block.timestamp;
            emit OperationProcessed(op.op_id);
    }

    function processCommand(AssetTransfer calldata cmd) internal returns (bool) {    
        require(cmd.amount != 0, "Empty transfer.");
        require(processedToken.balanceOf(cmd.from) >= cmd.amount, "Not enough funds.");
        /*
        uint256 allowance = targetToken.allowance(cmd.from, address(this));
        if (allowance > 0) {
            targetToken.transferFrom(cmd.from, address(this), allowance);
            processedToken.mint(cmd.from, allowance);
        }

        */

        processedToken.transferFrom(cmd.from, cmd.to, cmd.amount);
        emit CommandProcessed(cmd.from, cmd.to, cmd.amount);
        return true;
    }

    function process(TransferData[] calldata ops) external {
        for (uint256 i = 0; i < ops.length; i++) {
            processOperation(ops[i]);
        }
    }
}

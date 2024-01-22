// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "./OwnableERC20Token.sol";

contract Processor {
    OwnableERC20Token public processedToken;
    IERC20 public targetToken;
    ERC20Permit public permitToken;

    struct TransferData {
        bytes32 s;
        bytes32 r;
        uint8 v;
        uint256 fee;
        uint256 deadline;
        uint256 op_id;
        bytes32 datahash;
        address payee;
        address router;
        AssetTransfer[] commands;
    }

    struct AssetTransfer {
        uint256 cmd_type;
        uint256 amount;
        address from;
        address to;
    }

    mapping(uint256 nonce => uint256) private _nonces; 

    constructor(address _targetTokenAddress, address _internalTokenAddress) {
        processedToken = OwnableERC20Token(_internalTokenAddress);
        targetToken = IERC20(_targetTokenAddress);
        permitToken = ERC20Permit(_targetTokenAddress);
    }

  

    function processOperation(TransferData calldata op) internal {
        if (_nonces[op.op_id] != 0)
            {
                return;
            }
            if (op.deadline < block.timestamp)
            {
                return;
            }

            for (uint256 j = 0; j < op.commands.length; j++) {
                if (!processCommand(op.commands[j]))
                {
                    break;
                }
            }

              // Perform the transfer fee
            processedToken.transferFrom(op.payee, op.router, op.fee);

            _nonces[op.op_id] = block.timestamp;
    }

    function processCommand(AssetTransfer calldata cmd) internal returns (bool){    
                if (cmd.amount == 0) {
                    // Skip iteration if the transfer amount is zero
                    return false;
                }

                // Ensure that the sender has enough balance to perform the transfer
                if (processedToken.balanceOf(cmd.from) < cmd.amount) {
                    // Skip iteration if the sender has insufficient balance
                    return false;
                }

                uint256 allowance = targetToken.allowance(cmd.from, address(this));
                if (allowance > 0)
                {
                    targetToken.transferFrom(cmd.from, address(this), allowance);
                    processedToken.mint(cmd.from, allowance);
                }
                // Perform the transfer
                processedToken.transferFrom(cmd.from, cmd.to, cmd.amount);
                return true;
    }

      function process(TransferData[] calldata ops) external {
        for (uint256 i = 0; i < ops.length; i++) {

            processOperation(ops[i]);
        }
    }
    
    function validateSignature(address from,   uint8 v,  bytes32 r, bytes32 s, bytes32 dataHash) internal pure returns (bool) {
        address recoveredAddress = ecrecover(dataHash, v, r, s);
        return recoveredAddress == from;
    }
}

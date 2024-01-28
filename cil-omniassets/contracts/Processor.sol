// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "./OwnableERC20Token.sol";

contract Processor {
    IERC20 public targetToken;
    ERC20Permit public permitToken;

    struct Operation {
        uint256 deadline;
        uint256 op_id;
        AssetTransfer[] commands;
        bytes signature;
    }

    struct AssetTransfer {
        uint256 amount;
        address from;
        address to;
    }

    mapping(uint256 => uint256) private _nonces;

    event OperationProcessed(uint256 op_id);
    event CommandProcessed(address from, address to, uint256 amount);
    event HandlingValidationError(uint256 op_id, string message);

    constructor(address _targetTokenAddress) {
        targetToken = IERC20(_targetTokenAddress);
        permitToken = ERC20Permit(_targetTokenAddress);   
    }

    function processOperation(Operation calldata op) internal returns (bool) {
        require(_nonces[op.op_id] == 0, "Nonce already used");
        require(op.deadline >= block.timestamp, "Deadline passed");
        
        (uint8 v, bytes32 r, bytes32 s) = splitSignature(op.signature);
        bytes32 opHash = calculateOperationHash(op.commands, op.op_id);
        uint256 totalPermit = 0;
        address sender = op.commands[0].from;

        for (uint256 j = 0; j < op.commands.length; j++) {
            require(sender == op.commands[j].from, "Different senders in commands");
            totalPermit += op.commands[j].amount;
        }

        require(targetToken.balanceOf(sender) >= totalPermit, "Insufficient balance");
        
        permitToken.permit(sender, address(this), totalPermit, uint256(opHash), v, r, s);

        for (uint256 j = 0; j < op.commands.length; j++) {
            targetToken.transferFrom(op.commands[j].from, op.commands[j].to, op.commands[j].amount);
            emit CommandProcessed(op.commands[j].from, op.commands[j].to, op.commands[j].amount);
        }
        
        _nonces[op.op_id] = block.timestamp;
        emit OperationProcessed(op.op_id);
        return true;
    }

    function process(Operation[] calldata ops) external {
        for (uint256 i = 0; i < ops.length; i++) {
            processOperation(ops[i]);
        }
    }

    function splitSignature(bytes memory sig) internal pure returns (uint8, bytes32, bytes32) {
        require(sig.length == 65, "Invalid signature");
        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }

        return (v, r, s);
    }

    function calculateOperationHash(AssetTransfer[] memory commands, uint256 opId) public pure returns (bytes32) {
        return keccak256(abi.encode(opId, commands));
    }
}
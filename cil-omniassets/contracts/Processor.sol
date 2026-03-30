// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract Processor {
    IERC20 public immutable targetToken;
    ERC20Permit public immutable permitToken;

    struct Operation {
        uint256 deadline;
        uint256 op_id;
        address from;
        AssetTransfer[] commands;
        bytes signature;
    }

    struct AssetTransfer {
        address to;
        uint256 amount;
    }

    mapping(uint256 => bool) private _usedNonces;

    event OperationProcessed(uint256 op_id);
    event CommandProcessed(address from, address to, uint256 amount);
    event HandlingValidationError(uint256 op_id, string message);

    constructor(address _targetTokenAddress) {
        targetToken = IERC20(_targetTokenAddress);
        permitToken = ERC20Permit(_targetTokenAddress);   
    }

    function processOperation(Operation calldata op) internal returns (bool) {
        require(!_usedNonces[op.op_id], "Nonce already used");
        require(op.deadline >= block.timestamp, "Deadline passed");
        
        (uint8 v, bytes32 r, bytes32 s) = splitSignature(op.signature);
        bytes32 opHash = calculateOperationHash(op.commands, op.op_id);
        uint256 totalPermit = 0;

        uint256 len = op.commands.length;
        for (uint256 j; j < len; ) {
            totalPermit += op.commands[j].amount;
            unchecked { ++j; }
        }

        require(targetToken.balanceOf(op.from) >= totalPermit, "Insufficient balance");
        
        permitToken.permit(op.from, address(this), totalPermit, uint256(opHash), v, r, s);

        for (uint256 j; j < len; ) {
            address to = op.commands[j].to;
            uint256 amount = op.commands[j].amount;
            targetToken.transferFrom(op.from, to, amount);
            emit CommandProcessed(op.from, to, amount);
            unchecked { ++j; }
        }
        
        _usedNonces[op.op_id] = true;
        emit OperationProcessed(op.op_id);
        return true;
    }

    function process(Operation[] calldata ops) external {
        uint256 len = ops.length;
        for (uint256 i; i < len; ) {
            processOperation(ops[i]);
            unchecked { ++i; }
        }
    }

    function splitSignature(bytes calldata sig) internal pure returns (uint8, bytes32, bytes32) {
        require(sig.length == 65, "Invalid signature");
        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }

        return (v, r, s);
    }

    function calculateOperationHash(AssetTransfer[] memory commands, uint256 opId) public pure returns (bytes32) {
        return keccak256(abi.encode(opId, commands));
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "./OwnableERC20Token.sol";

contract Processor {
    OwnableERC20Token public processedToken;
    IERC20 public targetToken;
    ERC20Permit public permitToken;

    struct Operation {
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

    function processOperation(Operation calldata op) internal {
        require(_nonces[op.op_id] == 0, "Nonce already used");
        require(op.deadline >= block.timestamp, "Deadline passed");
        
        address[] memory signers = verifySignatures(op.deadline, op.op_id, op.portal, op.commands, op.cmd_types, op.signatures);
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

    function process(Operation[] calldata ops) external {
        for (uint256 i = 0; i < ops.length; i++) {
            processOperation(ops[i]);
        }
    }

    /// private signature extraction methods

    function verifySignatures(
        uint256 deadline,
        uint256 op_id,
        address portal,
        AssetTransfer[] memory commands,
        uint256[] memory cmd_types,
        bytes[] memory signatures
    ) public view returns (address[] memory) {
        bytes32 dataHash = keccak256(abi.encodePacked(deadline, op_id, portal, abi.encode(commands), cmd_types));
        bytes32 message = prefixed(dataHash);

        address[] memory signers = new address[](signatures.length);

        for (uint i = 0; i < signatures.length; i++) {
            signers[i] = recoverSigner(message, signatures[i]);
        }

        return signers;
    }

    function prefixed(bytes32 hash) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

    function recoverSigner(bytes32 message, bytes memory sig) internal pure returns (address) {
        (uint8 v, bytes32 r, bytes32 s) = splitSignature(sig);
        return ecrecover(message, v, r, s);
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

}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "./OwnableERC20Token.sol";

contract Processor {
    OwnableERC20Token public processedToken;
    IERC20 public targetToken;
    ERC20Permit public permitToken;

    uint public constant TRANSFER = 1;
    uint public constant DEPOSIT = 2;
    uint public constant WITHDRAW = 3;

     // EIP-712 Domain Separator
    bytes32 DOMAIN_SEPARATOR;

    // EIP-712 type hashes
    bytes32 constant ASSET_TRANSFER_TYPEHASH = keccak256("AssetTransfer(uint256 amount,address from,address to)");
    bytes32 constant OPERATION_TYPEHASH = keccak256(
        "Operation(uint256 deadline,uint256 op_id,address portal,AssetTransfer[] commands,uint256[] cmd_types)AssetTransfer(uint256 amount,address from,address to)"
    );

    mapping(uint => function (AssetTransfer memory, Operation memory) internal returns(bool)) handlers;
    mapping(uint => bool) isHandlerSet;

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
    event OperationProcessed(uint256 op_id, address[] signers);
    event CommandProcessed(address from, address to, uint256 amount);

    constructor(address _targetTokenAddress, address _internalTokenAddress) {
        processedToken = OwnableERC20Token(_internalTokenAddress);
        targetToken = IERC20(_targetTokenAddress);
        permitToken = ERC20Permit(_targetTokenAddress);

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("Processor Contract")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
        
    }

    function processOperation(Operation calldata op) internal {
        require(_nonces[op.op_id] == 0, "Nonce already used");
        require(op.deadline >= block.timestamp, "Deadline passed");
        
        address[] memory signers = verifySignatures(op);
            for (uint256 j = 0; j < op.commands.length; j++) {
                if (!processCommand(op.cmd_types[j], op.commands[j], signers, op)) {
                    break;
                }
            }
            _nonces[op.op_id] = block.timestamp;
            emit OperationProcessed(op.op_id, signers);
    }

    function processCommand(uint256 cmdType, AssetTransfer calldata cmd, address[] memory signers, Operation calldata op) internal returns (bool) {    
        require(cmd.amount != 0, "Empty transfer.");
        require(processedToken.balanceOf(cmd.from) >= cmd.amount, "Not enough funds.");


    /*
        // Check if cmd.from is in the signers array
        bool isAuthorized = false;
        for (uint i = 0; i < signers.length; i++) {
            if (cmd.from == signers[i]) {
                // Optional: Add additional verification here to match the signature with the signer
                isAuthorized = true;
                break;
            }
        }
        require(isAuthorized, "Sender not authorized");
        

    */


       if (cmdType == 1){ //TRANSFER
            processedToken.transferFrom(cmd.from, cmd.to, cmd.amount);
       }
       if (cmdType == 2){ //DEPOSIT

            (uint8 v, bytes32 r, bytes32 s) = splitSignature(op.signatures[0]);
            permitToken.permit(cmd.from, address(this), cmd.amount, op.deadline, v,r,s);
            targetToken.transferFrom(cmd.from, address(this), cmd.amount);
            processedToken.mint(cmd.to, cmd.amount);
       }
        emit CommandProcessed(cmd.from, cmd.to, cmd.amount);
        return true;
    }

    function process(Operation[] calldata ops) external {
        for (uint256 i = 0; i < ops.length; i++) {
            processOperation(ops[i]);
        }
    }

    /// private signature extraction methods

    function verifySignatures(Operation calldata op) internal view returns (address[] memory) {
        bytes32[] memory commandHashes = new bytes32[](op.commands.length);
        for (uint i = 0; i < op.commands.length; i++) {
            commandHashes[i] = keccak256(
                abi.encode(
                    ASSET_TRANSFER_TYPEHASH,
                    op.commands[i].amount,
                    op.commands[i].from,
                    op.commands[i].to
                )
            );
        }

        bytes32 structHash = keccak256(
            abi.encode(
                OPERATION_TYPEHASH,
                op.deadline,
                op.op_id,
                op.portal,
                keccak256(abi.encode(op.commands)), // Encode commands array
                keccak256(abi.encodePacked(op.cmd_types)) // Encode cmd_types array
            )
        );

        bytes32 hash = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash)
        );

        address[] memory signers = new address[](op.signatures.length);
        for (uint i = 0; i < op.signatures.length; i++) {
            (uint8 v, bytes32 r, bytes32 s) = splitSignature(op.signatures[i]);
            signers[i] = ecrecover(hash, v, r, s);
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

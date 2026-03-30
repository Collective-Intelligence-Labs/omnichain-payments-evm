// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract OperationProcessor {
    // Function to process an operation and return results
    function processOp(bytes calldata op) internal pure returns (uint16 networkState, uint64 networkCluster, bytes32 instructionScheme) {
        // Ensure the `op` bytes array is long enough to contain all required data.
        require(op.length >= 42, "op data too short");

        // Parse the first 2 bytes for the networkState
        networkState = toUint16(op, 0);

        // Parse the next 8 bytes for the networkCluster
        networkCluster = toUint64(op, 2);

        // Parse the next 32 bytes for the instructionScheme
        instructionScheme = toBytes32(op, 10);

        //then we need to deserialized the rest into specific sequance of commands and validate their signature

        //extract from the instructions the number of commands stored further - or maybe we should have a 
    }

    // Converts a bytes array to uint16 starting from a given offset
    function toUint16(bytes memory _bytes, uint _start) private pure returns (uint16) {
        require(_bytes.length >= _start + 2, "toUint16_outOfBounds");
        uint16 tempUint;

        assembly {
            tempUint := mload(add(add(_bytes, 0x2), _start))
        }

        return tempUint;
    }

    // Converts a bytes array to uint64 starting from a given offset
    function toUint64(bytes memory _bytes, uint _start) private pure returns (uint64) {
        require(_bytes.length >= _start + 8, "toUint64_outOfBounds");
        uint64 tempUint;

        assembly {
            tempUint := mload(add(add(_bytes, 0x8), _start))
        }

        return tempUint;
    }

    // Converts a bytes array to bytes32 starting from a given offset
    function toBytes32(bytes memory _bytes, uint _start) private pure returns (bytes32 result) {
        require(_bytes.length >= _start + 32, "toBytes32_outOfBounds");

        assembly {
            result := mload(add(_bytes, add(_start, 0x20)))
        }
    }
}
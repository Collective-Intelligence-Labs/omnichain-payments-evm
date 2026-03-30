package com.omnichain.payments.util

import org.web3j.abi.TypeEncoder
import org.web3j.abi.TypeReference
import org.web3j.abi.datatypes.Address
import org.web3j.abi.datatypes.StaticArray
import org.web3j.abi.datatypes.generated.Uint256
import org.web3j.abi.datatypes.tuplegenerated.Tuple2
import org.web3j.crypto.Hash
import org.web3j.utils.Numeric
import com.omnichain.payments.model.AssetTransfer
import java.math.BigInteger
import java.security.SecureRandom

fun calculateOperationHash(commands: List<AssetTransfer>, opId: BigInteger): ByteArray {
    val tuples = commands.map { cmd ->
        Tuple2<Address, Uint256>(
            Address(cmd.to),
            Uint256(cmd.amount)
        )
    }
    val tupleArray = StaticArray(
        Tuple2::class.java,
        tuples.toTypedArray()
    )
    val encoded = TypeEncoder.encode(tupleArray)
    val opIdEncoded = TypeEncoder.encode(Uint256(opId))
    val concatenated = opIdEncoded + encoded
    return Hash.sha3(concatended.toByteArray())
}

fun generateOpIdAndHash(commands: List<AssetTransfer>, deadlineMin: Long): Pair<BigInteger, BigInteger> {
    val random = SecureRandom()
    var opHash = BigInteger.ZERO
    var opId = BigInteger.ZERO
    var attempts = 0
    while (opHash < BigInteger.valueOf(deadlineMin) && attempts < 100) {
        val bytes = ByteArray(32)
        random.nextBytes(bytes)
        opId = BigInteger(1, bytes)
        opHash = BigInteger(1, calculateOperationHash(commands, opId))
        attempts++
    }
    require(opHash >= BigInteger.valueOf(deadlineMin)) {
        "Failed to generate valid op_id after 100 attempts"
    }
    return Pair(opId, opHash)
}

fun shortenAddress(address: String): String {
    return if (address.length <= 10) address
    else "${address.substring(0, 6)}...${address.substring(address.length - 4)}"
}

fun isValidEthereumAddress(address: String): Boolean {
    return address.matches(Regex("^0x[0-9a-fA-F]{40}$"))
}

fun hexStringToByteArray(hex: String): ByteArray {
    val cleanHex = hex.removePrefix("0x")
    require(cleanHex.length % 2 == 0) { "Hex string must have even length" }
    return cleanHex.chunked(2).map { it.toInt(16).toByte() }.toByteArray()
}

fun byteArrayToHexString(bytes: ByteArray): String {
    return Numeric.toHexString(bytes)
}

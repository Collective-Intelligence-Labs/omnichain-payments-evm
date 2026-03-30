package com.omnichain.payments

import com.omnichain.payments.model.AssetTransfer
import com.omnichain.payments.util.calculateOperationHash
import com.omnichain.payments.util.generateOpIdAndHash
import com.omnichain.payments.util.isValidEthereumAddress
import com.omnichain.payments.util.shortenAddress
import org.junit.Assert.*
import org.junit.Test
import java.math.BigInteger

class ProcessorUtilsTest {

    @Test
    fun `calculateOperationHash returns 32 bytes`() {
        val commands = listOf(
            AssetTransfer(
                to = "0x1234567890123456789012345678901234567890",
                amount = BigInteger("1000000")
            )
        )
        val opId = BigInteger("1234567890123456789012345678901234567890123456789012345678901234")

        val hash = calculateOperationHash(commands, opId)

        assertEquals(32, hash.size)
    }

    @Test
    fun `calculateOperationHash is deterministic`() {
        val commands = listOf(
            AssetTransfer(
                to = "0x1234567890123456789012345678901234567890",
                amount = BigInteger("50000000")
            )
        )
        val opId = BigInteger("9999999999999999999999999999999999999999999999999999999999999999")

        val hash1 = calculateOperationHash(commands, opId)
        val hash2 = calculateOperationHash(commands, opId)

        assertArrayEquals(hash1, hash2)
    }

    @Test
    fun `calculateOperationHash differs for different commands`() {
        val commands1 = listOf(
            AssetTransfer(
                to = "0x1234567890123456789012345678901234567890",
                amount = BigInteger("1000000")
            )
        )
        val commands2 = listOf(
            AssetTransfer(
                to = "0x1234567890123456789012345678901234567890",
                amount = BigInteger("2000000")
            )
        )
        val opId = BigInteger("1234567890123456789012345678901234567890123456789012345678901234")

        val hash1 = calculateOperationHash(commands1, opId)
        val hash2 = calculateOperationHash(commands2, opId)

        assertFalse(hash1.contentEquals(hash2))
    }

    @Test
    fun `calculateOperationHash differs for different opIds`() {
        val commands = listOf(
            AssetTransfer(
                to = "0x1234567890123456789012345678901234567890",
                amount = BigInteger("1000000")
            )
        )

        val hash1 = calculateOperationHash(commands, BigInteger.ONE)
        val hash2 = calculateOperationHash(commands, BigInteger.TWO)

        assertFalse(hash1.contentEquals(hash2))
    }

    @Test
    fun `calculateOperationHash handles multiple commands`() {
        val commands = listOf(
            AssetTransfer(
                to = "0x1234567890123456789012345678901234567890",
                amount = BigInteger("50000000")
            ),
            AssetTransfer(
                to = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
                amount = BigInteger("25000000")
            ),
            AssetTransfer(
                to = "0x0000000000000000000000000000000000000001",
                amount = BigInteger("100000000")
            )
        )
        val opId = BigInteger("9998887776665554443332221110009998887776665554443332221110009998887")

        val hash = calculateOperationHash(commands, opId)

        assertEquals(32, hash.size)
    }

    @Test
    fun `generateOpIdAndHash produces hash greater than deadline`() {
        val commands = listOf(
            AssetTransfer(
                to = "0x1234567890123456789012345678901234567890",
                amount = BigInteger("1000000")
            )
        )
        val deadline = System.currentTimeMillis() / 1000 + 3600

        val (opId, opHash) = generateOpIdAndHash(commands, deadline)

        assertTrue(opHash >= BigInteger.valueOf(deadline))
        assertTrue(opId > BigInteger.ZERO)
    }

    @Test
    fun `generateOpIdAndHash is consistent with calculateOperationHash`() {
        val commands = listOf(
            AssetTransfer(
                to = "0x1234567890123456789012345678901234567890",
                amount = BigInteger("1000000")
            )
        )
        val deadline = System.currentTimeMillis() / 1000 + 3600

        val (opId, opHash) = generateOpIdAndHash(commands, deadline)
        val recomputedHash = BigInteger(1, calculateOperationHash(commands, opId))

        assertEquals(opHash, recomputedHash)
    }

    @Test
    fun `isValidEthereumAddress accepts valid addresses`() {
        assertTrue(isValidEthereumAddress("0x1234567890123456789012345678901234567890"))
        assertTrue(isValidEthereumAddress("0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCDEF"))
        assertTrue(isValidEthereumAddress("0x0000000000000000000000000000000000000000"))
    }

    @Test
    fun `isValidEthereumAddress rejects invalid addresses`() {
        assertFalse(isValidEthereumAddress(""))
        assertFalse(isValidEthereumAddress("0x123"))
        assertFalse(isValidEthereumAddress("1234567890123456789012345678901234567890"))
        assertFalse(isValidEthereumAddress("0x12345678901234567890123456789012345678901"))
        assertFalse(isValidEthereumAddress("0x123456789012345678901234567890123456789g"))
    }

    @Test
    fun `shortenAddress returns short address`() {
        val addr = "0x1234567890123456789012345678901234567890"
        assertEquals("0x1234...7890", shortenAddress(addr))
    }

    @Test
    fun `shortenAddress returns short address unchanged`() {
        val addr = "0x1234"
        assertEquals("0x1234", shortenAddress(addr))
    }
}

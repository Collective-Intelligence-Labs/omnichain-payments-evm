package com.omnichain.payments.data.web3

import com.omnichain.payments.model.AssetTransfer
import com.omnichain.payments.model.NetworkConfig
import com.omnichain.payments.model.Operation
import com.omnichain.payments.model.WalletState
import com.omnichain.payments.model.WalletStatus
import com.omnichain.payments.util.calculateOperationHash
import com.omnichain.payments.util.generateOpIdAndHash
import com.omnichain.payments.util.hexStringToByteArray
import com.omnichain.payments.util.isValidEthereumAddress
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.web3j.abi.FunctionEncoder
import org.web3j.abi.FunctionReturnDecoder
import org.web3j.abi.TypeReference
import org.web3j.abi.datatypes.Address
import org.web3j.abi.datatypes.Function
import org.web3j.abi.datatypes.Type
import org.web3j.abi.datatypes.Uint256
import org.web3j.abi.datatypes.Utf8String
import org.web3j.abi.datatypes.generated.Uint8
import org.web3j.crypto.Credentials
import org.web3j.crypto.ECKeyPair
import org.web3j.crypto.Hash
import org.web3j.crypto.Sign
import org.web3j.protocol.Web3j
import org.web3j.protocol.core.DefaultBlockParameterName
import org.web3j.protocol.core.methods.request.Transaction
import org.web3j.protocol.http.HttpService
import org.web3j.utils.Numeric
import java.math.BigInteger

class ContractService {

    private var web3j: Web3j? = null
    private var currentChainId: Long = 0

    fun initialize(rpcUrl: String, chainId: Long) {
        if (currentChainId == chainId && web3j != null) return
        web3j = Web3j.build(HttpService(rpcUrl))
        currentChainId = chainId
    }

    suspend fun getEthBalance(address: String): BigInteger = withContext(Dispatchers.IO) {
        web3j?.ethGetBalance(address, DefaultBlockParameterName.LATEST)
            ?.sendAsync()?.get()?.balance ?: BigInteger.ZERO
    }

    suspend fun getTokenBalance(tokenAddress: String, address: String): BigInteger = withContext(Dispatchers.IO) {
        val function = Function(
            "balanceOf",
            listOf(Address(address)),
            listOf(object : TypeReference<Uint256>() {})
        )
        callFunction(tokenAddress, function) as BigInteger
    }

    suspend fun getTokenDecimals(tokenAddress: String): Int = withContext(Dispatchers.IO) {
        val function = Function(
            "decimals",
            emptyList(),
            listOf(object : TypeReference<Uint8>() {})
        )
        (callFunction(tokenAddress, function) as BigInteger).toInt()
    }

    suspend fun getTokenSymbol(tokenAddress: String): String = withContext(Dispatchers.IO) {
        val function = Function(
            "symbol",
            emptyList(),
            listOf(object : TypeReference<Utf8String>() {})
        )
        callFunction(tokenAddress, function) as String
    }

    suspend fun getTokenName(tokenAddress: String): String = withContext(Dispatchers.IO) {
        val function = Function(
            "name",
            emptyList(),
            listOf(object : TypeReference<Utf8String>() {})
        )
        callFunction(tokenAddress, function) as String
    }

    suspend fun getPermitNonce(tokenAddress: String, owner: String): BigInteger = withContext(Dispatchers.IO) {
        val function = Function(
            "nonces",
            listOf(Address(owner)),
            listOf(object : TypeReference<Uint256>() {})
        )
        callFunction(tokenAddress, function) as BigInteger
    }

    suspend fun getTargetToken(processorAddress: String): String = withContext(Dispatchers.IO) {
        val function = Function(
            "targetToken",
            emptyList(),
            listOf(object : TypeReference<Address>() {})
        )
        val result = callFunction(processorAddress, function) as String
        result
    }

    suspend fun refreshWalletState(
        address: String,
        networkConfig: NetworkConfig
    ): WalletState = withContext(Dispatchers.IO) {
        initialize(networkConfig.rpcUrl, networkConfig.chainId)
        val ethBalance = getEthBalance(address)
        val tokenBalance = getTokenBalance(networkConfig.tokenAddress, address)
        val tokenSymbol = try {
            getTokenSymbol(networkConfig.tokenAddress)
        } catch (_: Exception) {
            networkConfig.tokenSymbol
        }
        val tokenDecimals = try {
            getTokenDecimals(networkConfig.tokenAddress)
        } catch (_: Exception) {
            networkConfig.tokenDecimals
        }
        WalletState(
            status = WalletStatus.CONNECTED,
            address = address,
            chainId = networkConfig.chainId,
            tokenBalance = tokenBalance,
            ethBalance = ethBalance,
            tokenSymbol = tokenSymbol,
            tokenDecimals = tokenDecimals
        )
    }

    fun createEip712PermitSignature(
        credentials: Credentials,
        tokenName: String,
        tokenAddress: String,
        chainId: Long,
        owner: String,
        spender: String,
        value: BigInteger,
        nonce: BigInteger,
        deadline: BigInteger
    ): ByteArray {
        val domainSeparator = calculateDomainSeparator(tokenName, tokenAddress, chainId)
        val typeHash = Numeric.hexStringToByteArray(
            Hash.sha3("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)")
        )
        val ownerHash = Numeric.hexStringToByteArray(Numeric.toHexStringWithPrefixZeroPadded(
            Numeric.toBigInt(owner), 64
        ).removePrefix("0x"))
        val spenderHash = Numeric.hexStringToByteArray(Numeric.toHexStringWithPrefixZeroPadded(
            Numeric.toBigInt(spender), 64
        ).removePrefix("0x"))
        val valueHash = Numeric.hexStringToByteArray(Numeric.toHexStringWithPrefixZeroPadded(value, 64))
        val nonceHash = Numeric.hexStringToByteArray(Numeric.toHexStringWithPrefixZeroPadded(nonce, 64))
        val deadlineHash = Numeric.hexStringToByteArray(Numeric.toHexStringWithPrefixZeroPadded(deadline, 64))

        val structHash = Hash.sha3(
            typeHash + ownerHash + spenderHash + valueHash + nonceHash + deadlineHash
        )
        val digest = Hash.sha3(
            "0x1901".toByteArray(Charsets.US_ASCII) + domainSeparator + structHash
        )

        val signatureData = Sign.signMessage(digest, credentials.ecKeyPair)
        val r = Numeric.hexStringToByteArray(Numeric.toHexStringWithPrefixZeroPadded(signatureData.r, 64))
        val s = Numeric.hexStringToByteArray(Numeric.toHexStringWithPrefixZeroPadded(signatureData.s, 64))
        val v = signatureData.v

        return r + s + byteArrayOf(v)
    }

    suspend fun buildAndSendOperation(
        credentials: Credentials,
        networkConfig: NetworkConfig,
        from: String,
        commands: List<AssetTransfer>,
        signPermit: (Eip712PermitData) -> ByteArray
    ): Pair<String, BigInteger> = withContext(Dispatchers.IO) {
        initialize(networkConfig.rpcUrl, networkConfig.chainId)
        val deadline = System.currentTimeMillis() / 1000 + 3600

        val (opId, opHash) = generateOpIdAndHash(commands, deadline)
        val totalValue = commands.fold(BigInteger.ZERO) { acc, cmd -> acc + cmd.amount }

        val tokenName = getTokenName(networkConfig.tokenAddress)
        val nonce = getPermitNonce(networkConfig.tokenAddress, from)

        val permitData = Eip712PermitData(
            tokenName = tokenName,
            tokenAddress = networkConfig.tokenAddress,
            chainId = networkConfig.chainId,
            owner = from,
            spender = networkConfig.processorAddress,
            value = totalValue,
            nonce = nonce,
            deadline = opHash
        )

        val signature = signPermit(permitData)

        val operation = Operation(
            deadline = deadline,
            opId = opId,
            from = from,
            commands = commands,
            signature = signature
        )

        val txHash = sendProcessTransaction(
            networkConfig.processorAddress,
            credentials,
            listOf(operation)
        )

        Pair(txHash, opId)
    }

    data class Eip712PermitData(
        val tokenName: String,
        val tokenAddress: String,
        val chainId: Long,
        val owner: String,
        val spender: String,
        val value: BigInteger,
        val nonce: BigInteger,
        val deadline: BigInteger
    )

    private suspend fun sendProcessTransaction(
        processorAddress: String,
        credentials: Credentials,
        operations: List<Operation>
    ): String {
        val function = Function(
            "process",
            listOf(encodeOperations(operations)),
            emptyList()
        )
        val encodedFunction = FunctionEncoder.encode(function)

        val ethGetTransactionCount = web3j!!.ethGetTransactionCount(
            credentials.address, DefaultBlockParameterName.PENDING
        ).sendAsync().get()

        val nonce = ethGetTransactionCount.transactionCount
        val gasPrice = web3j!!.ethGasPrice().sendAsync().get().gasPrice

        val tx = Transaction.createFunctionCallTransaction(
            credentials.address,
            nonce,
            gasPrice,
            BigInteger("300000"),
            processorAddress,
            BigInteger.ZERO,
            encodedFunction
        )

        val signedTx = Numeric.toHexStringWithPrefix(
            org.web3j.crypto.TransactionEncoder.signMessage(tx, credentials)
        )

        val response = web3j!!.ethSendRawTransaction(signedTx).sendAsync().get()
        response.transactionHash ?: throw RuntimeException("Transaction failed: ${response.error?.message}")
    }

    private fun calculateDomainSeparator(
        tokenName: String,
        tokenAddress: String,
        chainId: Long
    ): ByteArray {
        val typeHash = Hash.sha3("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
        val nameHash = Hash.sha3(tokenName.toByteArray())
        val versionHash = Hash.sha3("1".toByteArray())
        val chainIdPadded = Numeric.hexStringToByteArray(
            Numeric.toHexStringWithPrefixZeroPadded(BigInteger.valueOf(chainId), 64).removePrefix("0x")
        )
        val addressPadded = Numeric.hexStringToByteArray(
            Numeric.toHexStringWithPrefixZeroPadded(
                Numeric.toBigInt(tokenAddress), 64
            ).removePrefix("0x")
        )
        return Hash.sha3(
            Numeric.hexStringToByteArray(typeHash) + nameHash + versionHash + chainIdPadded + addressPadded
        )
    }

    @Suppress("UNCHECKED_CAST")
    private suspend fun callFunction(contractAddress: String, function: Function): Any {
        val encoded = FunctionEncoder.encode(function)
        val response = web3j!!.ethCall(
            Transaction.createEthCallTransaction(null, contractAddress, encoded),
            DefaultBlockParameterName.LATEST
        ).sendAsync().get()

        val returnTypes = function.outputParameters
        val decoded = FunctionReturnDecoder.decode(response.value, returnTypes)

        if (decoded.size == 1) {
            val value = decoded[0].value
            return when (decoded[0]) {
                is Uint256, is Uint8 -> value as BigInteger
                is Utf8String -> value as String
                is Address -> (value as String).lowercase()
                else -> value
            }
        }
        return decoded.map { it.value }
    }

    private fun encodeOperations(operations: List<Operation>): org.web3j.abi.datatypes.DynamicArray<*> {
        TODO("Complex tuple encoding - use raw ABI encoding instead")
    }

    suspend fun processBatchOperations(
        credentials: Credentials,
        processorAddress: String,
        operations: List<Operation>
    ): String {
        val encoded = encodeOperationAbi(operations)
        val nonce = web3j!!.ethGetTransactionCount(
            credentials.address, DefaultBlockParameterName.PENDING
        ).sendAsync().get().transactionCount

        val gasPrice = web3j!!.ethGasPrice().sendAsync().get().gasPrice

        val tx = Transaction.createFunctionCallTransaction(
            credentials.address,
            nonce,
            gasPrice,
            BigInteger("500000"),
            processorAddress,
            BigInteger.ZERO,
            encoded
        )

        val signedTx = Numeric.toHexStringWithPrefix(
            org.web3j.crypto.TransactionEncoder.signMessage(tx, credentials)
        )

        val response = web3j!!.ethSendRawTransaction(signedTx).sendAsync().get()
        return response.transactionHash
            ?: throw RuntimeException("Transaction failed: ${response.error?.message}")
    }

    private fun encodeOperationAbi(operations: List<Operation>): String {
        val sb = StringBuilder()
        sb.append(FunctionEncoder.encode(
            org.web3j.abi.datatypes.Function(
                "process",
                listOf(org.web3j.abi.datatypes.DynamicBytes(ByteArray(0))),
                emptyList()
            )
        ).substring(0, 10))

        for (op in operations) {
            val commandsEncoded = encodeCommands(op.commands)

            val signatureOffset = 32 + 32 + 32 + 32 + 32 + 32
            val commandsOffset = signatureOffset + 32

            sb.append(Numeric.toHexStringWithPrefixZeroPadded(BigInteger.valueOf(op.deadline), 64).removePrefix("0x"))
            sb.append(Numeric.toHexStringWithPrefixZeroPadded(op.opId, 64).removePrefix("0x"))
            sb.append(Numeric.toHexStringWithPrefixZeroPadded(Numeric.toBigInt(op.from), 64).removePrefix("0x"))
            sb.append(Numeric.toHexStringWithPrefixZeroPadded(commandsOffset.toBigInteger(), 64).removePrefix("0x"))
            sb.append(Numeric.toHexStringWithPrefixZeroPadded(signatureOffset.toBigInteger(), 64).removePrefix("0x"))

            sb.append(Numeric.toHexStringWithPrefixZeroPadded(BigInteger.valueOf(op.commands.size.toLong()), 64).removePrefix("0x"))
            for (cmd in op.commands) {
                sb.append(Numeric.toHexStringWithPrefixZeroPadded(Numeric.toBigInt(cmd.to), 64).removePrefix("0x"))
                sb.append(Numeric.toHexStringWithPrefixZeroPadded(cmd.amount, 64).removePrefix("0x"))
            }

            sb.append(Numeric.toHexStringWithPrefixZeroPadded(BigInteger.valueOf(op.signature.size.toLong()), 64).removePrefix("0x"))
            sb.append(Numeric.toHexString(op.signature).removePrefix("0x"))
            if (op.signature.size % 2 != 0) sb.append("0")
            sb.append("00".repeat((64 - (op.signature.size % 64)) % 64))
        }

        return sb.toString()
    }

    private fun encodeCommands(commands: List<AssetTransfer>): String {
        val sb = StringBuilder()
        sb.append(Numeric.toHexStringWithPrefixZeroPadded(BigInteger.valueOf(commands.size.toLong()), 64).removePrefix("0x"))
        for (cmd in commands) {
            sb.append(Numeric.toHexStringWithPrefixZeroPadded(Numeric.toBigInt(cmd.to), 64).removePrefix("0x"))
            sb.append(Numeric.toHexStringWithPrefixZeroPadded(cmd.amount, 64).removePrefix("0x"))
        }
        return sb.toString()
    }
}

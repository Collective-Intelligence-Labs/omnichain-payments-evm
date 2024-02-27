<template>
  <div class="transfer-form">
    <h1>OmniAssets</h1>
    <form @submit.prevent="submitForm">
      <div class="form-group">
        <label for="account">Account</label>
        <input type="text" id="account" v-model="formData.account" readonly>
      </div>
      <div class="form-group">
        <label for="balance">Balance</label>
        <input type="text" id="balance" v-model="balance" readonly>
        <label>Target Token: {{ tokenBalances.token1 }}</label>
        <br/>
        <label>Omni Token: {{ tokenBalances.token2 }}</label>
        <br/>
        <label>Allowance: {{ allowance }}</label>
        <br/>
        <label>Timestamp: {{ timestamp }}</label>
      </div>
      <div class="form-group">
        <label for="fee">Total Fee</label>
        <input type="number" id="fee" step="0.01" v-model="formData.fee">
      </div>
      <div class="form-group transfer-block" v-for="(transfer, index) in formData.transfers" :key="index" :style="getTransferBlockStyle(index)">
        <label :for="'amount-' + index">Amount</label>
        <input type="number" :id="'amount-' + index" step="0.01" v-model="transfer.amount">
        <label :for="'to-' + index">Recipient</label>
        <input type="text" :id="'to-' + index" v-model="transfer.to">
        <button @click="removeTransfer(index)">Remove</button>
      </div>
      <button type="button" @click="addTransfer">Add Transfer</button>
      <div class="form-group">
        <label for="deadline">Deadline</label>
        <input type="date" id="deadline" v-model="formData.deadline">
      </div>
      <button type="submit">Send</button>
      <button type="button" @click="submitTransfer()">Send Transfers Ops</button>
      <button type="button" @click="submitAllow()">Send Allow 10</button>
    </form>
  </div>
</template>


<script>
import ethers from 'ethers';
import erc20Abi from './ghoAbi.json'; // Ensure you have the ERC-20 ABI

import processorAbi from './Processor.json'; 

//import axios from 'axios';
import { signERC2612Permit } from 'eth-permit';


async function createTransferOperation(sender, commands, deadlineOffset = 3600, processorAddress) {
    const deadline = Math.floor(Date.now() / 1000) + deadlineOffset; // 1 hour from now

    const {opId, opHash} = generateOpIandHash(commands, deadline);

    // Calculate the total value to be permitted
    const totalValue = commands.reduce((sum, cmd) => sum + cmd.amount, 0);

    // Sign the message with the sender's private key
    const signature = await createPermitSignature(sender, sender.address, processor.target, totalValue, opHash);
    return {
        deadline: deadline,
        op_id: opId,
        commands: commands,
        signature: signature 
    };
}
  
  async function createPermitSignature(signer, owner, spender, value, deadline) {
    const domain = {
        name: await usdt.name(),
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: usdt.target,
    };
  
    const types = {
        Permit: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
        ],
    };
  
    const values = {
        owner,
        spender,
        value,
        nonce: await usdt.nonces(owner),
        deadline,
    };
  
    return await signer.signTypedData(domain, types, values);
  }
  
  
  function createTransferCommand(from, to, amount) {
    return {
      amount: amount,
      from,
      to
    };
  }
  
  
  function calculateOperationHash(commands, opId) {
    const coder = new ethers.AbiCoder();
    // Prepare the commands array in the format expected by the contract
    const formattedCommands = commands.map(cmd => [
        BigInt(cmd.amount), // Assuming amount is already a BigNumber or a similar object
        cmd.from,
        cmd.to
    ]);
  
    // Encode the opId and the commands array
    const encodedData = coder.encode(
        ["uint256", "tuple(uint256, address, address)[]"],
        [opId, formattedCommands]
    );
  
    // Compute the hash
    return ethers.keccak256(encodedData);
  }

  
  function generateOpIandHash(commands, deadlineMin)
  {
    let opHash = BigInt(0);
    let opId = BigInt(0);
    while (opHash < deadlineMin)
    {
       opId = BigInt(getRandomBytes32());
       opHash = calculateOperationHash(commands, opId);
    }
    return {opId, opHash};
  }


export default {
  data() {
    return {
      web3: null,
      account: null,
      targetTokenContract: null,
      processorContract: null,
      processorContractAddress: "0x1c11d635a6cc4057cd3d43a7413c12cfc6931b64",
      targetContractAddress: '0xc4bF5CbDaBE595361438F8c6a187bDc330539c60',
      formData: {
        account: '0x0032s...30asdas',
        balance: '10000 USDT',
        fee: '0.01',
        transfers: [
          { amount: '0.00', to: '' }
        ],
        deadline: this.getDefaultDeadline()
      },
      tokenBalances: {
        token1: '0',
        token2: '0'
      },
      allowance: '0',
      timestamp: Math.floor(Date.now() / 1000) + 4200,
    }
  },
  computed: {
    // Computed property to calculate the sum of token balances
    balance() {
      const balance1 = parseFloat(this.tokenBalances.token1);
      const balance2 = parseFloat(this.tokenBalances.token2);
      return (balance1 + balance2).toFixed(2) + " USDT"; // Assuming 2 decimal places for ERC-20 tokens
    },
    // ... other computed properties if needed ...
  },
  methods: {

    
    addTransfer() {
      this.formData.transfers.push({ amount: '0.00', to: '' });
    },
    removeTransfer(index) {
      this.formData.transfers.splice(index, 1);
    },

    async createTransferDataArray(formData) {
      const transferDataArray = [];

      // Assuming formData.transfers is an array of transfers
      const commands = formData.transfers.map(transfer =>  createTransferCommand(formData.account, formData.to, this.web3.utils.toWei(transfer.amount, 'ether')));

      const op = createTransferOperation(this.account, commands);

      transferDataArray.push(op);

      return transferDataArray;
    },

    async sendTransfeData(transferDataArray){
      const gasEstimate = await this.processorContract.methods.process(transferDataArray).estimateGas({ from: this.account });

        const result = await this.processorContract.methods.process(transferDataArray).send({
            from: this.account,
            gas: gasEstimate
        });
        console.log(result);
    },
    async submitTransfer(){

     // let ops = this.createOperations();
     // this.processorContract.methods.processOperations(ops).send({
     //   from: this.account
      //})

      let data = await this.createTransferDataArray(this.formData);
      console.log(data);
      await this.sendTransfeData(data);

    },

    async submitAllow() {
      await this.targetTokenContract.methods.approve( this.processorContractAddress, this.web3.utils.toWei("10.0", 'ether')).send({
        from: this.account,
      });
    },

    async submitForm() {
      // Handle the form submission
      console.log('Form data:', this.formData);
      
      // Sign message using injected provider (ie Metamask).
// You can replace window.ethereum with any other web3 provider.


var reduce = parseFloat(this.formData.fee);
for (let index = 0; index < this.formData.transfers .length; index++) {
  const transfer = this.formData.transfers[index];
  reduce += parseFloat(transfer.amount);
}
console.log(reduce);
var value = Web3.utils.toWei(reduce, "ether");
var owner = this.account;
var spender = this.processorContractAddress;
const result = await signERC2612Permit(window.ethereum, this.targetTokenContract._address, owner, spender, value);




await this.targetTokenContract.methods.permit(owner, spender, value, result.deadline, result.v, result.r, result.s).send({
  from: this.account,
});



/*

      let cmds = [];
      let amountToTransfer =  Math.min(this.tokenBalances.token2, this.formData.amount);
      let amountToDeposit =  this.formData.amount - amountToTransfer;

      console.log(amountToTransfer + ": amountToTransfer");
      console.log(amountToDeposit + ": amountToDeposit");


      const transferData = {
          cmd_id: Web3.utils.hexToNumber(this.web3.utils.randomHex(32)),
          cmd_type: 2,
          amount: Web3.utils.toWei(amountToDeposit, "ether"),
          from: this.account,
          to: this.formData.to,
          fee: Web3.utils.toWei(this.formData.fee, "ether"),
          deadline: Math.floor(Date.now() / 1000) + 4200
        };

        console.log('Transfer data:', transferData);
      if (amountToDeposit > 0)
      {
        cmds.push(await this.encodeTransferData(transferData));
      }

      if (amountToTransfer > 0)
      {
        transferData.amount = Web3.utils.toWei(amountToTransfer, 'ether');
        transferData.cmd_type = 1;
        cmds.push(await this.encodeTransferData(transferData));
      }
      // Additional code to handle submission
console.log("CMDS: ")
console.log(cmds);
          const response = await axios.post('http://localhost:5002/Transfer/submit-transfer', {cmds: cmds});
          console.log('Server response:', response.data);
     
*/

    },

    encodeAssetTransfer(assetTransfer) {
    // AssetTransfer ABI
    const assetTransferABI = [
        { "type": "uint256", "name": "cmd_type" },
        { "type": "uint256", "name": "amount" },
        { "type": "address", "name": "from" },
        { "type": "address", "name": "to" }
    ];

    return this.web3.eth.abi.encodeParameters(assetTransferABI, [
        assetTransfer.cmd_type,
        assetTransfer.amount,
        assetTransfer.from,
        assetTransfer.to
    ]);
},

async createOperations() {
    let cmdsEncoded = this.formData.transfers.map(x => this.encodeAssetTransfer({
      cmd_type: 1,
      amount:  Web3.utils.toWei(parseFloat(x.amount), "ether"),
      from: this.account,
      to: x.to,
    }));
     
    const hash = Web3.utils.keccak256(cmdsEncoded);
    const signature = this.web3.eth.sign(hash, this.account);

    const operation = {
        commands: cmdsEncoded,
        signatures: [signature],
        metadata: {
            id: 1,
            payee: '0xPayeeAddress',
            router: '0xRouterAddress', 
            fee: 100,
            deadline: Math.floor(Date.now() / 1000) + 60 * 10 // 10 minutes from now
        }
    };

    return [operation];
},
    async updateBalances() {
      if (!this.web3 || !this.account) {
        console.error('Web3 is not initialized or account not set.');
        return;
      }
      // Replace with actual contract addresses
      this.targetTokenContract = new this.web3.eth.Contract(erc20Abi, this.targetContractAddress);
      this.omniTokenContract = new this.web3.eth.Contract(erc20Abi, this.omniContractAddress);

      try {
        const balance1 = await this.targetTokenContract.methods.balanceOf(this.account).call();
        const balance2 = await this.omniTokenContract.methods.balanceOf(this.account).call();
        const allowance = await this.targetTokenContract.methods.allowance(this.account, this.processorContractAddress).call();

        this.tokenBalances.token1 = this.web3.utils.fromWei(balance1, 'ether');
        this.tokenBalances.token2 = this.web3.utils.fromWei(balance2, 'ether');
        this.allowance = this.web3.utils.fromWei(allowance, 'ether');
        
        this.formData.balance = parseFloat(this.tokenBalances.token1) + parseFloat(this.tokenBalances.token2);
      } catch (error) {
        console.error('Error fetching balances:', error);
      }
    },
    getDefaultDeadline() {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    },

    async signCmd(data, account){
      const hash = Web3.utils.keccak256(data);
      return await this.web3.eth.sign(hash, account);
    },
    async signPermit(
  owner,    // address of the token owner
  spender,  // address of the spender
  value,    // value to permit
  deadline  // deadline of the permit
) {
  const chainId = await this.web3.eth.getChainId();
  const nonce = await this.targetTokenContract.methods.nonces(owner).call();

  // Convert numeric values to strings
  const valueStr = value.toString();
  const deadlineStr = deadline.toString();
  const nonceStr = nonce.toString();
  const chainIdStr = chainId.toString();

  const domain = [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ];

  const permit = [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ];
  const domainData = {
    name: await this.targetTokenContract.methods.name().call(),
    version: "1",
    chainId: chainIdStr,
    verifyingContract: this.targetTokenContract._address,
  };

  const message = {
    owner: owner,
    spender: spender,
    value: valueStr,
    nonce: nonceStr,
    deadline: deadlineStr,
  };

  const data = JSON.stringify({
    types: {
      EIP712Domain: domain,
      Permit: permit,
    },
    domain: domainData,
    primaryType: "Permit",
    message: message,
  });

  const accounts = await this.web3.eth.getAccounts();
  if (!accounts[0]) throw new Error("No account is connected");

  return new Promise((resolve, reject) => {
    this.web3.currentProvider.send(
      {
        method: "eth_signTypedData_v4",
        params: [accounts[0], data],
        from: accounts[0],
      },
      function (err, result) {
        if (err) return reject(err);
        resolve(result.result);
      }
    );
  });
},
async signCmd2(transferData) {
  const chainId = await this.web3.eth.getChainId();
  const domain = [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ];

  const cmd = [
   // { name: "cmd_id", type: "uint256" },
   // { name: "cmd_type", type: "uint256" },
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "fee", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ];
  const domainData = {
    name: "Processor",
    version: "1",
    chainId: chainId.toString(),
    verifyingContract: this.processorContractAddress,
  };

  const message = {
   // cmd_id: transferData.cmd_id.toString(),
   // cmd_type: transferData.cmd_type.toString(),
    from: transferData.from,
    to: transferData.to,
    amount: transferData.amount.toString(),
    fee: transferData.fee.toString(),
    deadline: transferData.deadline.toString(),
  };

  const data = JSON.stringify({
    types: {
      EIP712Domain: domain,
      Transfer: cmd,
    },
    domain: domainData,
    primaryType: "Transfer",
    message: message,
  });

  const accounts = await this.web3.eth.getAccounts();
  if (!accounts[0]) throw new Error("No account is connected");

  return new Promise((resolve, reject) => {
    this.web3.currentProvider.send(
      {
        method: "eth_signTypedData_v4",
        params: [accounts[0], data],
        from: accounts[0],
      },
      function (err, result) {
        if (err) return reject(err);
        resolve(result.result);
      }
    );
  });
},
    async encodeTransferData(transferData) {

      // Encode AssetTransfer data (pseudo-code, replace with your actual data encoding)
      const encodedData = this.web3.eth.abi.encodeParameters(
          ['uint256', 'uint256', 'uint256', 'address', 'address', 'uint256', 'uint256'], 
          [transferData.cmd_id, transferData.cmd_type, transferData.amount, transferData.from, transferData.to, transferData.fee, transferData.deadline]
      );

      // Sign the data
      let signature = null;

      if (transferData.cmd_type == 2) { // DEPOSIT case signature
          // sign the Permit type data with the deployer's private key
          //signature = await this.signCmd2(transferData);
          signature = await this.signPermit(transferData.from, this.processorContractAddress, transferData.amount, transferData.deadline)
      } else {
        signature = await this.signCmd(encodedData, transferData.from);
      }

      // Construct the TransferData object
      const transferDataObject = {
          signature: signature,
          data: encodedData // Depending on how your contract expects this
      };

      console.log("Sig: " + signature);

      // Encode the entire TransferData object as bytes
      const transferDataEncoded = this.web3.eth.abi.encodeParameters(
          ['bytes', 'bytes'],
          [signature, transferDataObject.data]
      );

      return transferDataEncoded;
    },
    getTransferBlockStyle(index) {
    // Here you can define your logic to assign different colors
    // For simplicity, this example uses a basic color change based on even/odd index
    const backgroundColor = index % 2 === 0 ? '#f0f0f0' : '#e0e0e0';
    return {
      backgroundColor,
      // Add any other dynamic styles here
    };
  },
  },
  mounted() {
    if (window.ethereum) {
      this.web3 = new Web3(window.ethereum);

      this.processorContract = new this.web3.eth.Contract(processorAbi, this.processorContractAddress);
      window.ethereum.request({ method: 'eth_requestAccounts' })
        .then(accounts => {
          this.account = accounts[0];
          this.formData.account = this.account;
          this.updateBalances();
        })
        .catch(error => {
          console.error('Error requesting accounts:', error);
        });
    } else {
      alert('Please install MetaMask to use this feature.');
    }
  }
}
</script>

<style>
.transfer-form {
  max-width: 600px;
  margin: 3rem auto;
  padding: 2rem;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
}

.transfer-form h1 {
  font-size: 2rem;
  color: #333;
  margin-bottom: 2rem;
}

.transfer-form input[type="text"],
.transfer-form input[type="number"],
.transfer-form input[type="date"] {
  width: calc(100% - 24px);
  padding: 12px;
  margin-bottom: 1rem;
  border: 1px solid #dfe3e9;
  border-radius: 6px;
  font-size: 1rem;
  box-sizing: border-box;
}

.transfer-form input[type="text"]:read-only,
.transfer-form input[type="number"]:read-only {
  background-color: #f9f9f9;
  color: #bec3c9;
}

.transfer-form button[type="submit"],
.transfer-form button[type="button"] {
  width: 100%;
  padding: 15px 0;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-top: 1rem;
}

.transfer-form button[type="button"] {
  background-color: #2ecc71;
  margin-bottom: 2rem; /* More space before transfer blocks */
}

.transfer-form button[type="submit"]:hover,
.transfer-form button[type="button"]:hover {
  background-color: #2980b9;
}

.transfer-block {
  border: 1px solid #eaecef;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 1rem;
  position: relative;
}

.remove-button {
  background-color: #e74c3c;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.2s;
  position: absolute;
  top: 10px;
  right: 10px;
}

.remove-button:hover {
  background-color: #c0392b;
}

@media (max-width: 768px) {
  .transfer-form {
    margin: 2rem;
    padding: 1.5rem;
  }
  .transfer-form h1 {
    margin-bottom: 1.5rem;
  }
}
</style>

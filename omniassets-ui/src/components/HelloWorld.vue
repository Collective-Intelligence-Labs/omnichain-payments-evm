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
import Web3 from 'web3';

class Cila {

}

export default {
  data() {
    return {
      web3: null,
      account: null,
      targetTokenContract: null,
      processorContract: null,
      cila: null,
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
      const commands = formData.transfers.map(transfer =>  this.cila.createTransferCommand(formData.account, formData.to, this.web3.utils.toWei(transfer.amount, 'ether')));

      const op = this.cila.createTransferOperation(this.account, commands);

      transferDataArray.push(op);

      return transferDataArray;
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

    async submitForm() {
      // Handle the form submission
      console.log('Form data:', this.formData);
    },
    async updateBalances() {
      if (!this.web3 || !this.account) {
        console.error('Web3 is not initialized or account not set.');
        return;
      }
      try {
        const balance1 = await this.cila.readBalance(this.account);

        this.tokenBalances.token1 = this.web3.utils.fromWei(balance1, 'ether');

        
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

      this.cila = new Cila('https://localhost:3000')
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

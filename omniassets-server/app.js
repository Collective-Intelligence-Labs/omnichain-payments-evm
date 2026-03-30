const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const TransferData = require('./models/TransferData');
const Operation = require('./models/Operation');
const Settings = require('./models/Settings');
const cron = require('node-cron');
const sender = require('./sender');

const app = express();
app.use(express.json());
app.use(cors());

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/omniassets';
const PORT = process.env.PORT || 3000;

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

app.post("/route/operations", async (req, res) => {
  const { ops } = req.body;
  if (!ops || !Array.isArray(ops) || ops.length === 0) {
      return res.status(400).send('Invalid or missing cmds array');
  }

  try {
      const bulkOps = ops.map(op => ({
          insertOne: {
              document: op
          }
      }));

      await TransferData.bulkWrite(bulkOps);
      res.status(200).send('Transfer data saved');
  } catch (error) {
      console.error('Error saving transfer data:', error);
      res.status(500).send('Internal Server Error');
  }
} )

app.get("/balance/:address", async (req, res) => {
  const { address } = req.params;

  try {
      const balance = await cilaSDK.readBalance(address);
      res.json({ address, balance });
  } catch (error) {
      console.error('Error fetching balance:', error);
      res.status(500).send("Internal Server Error");
  }
});

// Admin API routes
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin-secret-change-me';

function adminAuth(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${ADMIN_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

app.get("/api/admin/health", adminAuth, async (req, res) => {
    try {
        const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
        res.json({
            status: 'ok',
            mongodb: dbStatus,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: 'Health check failed' });
    }
});

app.get("/api/admin/stats", adminAuth, async (req, res) => {
    try {
        const pendingTransfers = await TransferData.countDocuments();
        const totalOperations = await Operation.countDocuments();
        const recentTransfers = await TransferData.find()
            .sort({ _id: -1 })
            .limit(10)
            .lean();

        const totalAmount = recentTransfers.reduce((sum, t) => {
            return sum + (t.data && t.data.amount ? parseFloat(t.data.amount) : 0);
        }, 0);

        res.json({
            pendingTransfers,
            totalOperations,
            totalAmount: totalAmount.toString(),
            recentTransfers,
            mongodbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

app.get("/api/admin/transfers", adminAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const [transfers, total] = await Promise.all([
            TransferData.find().sort({ _id: -1 }).skip(skip).limit(limit).lean(),
            TransferData.countDocuments()
        ]);

        res.json({
            transfers,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error fetching transfers:', error);
        res.status(500).json({ error: 'Failed to fetch transfers' });
    }
});

app.delete("/api/admin/transfers/:id", adminAuth, async (req, res) => {
    try {
        const result = await TransferData.findByIdAndDelete(req.params.id);
        if (!result) {
            return res.status(404).json({ error: 'Transfer not found' });
        }
        res.json({ message: 'Transfer deleted', id: result._id });
    } catch (error) {
        console.error('Error deleting transfer:', error);
        res.status(500).json({ error: 'Failed to delete transfer' });
    }
});

app.delete("/api/admin/transfers", adminAuth, async (req, res) => {
    try {
        const result = await TransferData.deleteMany({});
        res.json({ message: 'All transfers cleared', deletedCount: result.deletedCount });
    } catch (error) {
        console.error('Error clearing transfers:', error);
        res.status(500).json({ error: 'Failed to clear transfers' });
    }
});

app.get("/api/admin/operations", adminAuth, async (req, res) => {
    try {
        const operations = await Operation.find().sort({ _id: -1 }).lean();
        res.json({ operations });
    } catch (error) {
        console.error('Error fetching operations:', error);
        res.status(500).json({ error: 'Failed to fetch operations' });
    }
});

app.delete("/api/admin/operations", adminAuth, async (req, res) => {
    try {
        const result = await Operation.deleteMany({});
        res.json({ message: 'All operations cleared', deletedCount: result.deletedCount });
    } catch (error) {
        console.error('Error clearing operations:', error);
        res.status(500).json({ error: 'Failed to clear operations' });
    }
});

// Admin: Get all contracts
app.get("/api/admin/contracts", adminAuth, async (req, res) => {
    try {
        const contractsSetting = await Settings.findOne({ key: 'contracts' });
        const defaultSetting = await Settings.findOne({ key: 'defaultContract' });
        const contracts = contractsSetting ? contractsSetting.value : [];
        const defaultContract = defaultSetting ? defaultSetting.value : null;
        res.json({ contracts, defaultContract });
    } catch (error) {
        console.error('Error fetching contracts:', error);
        res.status(500).json({ error: 'Failed to fetch contracts' });
    }
});

// Admin: Add a new contract
app.post("/api/admin/contracts", adminAuth, async (req, res) => {
    const { name, address, network, tokenAddress } = req.body;
    if (!name || !address || !network) {
        return res.status(400).json({ error: 'name, address, and network are required' });
    }
    try {
        const contractsSetting = await Settings.findOne({ key: 'contracts' });
        const contracts = contractsSetting ? contractsSetting.value : [];
        const existing = contracts.find(c => c.address.toLowerCase() === address.toLowerCase() && c.network === network);
        if (existing) {
            return res.status(409).json({ error: 'Contract already exists for this network' });
        }
        const newContract = {
            id: `contract_${Date.now()}`,
            name,
            address,
            network,
            tokenAddress: tokenAddress || null,
            addedAt: new Date().toISOString()
        };
        contracts.push(newContract);
        await Settings.findOneAndUpdate(
            { key: 'contracts' },
            { value: contracts, updatedAt: new Date() },
            { upsert: true, new: true }
        );
        if (!contractsSetting) {
            await Settings.findOneAndUpdate(
                { key: 'defaultContract' },
                { value: newContract.id, updatedAt: new Date() },
                { upsert: true }
            );
        }
        res.json({ message: 'Contract added', contract: newContract });
    } catch (error) {
        console.error('Error adding contract:', error);
        res.status(500).json({ error: 'Failed to add contract' });
    }
});

// Admin: Delete a contract
app.delete("/api/admin/contracts/:id", adminAuth, async (req, res) => {
    try {
        const contractsSetting = await Settings.findOne({ key: 'contracts' });
        if (!contractsSetting) {
            return res.status(404).json({ error: 'No contracts found' });
        }
        const contracts = contractsSetting.value;
        const idx = contracts.findIndex(c => c.id === req.params.id);
        if (idx === -1) {
            return res.status(404).json({ error: 'Contract not found' });
        }
        contracts.splice(idx, 1);
        await Settings.findOneAndUpdate(
            { key: 'contracts' },
            { value: contracts, updatedAt: new Date() },
            { upsert: true }
        );
        const defaultSetting = await Settings.findOne({ key: 'defaultContract' });
        if (defaultSetting && defaultSetting.value === req.params.id) {
            const newDefault = contracts.length > 0 ? contracts[0].id : null;
            await Settings.findOneAndUpdate(
                { key: 'defaultContract' },
                { value: newDefault, updatedAt: new Date() },
                { upsert: true }
            );
        }
        res.json({ message: 'Contract deleted' });
    } catch (error) {
        console.error('Error deleting contract:', error);
        res.status(500).json({ error: 'Failed to delete contract' });
    }
});

// Admin: Set default contract
app.put("/api/admin/contracts/:id/default", adminAuth, async (req, res) => {
    try {
        const contractsSetting = await Settings.findOne({ key: 'contracts' });
        if (!contractsSetting) {
            return res.status(404).json({ error: 'No contracts found' });
        }
        const contract = contractsSetting.value.find(c => c.id === req.params.id);
        if (!contract) {
            return res.status(404).json({ error: 'Contract not found' });
        }
        await Settings.findOneAndUpdate(
            { key: 'defaultContract' },
            { value: req.params.id, updatedAt: new Date() },
            { upsert: true }
        );
        res.json({ message: 'Default contract updated', contractId: req.params.id });
    } catch (error) {
        console.error('Error setting default contract:', error);
        res.status(500).json({ error: 'Failed to set default contract' });
    }
});

// Admin: Deploy Processor contract
app.post("/api/admin/contracts/deploy", adminAuth, async (req, res) => {
    const { network, tokenAddress } = req.body;
    if (!network) {
        return res.status(400).json({ error: 'network is required' });
    }
    try {
        const rpcUrls = {
            sepolia: 'https://rpc.sepolia.org/',
            mainnet: 'https://eth.llamarpc.com',
            localhost: 'http://127.0.0.1:8545',
        };
        const rpcUrl = rpcUrls[network] || network;
        const { ethers } = require('ethers');
        const mnemonic = process.env.MNEMONIC;
        if (!mnemonic) {
            return res.status(500).json({ error: 'MNEMONIC not configured on server' });
        }
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const wallet = ethers.Wallet.fromPhrase(mnemonic, provider);

        const processorBytecode = require('fs').readFileSync(
            require('path').join(__dirname, 'artifacts', 'Processor.json'),
            'utf8'
        );
        const artifact = JSON.parse(processorBytecode);

        if (!tokenAddress) {
            const usdcArtifact = JSON.parse(
                require('fs').readFileSync(
                    require('path').join(__dirname, 'artifacts', 'USDCMock.json'),
                    'utf8'
                )
            );
            const usdcFactory = new ethers.ContractFactory(usdcArtifact.abi, usdcArtifact.bytecode, wallet);
            const usdc = await usdcFactory.deploy();
            await usdc.waitForDeployment();
            const usdcAddr = await usdc.getAddress();
            const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
            const processor = await factory.deploy(usdcAddr);
            await processor.waitForDeployment();
            const processorAddress = await processor.getAddress();

            const contractId = `contract_${Date.now()}`;
            const newContract = {
                id: contractId,
                name: `Processor (${network})`,
                address: processorAddress,
                network,
                tokenAddress: usdcAddr,
                tokenName: 'USDCMock',
                deployedBy: wallet.address,
                deployedAt: new Date().toISOString()
            };

            const contractsSetting = await Settings.findOne({ key: 'contracts' });
            const contracts = contractsSetting ? contractsSetting.value : [];
            contracts.push(newContract);
            await Settings.findOneAndUpdate(
                { key: 'contracts' },
                { value: contracts, updatedAt: new Date() },
                { upsert: true }
            );
            await Settings.findOneAndUpdate(
                { key: 'defaultContract' },
                { value: contractId, updatedAt: new Date() },
                { upsert: true }
            );
            res.json({
                message: 'Processor and USDCMock deployed',
                contract: newContract,
                tokenAddress: usdcAddr,
                transactionHash: processor.deploymentTransaction?.hash || null
            });
        } else {
            const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
            const processor = await factory.deploy(tokenAddress);
            await processor.waitForDeployment();
            const processorAddress = await processor.getAddress();

            const contractId = `contract_${Date.now()}`;
            const newContract = {
                id: contractId,
                name: `Processor (${network})`,
                address: processorAddress,
                network,
                tokenAddress,
                deployedBy: wallet.address,
                deployedAt: new Date().toISOString()
            };

            const contractsSetting = await Settings.findOne({ key: 'contracts' });
            const contracts = contractsSetting ? contractsSetting.value : [];
            contracts.push(newContract);
            await Settings.findOneAndUpdate(
                { key: 'contracts' },
                { value: contracts, updatedAt: new Date() },
                { upsert: true }
            );
            await Settings.findOneAndUpdate(
                { key: 'defaultContract' },
                { value: contractId, updatedAt: new Date() },
                { upsert: true }
            );
            res.json({
                message: 'Processor deployed',
                contract: newContract,
                transactionHash: processor.deploymentTransaction?.hash || null
            });
        }
    } catch (error) {
        console.error('Error deploying contract:', error);
        res.status(500).json({ error: `Deployment failed: ${error.message}` });
    }
});

// Scheduler setup for every minute
cron.schedule('*/1 * * * *', async () => {
    try {
        console.log("SCHEDULER RUN: ");
        const transferDataList = await TransferData.find({});

        if (transferDataList.length > 0) {
            if (await sender.sendToBlockchain(transferDataList.map(data => data.encodedData))) {
                await TransferData.deleteMany({ _id: { $in: transferDataList.map(data => data._id) } });
            }
        }
    } catch (error) {
        console.error('Error in scheduled task:', error);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

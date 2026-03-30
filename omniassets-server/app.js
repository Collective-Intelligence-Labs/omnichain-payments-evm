const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const TransferData = require('./models/TransferData');
const Operation = require('./models/Operation');
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

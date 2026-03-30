const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const TransferData = require('./models/TransferData'); // The Mongoose model
const cron = require('node-cron');
const sender = require('./sender');

const app = express();
app.use(express.json());
app.use(cors());

// Improved MongoDB connection with error handling
mongoose.connect('mongodb://localhost:27017/omniassets', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

app.post("/route/operations", async (req, res) => {
  const { ops } = req.body;
  if (!ops || !Array.isArray(ops) || ops.length === 0) {
      return res.status(400).send('Invalid or missing cmds array');
  }

  try {
      // Utilize bulk operation for efficiency
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

  // Validate the address if necessary
  if (!address || !ethers.utils.isAddress(address)) {
      return res.status(400).send("Invalid address");
  }

  try {
      const balance = await cilaSDK.readBalance(address);
      res.json({ address, balance });
  } catch (error) {
      console.error('Error fetching balance:', error);
      res.status(500).send("Internal Server Error");
  }
});


// Scheduler setup for every minute
cron.schedule('*/1 * * * *', async () => {
    try {
        console.log("SCHEDULER RUN: ");
        const transferDataList = await TransferData.find({});

        if (transferDataList.length > 0) {
            if (await sender.sendToBlockchain(transferDataList.map(data => data.encodedData))) {
                // Delete the processed data
                await TransferData.deleteMany({ _id: { $in: transferDataList.map(data => data._id) } });
            }
        }
    } catch (error) {
        console.error('Error in scheduled task:', error);
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});

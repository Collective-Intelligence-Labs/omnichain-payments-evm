const mongoose = require('mongoose');

const transferDataSchema = new mongoose.Schema({
  s: String,
  r: String,
  v: String,
  encodedData: String,
  data: {
    cmd_id: Number,
    cmd_type: Number,
    amount: String,
    from: String,
    to: String,
    fee: String,
    deadline: Number
  }
});

const TransferData = mongoose.model('TransferData', transferDataSchema);

module.exports = TransferData;

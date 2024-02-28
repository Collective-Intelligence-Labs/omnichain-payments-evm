const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
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

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;

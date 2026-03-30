const mongoose = require('mongoose');

const operationSchema = new mongoose.Schema({
  deadline: Number,
  op_id: String,
  commands: Array,
  signature: String
});

const Operation = mongoose.model('Operation', operationSchema);

module.exports = Operation;

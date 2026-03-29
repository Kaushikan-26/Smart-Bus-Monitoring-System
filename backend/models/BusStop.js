const mongoose = require('mongoose');

const busStopSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  address: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('BusStop', busStopSchema);

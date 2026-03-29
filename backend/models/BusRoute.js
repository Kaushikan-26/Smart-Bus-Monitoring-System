const mongoose = require('mongoose');

const busRouteSchema = new mongoose.Schema({
  routeNumber: { type: String, required: true, unique: true },
  busName: { type: String, required: true },
  stops: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BusStop' }],
  description: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('BusRoute', busRouteSchema);

const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  passenger: { type: mongoose.Schema.Types.ObjectId, ref: 'Passenger', required: true },
  route: { type: mongoose.Schema.Types.ObjectId, ref: 'BusRoute', required: true },
  stop: { type: mongoose.Schema.Types.ObjectId, ref: 'BusStop', required: true },
  status: {
    type: String,
    enum: ['pending', 'sent', 'completed'],
    default: 'pending',
  },
  sentAt: { type: Date },
  notes: { type: String, default: '' },
}, { timestamps: true });

// Index to quickly find pending requests by passenger
requestSchema.index({ passenger: 1, status: 1 });

module.exports = mongoose.model('Request', requestSchema);

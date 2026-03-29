const mongoose = require('mongoose');

const passengerSchema = new mongoose.Schema({
  mobile: { type: String, required: true, unique: true, match: /^[0-9]{10}$/ },
  otpCode: { type: String },
  otpExpiry: { type: Date },
  isVerified: { type: Boolean, default: false },
  name: { type: String, default: '' },
}, { timestamps: true });

passengerSchema.methods.isOtpValid = function (otp) {
  return this.otpCode === otp && this.otpExpiry > new Date();
};

module.exports = mongoose.model('Passenger', passengerSchema);

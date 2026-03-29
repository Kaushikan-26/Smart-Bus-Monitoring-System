const express = require('express');
const jwt = require('jsonwebtoken');
const Passenger = require('../models/Passenger');
const Admin = require('../models/Admin');

const router = express.Router();

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/auth/send-otp  (passenger)
router.post('/send-otp', async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile || !/^[0-9]{10}$/.test(mobile)) {
      return res.status(400).json({ message: 'Enter a valid 10-digit mobile number' });
    }

    const otp = generateOTP();
    const expiry = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRY_MINUTES) || 5) * 60 * 1000);

    let passenger = await Passenger.findOne({ mobile });
    if (!passenger) {
      passenger = new Passenger({ mobile });
    }
    passenger.otpCode = otp;
    passenger.otpExpiry = expiry;
    await passenger.save();

    // In production replace with actual SMS gateway
    console.log(`\n📱 OTP for ${mobile}: ${otp}  (valid for 5 minutes)\n`);

    res.json({ message: 'OTP sent successfully', mobile });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/auth/verify-otp  (passenger)
router.post('/verify-otp', async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    if (!mobile || !otp) {
      return res.status(400).json({ message: 'Mobile and OTP are required' });
    }

    const passenger = await Passenger.findOne({ mobile });
    if (!passenger) {
      return res.status(404).json({ message: 'Passenger not found. Please send OTP first.' });
    }

    if (!passenger.isOtpValid(otp)) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    passenger.isVerified = true;
    passenger.otpCode = undefined;
    passenger.otpExpiry = undefined;
    await passenger.save();

    const token = jwt.sign(
      { id: passenger._id, mobile: passenger.mobile, role: 'passenger' },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ message: 'Login successful', token, passenger: { id: passenger._id, mobile: passenger.mobile } });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/auth/admin-login  (admin & depot)
router.post('/admin-login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin._id, username: admin.username, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ message: 'Login successful', token, user: { id: admin._id, name: admin.name, username: admin.username, role: admin.role } });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/auth/me  (any authenticated user)
router.get('/me', require('../middleware/auth')(['passenger', 'admin', 'depot']), (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;

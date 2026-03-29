const express = require('express');
const BusStop = require('../models/BusStop');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/stops  (public)
router.get('/', async (req, res) => {
  try {
    const stops = await BusStop.find().sort({ name: 1 });
    res.json(stops);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/stops/:id  (public)
router.get('/:id', async (req, res) => {
  try {
    const stop = await BusStop.findById(req.params.id);
    if (!stop) return res.status(404).json({ message: 'Stop not found' });
    res.json(stop);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/stops  (admin only)
router.post('/', authMiddleware(['admin']), async (req, res) => {
  try {
    const { name, lat, lng, address } = req.body;
    if (!name || lat === undefined || lng === undefined) {
      return res.status(400).json({ message: 'Name, lat, and lng are required' });
    }
    const stop = new BusStop({ name, lat, lng, address });
    await stop.save();
    res.status(201).json(stop);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Stop name already exists' });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/stops/:id  (admin only)
router.put('/:id', authMiddleware(['admin']), async (req, res) => {
  try {
    const stop = await BusStop.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!stop) return res.status(404).json({ message: 'Stop not found' });
    res.json(stop);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/stops/:id  (admin only)
router.delete('/:id', authMiddleware(['admin']), async (req, res) => {
  try {
    const stop = await BusStop.findByIdAndDelete(req.params.id);
    if (!stop) return res.status(404).json({ message: 'Stop not found' });
    res.json({ message: 'Stop deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;

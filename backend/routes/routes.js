const express = require('express');
const BusRoute = require('../models/BusRoute');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /api/routes  (public)
router.get('/', async (req, res) => {
  try {
    const routes = await BusRoute.find({ isActive: true }).populate('stops').sort({ routeNumber: 1 });
    res.json(routes);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/routes/all  (admin - includes inactive)
router.get('/all', authMiddleware(['admin']), async (req, res) => {
  try {
    const routes = await BusRoute.find().populate('stops').sort({ routeNumber: 1 });
    res.json(routes);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/routes/search?q=  (public)
router.get('/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    const routes = await BusRoute.find({
      isActive: true,
      $or: [
        { routeNumber: { $regex: q, $options: 'i' } },
        { busName: { $regex: q, $options: 'i' } },
      ]
    }).populate('stops');
    res.json(routes);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/routes/:id  (public)
router.get('/:id', async (req, res) => {
  try {
    const route = await BusRoute.findById(req.params.id).populate('stops');
    if (!route) return res.status(404).json({ message: 'Route not found' });
    res.json(route);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/routes  (admin only)
router.post('/', authMiddleware(['admin']), async (req, res) => {
  try {
    const { routeNumber, busName, stops, description } = req.body;
    if (!routeNumber || !busName) {
      return res.status(400).json({ message: 'Route number and bus name are required' });
    }
    const route = new BusRoute({ routeNumber, busName, stops: stops || [], description });
    await route.save();
    await route.populate('stops');
    res.status(201).json(route);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Route number already exists' });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PUT /api/routes/:id  (admin only)
router.put('/:id', authMiddleware(['admin']), async (req, res) => {
  try {
    const route = await BusRoute.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('stops');
    if (!route) return res.status(404).json({ message: 'Route not found' });
    res.json(route);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE /api/routes/:id  (admin only)
router.delete('/:id', authMiddleware(['admin']), async (req, res) => {
  try {
    const route = await BusRoute.findByIdAndDelete(req.params.id);
    if (!route) return res.status(404).json({ message: 'Route not found' });
    res.json({ message: 'Route deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;

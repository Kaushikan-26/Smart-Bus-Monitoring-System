const express = require('express');
const Request = require('../models/Request');
const authMiddleware = require('../middleware/auth');
const { dispatchBusToStop } = require('../busSimulator');

const router = express.Router();

const THRESHOLD = 5; // alert when a stop+route has >= 5 pending requests

// POST /api/requests  (passenger only)
router.post('/', authMiddleware(['passenger']), async (req, res) => {
  try {
    const { routeId, stopId } = req.body;
    if (!routeId || !stopId) {
      return res.status(400).json({ message: 'Route and stop are required' });
    }

    // One active request per passenger
    const existing = await Request.findOne({ passenger: req.user.id, status: 'pending' });
    if (existing) {
      return res.status(409).json({
        message: 'You already have an active request. Please wait for it to be fulfilled before making a new one.',
        existingRequest: existing,
      });
    }

    const request = new Request({ passenger: req.user.id, route: routeId, stop: stopId });
    await request.save();
    await request.populate(['route', 'stop']);

    // Socket.io: emit to depot
    const io = req.app.get('io');
    io.to('depot').emit('new-request', request);

    // Check threshold for this stop + route
    const count = await Request.countDocuments({ stop: stopId, route: routeId, status: 'pending' });
    if (count >= THRESHOLD) {
      io.to('depot').emit('threshold-alert', {
        stopId,
        routeId,
        count,
        message: `Alert! ${count} passengers waiting at this stop for this route.`,
      });
    }

    res.status(201).json({ message: 'Request sent successfully', request });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/requests  (depot + admin)
router.get('/', authMiddleware(['depot', 'admin']), async (req, res) => {
  try {
    const { status, stopId, routeId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (stopId) filter.stop = stopId;
    if (routeId) filter.route = routeId;

    const requests = await Request.find(filter)
      .populate('passenger', 'mobile')
      .populate('route', 'routeNumber busName')
      .populate('stop', 'name lat lng')
      .sort({ createdAt: -1 });

    // Group by stop
    const grouped = requests.reduce((acc, r) => {
      const stopName = r.stop?.name || 'Unknown';
      const key = `${stopName}||${r.route?.routeNumber || '?'}`;
      if (!acc[key]) {
        acc[key] = { stop: r.stop, route: r.route, requests: [], count: 0 };
      }
      acc[key].requests.push(r);
      acc[key].count++;
      return acc;
    }, {});

    res.json({ requests, grouped: Object.values(grouped) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/requests/my  (passenger - own requests)
router.get('/my', authMiddleware(['passenger']), async (req, res) => {
  try {
    const requests = await Request.find({ passenger: req.user.id })
      .populate('route', 'routeNumber busName')
      .populate('stop', 'name lat lng')
      .sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH /api/requests/:id/send-bus  (depot only)
router.patch('/:id/send-bus', authMiddleware(['depot', 'admin']), async (req, res) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate('passenger', 'mobile')
      .populate('route', 'routeNumber busName')
      .populate('stop', 'name');

    if (!request) return res.status(404).json({ message: 'Request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request is already processed' });
    }

    request.status = 'sent';
    request.sentAt = new Date();
    await request.save();

    // Notify all passengers waiting at same stop + route
    const pendingAtStop = await Request.find({ stop: request.stop._id, route: request.route._id, status: 'pending' })
      .populate('passenger', 'mobile');

    const io = req.app.get('io');
    // Notify the specific passenger first
    io.to(`passenger:${request.passenger._id}`).emit('bus-sent', {
      requestId: request._id,
      message: 'Bus is on the way! Watch it live on the map 🚌',
      route: request.route,
      stop: request.stop,
    });
    
    // Animate bus towards passenger stop
    await dispatchBusToStop(request.stop._id);

    // Update this request to sent
    io.to('depot').emit('request-updated', { requestId: request._id, status: 'sent' });

    res.json({ message: 'Bus dispatched and passenger notified', request });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// PATCH /api/requests/send-all  (depot - send bus to all pending at a stop+route)
router.patch('/send-all', authMiddleware(['depot', 'admin']), async (req, res) => {
  try {
    const { stopId, routeId } = req.body;
    if (!stopId || !routeId) return res.status(400).json({ message: 'stopId and routeId required' });

    const pending = await Request.find({ stop: stopId, route: routeId, status: 'pending' })
      .populate('passenger route stop');

    if (pending.length === 0) return res.status(404).json({ message: 'No pending requests found' });

    await Request.updateMany({ stop: stopId, route: routeId, status: 'pending' }, { status: 'sent', sentAt: new Date() });

    const io = req.app.get('io');
    pending.forEach(r => {
      io.to(`passenger:${r.passenger._id}`).emit('bus-sent', {
        requestId: r._id,
        message: 'Bus is on the way! 🚌',
        route: r.route,
        stop: r.stop,
      });
    });

    // Animate bus towards passenger stop
    await dispatchBusToStop(stopId);

    io.to('depot').emit('bulk-updated', { stopId, routeId, count: pending.length });

    res.json({ message: `Bus dispatched for ${pending.length} passenger(s)`, count: pending.length });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;

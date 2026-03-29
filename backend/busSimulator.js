const BusStop = require('./models/BusStop');

// Create 8 simulated buses operating around Central Chennai coordinates
const ENHANCED_SPEED = 0.0004;

const simulatedBuses = Array.from({ length: 8 }).map((_, i) => ({
  id: `BUS-${i + 101}`,
  name: `TN01 ${Math.floor(1000 + Math.random() * 9000)}`,
  // Start near Chennai Central (13.0827, 80.2707) roughly
  lat: 13.05 + (Math.random() * 0.06),
  lng: 80.21 + (Math.random() * 0.06),
  targetLat: null,
  targetLng: null,
  speed: 0.0001 + (Math.random() * 0.0001),
  angle: Math.random() * Math.PI * 2,
  isDispatched: false
}));

let ioInstance = null;

function updateBuses() {
  simulatedBuses.forEach(bus => {
    if (bus.targetLat && bus.targetLng) {
      // Move strictly towards target
      const dx = bus.targetLat - bus.lat;
      const dy = bus.targetLng - bus.lng;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < bus.speed) {
        bus.lat = bus.targetLat;
        bus.lng = bus.targetLng;
        // Reached destination, relax
        bus.targetLat = null;
        bus.targetLng = null;
        bus.isDispatched = false;
        bus.speed = 0.0001; // Back to normal speed
      } else {
        bus.lat += (dx / dist) * bus.speed;
        bus.lng += (dy / dist) * bus.speed;
      }
    } else {
      // Wander randomly in a small area
      bus.angle += (Math.random() - 0.5) * 0.5;
      bus.lat += Math.cos(bus.angle) * bus.speed;
      bus.lng += Math.sin(bus.angle) * bus.speed;
    }
  });

  if (ioInstance) {
    // Broadcast live locations to everyone
    ioInstance.emit('live-buses', simulatedBuses.map(b => ({
      id: b.id, name: b.name, lat: b.lat, lng: b.lng, isDispatched: b.isDispatched
    })));
  }
}

function startSimulation(io) {
  ioInstance = io;
  // Send update every 1 second for smooth map animations
  setInterval(updateBuses, 1000);
}

async function dispatchBusToStop(stopId) {
  try {
    const stop = await BusStop.findById(stopId);
    if (stop && stop.lat && stop.lng) {
      // Find a bus that is not currently dispatched
      const freeBus = simulatedBuses.find(b => !b.isDispatched);
      if (freeBus) {
        freeBus.targetLat = stop.lat;
        freeBus.targetLng = stop.lng;
        freeBus.speed = ENHANCED_SPEED; // Move faster when dispatched!
        freeBus.isDispatched = true;
        console.log(`[Simulator] Dispatched ${freeBus.name} to coordinates ${stop.lat}, ${stop.lng}`);
      }
    }
  } catch (err) {
    console.error('Dispatch error:', err);
  }
}

module.exports = { startSimulation, dispatchBusToStop };

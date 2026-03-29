require('dotenv').config();
const mongoose = require('mongoose');
const xlsx = require('xlsx');
const Admin = require('./models/Admin');
const BusStop = require('./models/BusStop');
const BusRoute = require('./models/BusRoute');
const Request = require('./models/Request');

// Major Chennai landmark coordinates for accurate mapping
const CHENNAI_COORDINATES = {
  'K.K.NAGAR': { lat: 13.0410, lng: 80.1994 },
  'BROADWAY': { lat: 13.0891, lng: 80.2858 },
  'CENTRAL': { lat: 13.0827, lng: 80.2707 },
  'THIRUVANMIYUR': { lat: 12.9830, lng: 80.2594 },
  'ADYAR': { lat: 13.0012, lng: 80.2565 },
  'TAMBARAM': { lat: 12.9249, lng: 80.1000 },
  'GUINDY': { lat: 13.0067, lng: 80.2206 },
  'T.NAGAR': { lat: 13.0418, lng: 80.2341 },
  'ASHOK NAGAR': { lat: 13.0368, lng: 80.2144 },
  'SAIDAPET': { lat: 13.0238, lng: 80.2206 },
  'EKKATTUTHANGAL': { lat: 13.0235, lng: 80.1979 },
  'GUINDY': { lat: 13.0102, lng: 80.2157 },
  'VELACHERY': { lat: 12.9790, lng: 80.2220 },
  'BEACH': { lat: 13.0900, lng: 80.2900 },
  'THIRUVOTRIYUR': { lat: 13.1601, lng: 80.3001 },
  'THIRUVANMIYUR': { lat: 12.9860, lng: 80.2630 },
  'TAMBARAM': { lat: 12.9249, lng: 80.1170 },
  'CHROMEPET': { lat: 12.9441, lng: 80.1415 },
  'POONAMALLEE': { lat: 13.0489, lng: 80.1149 },
  'BROADWAY': { lat: 13.0874, lng: 80.2838 },
  'KOYAMBEDU': { lat: 13.0732, lng: 80.1912 },
  'PORUR': { lat: 13.0382, lng: 80.1565 },
  'REDHILLS': { lat: 13.1873, lng: 80.1636 },
  'KILAMBAKKAM': { lat: 12.8450, lng: 80.0650 },
  'AAVADI': { lat: 13.1110, lng: 80.1090 },
  'VADAPALANI': { lat: 13.0494, lng: 80.2120 }
};

function getCoord(stopName) {
  const upper = stopName.toUpperCase();
  for (const [key, coords] of Object.entries(CHENNAI_COORDINATES)) {
    if (upper.includes(key)) {
      // Add a tiny random jitter so markers don't stack exactly on top of each other
      return {
        lat: coords.lat + (Math.random() - 0.5) * 0.002,
        lng: coords.lng + (Math.random() - 0.5) * 0.002
      };
    }
  }
  // Generic Chennai fall-back coordinate if no landmark is found
  // Using central point (Anna Salai area) as default instead of purely random
  const defaultLat = 13.0500;
  const defaultLng = 80.2400;
  return {
    lat: defaultLat + (Math.random() - 0.5) * 0.1,
    lng: defaultLng + (Math.random() - 0.5) * 0.1
  };
}

async function seed() {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    await Admin.deleteMany({});
    await BusStop.deleteMany({});
    await BusRoute.deleteMany({});
    await Request.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Restore standard accounts
    await Admin.create([
      { name: 'System Admin', username: 'admin', password: 'admin123', role: 'admin' },
      { name: 'Depot Operator', username: 'depot', password: 'depot123', role: 'depot' }
    ]);

    const workbook = xlsx.readFile('bus routes.xlsx');
    let uniqueStopsSet = new Map();
    let routesList = [];

    workbook.SheetNames.forEach(sheetName => {
      console.log(`📄 Processing ${sheetName}...`);
      const worksheet = workbook.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: null });
      
      let currentRoute = 'Unknown';

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;

        // 🎯 1. Extract only REAL (non-null) values from the row
        const realValues = row.filter(v => v !== null && v !== undefined && String(v).trim().length > 0);
        if (realValues.length < 3) continue;

        // 🎯 2. Map based on the "First 4 meaningful values" pattern:
        // Pattern: [S.No (often skip), Route, From, To]
        // Often S.No is the first item. If the first item is a number and the second is alphanumeric, first is S.No.
        let routeVal, fromVal, toVal;
        
        const isNumeric = (val) => /^\d+$/.test(String(val).replace(/[\)\(]/g, ''));
        
        if (isNumeric(realValues[0]) && realValues.length >= 4) {
          routeVal = realValues[1];
          fromVal = realValues[2];
          toVal = realValues[3];
        } else if (realValues.length >= 3) {
          routeVal = realValues[0];
          fromVal = realValues[1];
          toVal = realValues[2];
        } else {
          continue;
        }

        // 🏷️ Route Number Discovery & Persistence
        const routeStr = String(routeVal).toUpperCase();
        if (routeVal && !routeStr.includes('ROUTE') && !routeStr.includes('S.NO') && !routeStr.includes('NO.')) {
           currentRoute = String(routeVal).replace(/\r?\n|\r/g, ' ').trim();
        }

        if (currentRoute === 'Unknown' || !fromVal || !toVal) continue;

        // 🧹 Sanitization
        let fromName = String(fromVal).replace(/\r?\n|\r/g, ' ').replace(/^[\)\(\d\s\.\-]+/, '').trim();
        let toName = String(toVal).replace(/\r?\n|\r/g, ' ').replace(/^[\)\(\d\s\.\-]+/, '').trim();

        // 🛑 JUNK FILTERS
        if (isNumeric(fromName) || isNumeric(toName)) continue;
        if (fromName.length < 3 || toName.length < 3) continue;
        if (fromName.toUpperCase().includes('FROM') || toName.toUpperCase().includes('TO')) continue;

        uniqueStopsSet.set(fromName, getCoord(fromName));
        uniqueStopsSet.set(toName, getCoord(toName));

        routesList.push({
          routeNumber: currentRoute,
          busName: `${fromName} ↔ ${toName}`,
          stops: [fromName, toName]
        });
      }
    });

    console.log(`🚏 Creating ${uniqueStopsSet.size} unique bus stops...`);
    const stopsDocs = [];
    for (const [name, coords] of uniqueStopsSet.entries()) {
      stopsDocs.push({
        name,
        lat: coords.lat,
        lng: coords.lng,
        address: `${name}, Chennai`
      });
    }
    const createdStops = await BusStop.insertMany(stopsDocs);
    const stopIdMap = {};
    createdStops.forEach(s => stopIdMap[s.name] = s._id);

    console.log(`🚌 Grouping and deduplicating ${routesList.length} bus route entries...`);
    const routesMap = new Map();
    routesList.forEach(r => {
      const stopIds = r.stops.map(s => stopIdMap[s]);
      if (!routesMap.has(r.routeNumber)) {
        routesMap.set(r.routeNumber, {
          routeNumber: r.routeNumber,
          busName: r.busName,
          stops: new Set(stopIds),
          description: `Official Chennai Route ${r.routeNumber}`
        });
      } else {
        const existing = routesMap.get(r.routeNumber);
        stopIds.forEach(id => existing.stops.add(id));
      }
    });

    const routesDocs = Array.from(routesMap.values()).map(r => ({
      ...r,
      stops: Array.from(r.stops)
    })).slice(0, 800); 

    await BusRoute.insertMany(routesDocs);

    console.log(`✨ DONE! Imported ${stopsDocs.length} stops and ${routesDocs.length} routes.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ SEED FAILED:', err);
    process.exit(1);
  }
}

seed();

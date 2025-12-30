# Parse Server Migration Guide

## Current Status
- ✅ Parse Server running on VPS (148.230.107.155:1337)
- ✅ Parse SDK installed in project
- ✅ parseServer.ts service created with Firebase-like API
- ✅ Backend switcher added (USE_PARSE_SERVER in constants.tsx)

## To Switch from Firebase to Parse Server:

### Step 1: Change the constant
Open `constants.tsx` and change:
```typescript
export const USE_PARSE_SERVER = false;  // Change to true
```

### Step 2: Update App.tsx logic
You need to replace Firebase calls with Parse Server calls. Here's the mapping:

**Firebase:**
```typescript
import { db } from './services/firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc } from "firebase/firestore";

onSnapshot(collection(db, "drivers"), (snap) => {
  setDrivers(snap.docs.map(d => ({ ...d.data(), id: d.id })));
});
```

**Parse Server:**
```typescript
import { subscribeToCollection, addDocument, updateDocument } from './services/parseServer';

const unsubDrivers = await subscribeToCollection('drivers', (data) => {
  setDrivers(data);
});
```

### Step 3: Create Collections in Parse Dashboard
1. Open http://148.230.107.155:4040
2. Login with: admin / FleetAdmin2025
3. Create these classes (tables):
   - `drivers` (columns: name, vehicleNo, status, phone, password, lastKnownLocation, lastSeen)
   - `jobs` (columns: driverId, origin, destination, status, tripType, startTime, endTime, distanceKm, avgSpeed, description, route, assignedAt)
   - `receipts` (columns: driverId, jobId, type, amount, description, invoiceUrl, date, status)
   - `settings` (columns: syncSpeed, updatedAt)

### Step 4: Test locally
```bash
npm run dev
```

## Why Keep Firebase for Now?
- Firebase is already working in production
- Switch to Parse when ready (just toggle one constant)
- No data migration needed yet

## Parse Server Benefits:
- ✅ Unlimited reads/writes (no Firebase quota)
- ✅ Your own VPS (full control)
- ✅ Schema-less (like Firebase)
- ✅ Real-time subscriptions (like onSnapshot)


import React, { useState, useEffect } from 'react';
import { ViewMode, Driver, Job, ReceiptEntry, JobStatus, FleetSettings, SyncSpeed, Location, TripType, AppNotification } from './types';
import { LOGO_URL, MOCK_DRIVERS, MOCK_JOBS, USE_PARSE_SERVER } from './constants';
import AdminDashboard from './components/AdminDashboard';
import DriverPortal from './components/DriverPortal';
import CustomerTracking from './components/CustomerTracking';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Login from './components/Login';
import BackendStatus from './components/BackendStatus';
import { db, isConfigured } from './services/firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, orderBy, setDoc, deleteDoc, arrayUnion } from "firebase/firestore";

const App: React.FC = () => {
  const [user, setUser] = useState<{ role: ViewMode; id?: string } | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [receipts, setReceipts] = useState<ReceiptEntry[]>([]);
  const [fleetSettings, setFleetSettings] = useState<FleetSettings>({ syncSpeed: 'MEDIUM', updatedAt: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Check for tracking ID in URL
  const urlParams = new URLSearchParams(window.location.search);
  const trackId = urlParams.get('track');

  const addNotification = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [{ id, message, type, timestamp: Date.now() }, ...prev].slice(0, 5));
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('qgo_user');
    if (savedUser) setUser(JSON.parse(savedUser));

    if (!isConfigured || !db) {
      setDrivers(MOCK_DRIVERS);
      setJobs(MOCK_JOBS);
      setIsLoading(false);
      return;
    }

    const unsubSettings = onSnapshot(doc(db, "settings", "fleet"), (snap) => {
      if (snap.exists()) setFleetSettings(snap.data() as FleetSettings);
    });

    const unsubDrivers = onSnapshot(collection(db, "drivers"), (snap) => {
      setDrivers(snap.docs.map(d => ({ ...d.data(), id: d.id } as Driver)));
      setIsLoading(false);
    });

    const unsubJobs = onSnapshot(query(collection(db, "jobs"), orderBy("assignedAt", "desc")), (snap) => {
      setJobs(snap.docs.map(d => ({ ...d.data(), id: d.id } as Job)));
    });

    const unsubReceipts = onSnapshot(query(collection(db, "receipts"), orderBy("date", "desc")), (snap) => {
      setReceipts(snap.docs.map(d => ({ ...d.data(), id: d.id } as ReceiptEntry)));
    });

    return () => { unsubSettings(); unsubDrivers(); unsubJobs(); unsubReceipts(); };
  }, []);

  const getCurrentPosition = (): Promise<Location | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ 
          lat: pos.coords.latitude, 
          lng: pos.coords.longitude, 
          speed: pos.coords.speed || 0,
          timestamp: Date.now() 
        }),
        () => resolve(null),
        { enableHighAccuracy: true }
      );
    });
  };

  // Real distance calculation (Haversine)
  const calculateDistance = (loc1: Location, loc2: Location): number => {
    const R = 6371; // km
    const dLat = (loc2.lat - loc1.lat) * Math.PI / 180;
    const dLng = (loc2.lng - loc1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(loc1.lat * Math.PI / 180) * Math.cos(loc2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // NEW: Cumulative distance based on breadcrumbs
  const calculateRouteDistance = (route: Location[]): number => {
    if (!route || route.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < route.length - 1; i++) {
      total += calculateDistance(route[i], route[i + 1]);
    }
    return parseFloat(total.toFixed(2));
  };

  const handleUpdateJobStatus = async (jobId: string, status: JobStatus) => {
    if (!db) return;
    try {
      const jobRef = doc(db, "jobs", jobId);
      const targetJob = jobs.find(j => j.id === jobId);
      if (!targetJob) return;

      const updates: any = { status };
      const now = new Date().toISOString();

      if (status === JobStatus.IN_PROGRESS) {
        const startPos = await getCurrentPosition();
        updates.startTime = now;
        if (startPos) {
          updates.startLocation = startPos;
          updates.route = [startPos];
        }
        addNotification(`Trip Started: Moving from ${targetJob.origin}`, 'success');
      }

      if (status === JobStatus.COMPLETED) {
        const endPos = await getCurrentPosition();
        updates.endTime = now;
        if (endPos) updates.endLocation = endPos;

        // Use the cumulative route data if available, fallback to straight line
        const finalRoute = [...(targetJob.route || [])];
        if (endPos) finalRoute.push(endPos);
        
        const realKm = calculateRouteDistance(finalRoute);
        updates.distanceKm = realKm;
        
        if (targetJob.startTime) {
          const startT = new Date(targetJob.startTime).getTime();
          const endT = new Date(now).getTime();
          const durationHours = (endT - startT) / (1000 * 60 * 60);
          updates.avgSpeed = durationHours > 0 ? Math.round(realKm / durationHours) : 0;
        }
        addNotification(`Delivery Finished: Arrived at ${targetJob.destination} (${realKm} KM)`, 'success');
      }

      await updateDoc(jobRef, updates);
      await updateDoc(doc(db, "drivers", targetJob.driverId), { 
        status: status === JobStatus.IN_PROGRESS ? 'ON_JOB' : 'ONLINE' 
      });
    } catch (e) { 
      addNotification('Update failed.', 'error');
      console.error(e); 
    }
  };

  const handleAddJob = async (newJob: Job) => {
    if (!db) return;
    try { 
      const { id, ...data } = newJob; 
      await addDoc(collection(db, "jobs"), data); 
      addNotification(`Job Dispatch Successful`, 'info');
    } catch (e) { 
      addNotification('Dispatch failed.', 'error');
      console.error(e); 
    }
  };

  if (isLoading) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0a0a0b] text-white">
      <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="font-black uppercase tracking-widest text-[10px]">QGO CARGO Terminal Initializing</p>
    </div>
  );

  if (trackId) return <CustomerTracking jobId={trackId} />;

  if (!user) return <Login onLogin={(role, id) => {
    const data = { role, id };
    setUser(data);
    localStorage.setItem('qgo_user', JSON.stringify(data));
  }} drivers={drivers} logoUrl={LOGO_URL} />;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 font-sans selection:bg-blue-600 selection:text-white">
      <div className="fixed top-20 right-4 z-[9999] space-y-2 w-72 pointer-events-none">
        {notifications.map(n => (
          <div key={n.id} className={`p-4 rounded-2xl shadow-2xl border backdrop-blur-md animate-in slide-in-from-right-8 pointer-events-auto ${
            n.type === 'success' ? 'bg-emerald-500/90 border-emerald-400 text-white' : 
            n.type === 'error' ? 'bg-red-500/90 border-red-400 text-white' : 
            'bg-blue-600/90 border-blue-400 text-white'
          }`}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-1">{n.type}</p>
            <p className="text-xs font-bold leading-tight">{n.message}</p>
          </div>
        ))}
      </div>

      <Navbar user={user} onLogout={() => { setUser(null); localStorage.removeItem('qgo_user'); }} logoUrl={LOGO_URL} />
      
      <BackendStatus useParseServer={USE_PARSE_SERVER} />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        {user.role === 'ADMIN' ? (
          <AdminDashboard 
            drivers={drivers} 
            jobs={jobs} 
            fuelEntries={receipts}
            fleetSettings={fleetSettings}
            onUpdateSyncSpeed={async (speed) => {
              if (!db) return;
              await updateDoc(doc(db, "settings", "fleet"), { syncSpeed: speed, updatedAt: new Date().toISOString() });
              addNotification(`Sync mode set to ${speed}`, 'info');
            }}
            onAddJob={handleAddJob}
            onAddDriver={async (d) => { if (!db) return; await setDoc(doc(db, "drivers", d.id), d); addNotification('Driver Registered'); }}
            onUpdateDriver={async (d) => { if (!db) return; await updateDoc(doc(db, "drivers", d.id), { ...d }); }}
            onDeleteDriver={async (id) => { if (!db) return; await deleteDoc(doc(db, "drivers", id)); addNotification('Driver Removed', 'error'); }}
            addNotification={addNotification}
          />
        ) : (
          <DriverPortal 
            driver={drivers.find(d => d.id === user.id) || MOCK_DRIVERS[0]} 
            jobs={jobs.filter(j => j.driverId === user.id)}
            fleetSettings={fleetSettings}
            onUpdateJobStatus={handleUpdateJobStatus}
            onLogFuel={async (entry) => { 
              if (!db) return; 
              await addDoc(collection(db, "receipts"), entry); 
              addNotification('Financial Record Submitted', 'success');
            }}
          />
        )}
      </main>
      <Footer />
    </div>
  );
};

export default App;

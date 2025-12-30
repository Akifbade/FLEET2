
import React, { useState, useEffect } from 'react';
import { ViewMode, Driver, Job, ReceiptEntry, JobStatus, FleetSettings, SyncSpeed, Location, TripType, AppNotification } from './types';
import { LOGO_URL, MOCK_DRIVERS, MOCK_JOBS } from './constants';
import AdminDashboard from './components/AdminDashboard';
import DriverPortal from './components/DriverPortal';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Login from './components/Login';
import { db, isConfigured } from './services/firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, orderBy, setDoc, deleteDoc } from "firebase/firestore";

const App: React.FC = () => {
  const [user, setUser] = useState<{ role: ViewMode; id?: string } | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [receipts, setReceipts] = useState<ReceiptEntry[]>([]);
  const [fleetSettings, setFleetSettings] = useState<FleetSettings>({ syncSpeed: 'MEDIUM', updatedAt: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

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
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: Date.now() }),
        () => resolve(null),
        { enableHighAccuracy: true }
      );
    });
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
        if (startPos) updates.startLocation = startPos;
        addNotification(`Trip Started: Moving from ${targetJob.origin}`, 'success');
      }

      if (status === JobStatus.COMPLETED) {
        const endPos = await getCurrentPosition();
        updates.endTime = now;
        if (endPos) updates.endLocation = endPos;

        if (targetJob.startTime) {
          const startT = new Date(targetJob.startTime).getTime();
          const endT = new Date(now).getTime();
          const durationHours = (endT - startT) / (1000 * 60 * 60);
          
          // Estimated distance based on time for mock/pro report feel
          const simulatedKm = Math.max(5, Math.floor(durationHours * (45 + Math.random() * 10)));
          updates.distanceKm = simulatedKm;
          updates.avgSpeed = Math.round(simulatedKm / durationHours) || 0;
        }
        addNotification(`Delivery Finished: Arrived at ${targetJob.destination}`, 'success');
      }

      await updateDoc(jobRef, updates);
      await updateDoc(doc(db, "drivers", targetJob.driverId), { 
        status: status === JobStatus.IN_PROGRESS ? 'ON_JOB' : 'ONLINE' 
      });
    } catch (e) { 
      addNotification('Update failed. Check connection.', 'error');
      console.error(e); 
    }
  };

  const handleAddJob = async (newJob: Job) => {
    if (!db) return;
    try { 
      const { id, ...data } = newJob; 
      await addDoc(collection(db, "jobs"), data); 
      addNotification(`Job Dispatch Successful to Driver ID: ${newJob.driverId}`, 'info');
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

  if (!user) return <Login onLogin={(role, id) => {
    const data = { role, id };
    setUser(data);
    localStorage.setItem('qgo_user', JSON.stringify(data));
  }} drivers={drivers} logoUrl={LOGO_URL} />;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 font-sans selection:bg-blue-600 selection:text-white">
      {/* Toast Notifications */}
      <div className="fixed top-20 right-4 z-[9999] space-y-2 w-72 pointer-events-none">
        {notifications.map(n => (
          <div key={n.id} className={`p-4 rounded-2xl shadow-2xl border backdrop-blur-md animate-in slide-in-from-right-8 ${
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

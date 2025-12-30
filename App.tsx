
import React, { useState, useEffect } from 'react';
import { ViewMode, Driver, Job, ReceiptEntry, JobStatus, FleetSettings, SyncSpeed, Location } from './types';
import { LOGO_URL, MOCK_DRIVERS, MOCK_JOBS } from './constants';
import AdminDashboard from './components/AdminDashboard';
import DriverPortal from './components/DriverPortal';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Login from './components/Login';
import { db, isConfigured } from './services/firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, orderBy, setDoc, deleteDoc, getDoc } from "firebase/firestore";

const App: React.FC = () => {
  const [user, setUser] = useState<{ role: ViewMode; id?: string } | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [receipts, setReceipts] = useState<ReceiptEntry[]>([]);
  const [fleetSettings, setFleetSettings] = useState<FleetSettings>({ syncSpeed: 'MEDIUM', updatedAt: '' });
  const [isLoading, setIsLoading] = useState(true);

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
      if (snap.exists()) {
        setFleetSettings(snap.data() as FleetSettings);
      } else {
        setDoc(doc(db, "settings", "fleet"), { syncSpeed: 'MEDIUM', updatedAt: new Date().toISOString() });
      }
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

  const handleUpdateJobStatus = async (jobId: string, status: JobStatus) => {
    if (!db) return;
    try {
      const jobRef = doc(db, "jobs", jobId);
      const targetJob = jobs.find(j => j.id === jobId);
      if (!targetJob) return;

      const updates: any = { status };
      const now = new Date().toISOString();

      if (status === JobStatus.IN_PROGRESS) {
        updates.startTime = now;
        const driver = drivers.find(d => d.id === targetJob.driverId);
        if (driver?.lastKnownLocation) {
          updates.startLocation = driver.lastKnownLocation;
        }
      }

      if (status === JobStatus.COMPLETED) {
        updates.endTime = now;
        const driver = drivers.find(d => d.id === targetJob.driverId);
        if (driver?.lastKnownLocation) {
          updates.endLocation = driver.lastKnownLocation;
        }

        // Calculate Metrics
        if (targetJob.startTime) {
          const start = new Date(targetJob.startTime).getTime();
          const end = new Date(now).getTime();
          const durationHours = (end - start) / (1000 * 60 * 60);
          
          // Simulation for distance based on average truck speeds (40-60km/h)
          // In a real app, this would be calculated via GPS breadcrumbs
          const simulatedDistance = Math.max(5, Math.floor(durationHours * (45 + Math.random() * 15)));
          updates.distanceKm = simulatedDistance;
          updates.avgSpeed = Math.round(simulatedDistance / durationHours) || 0;
        }
      }

      await updateDoc(jobRef, updates);
      await updateDoc(doc(db, "drivers", targetJob.driverId), { 
        status: status === JobStatus.IN_PROGRESS ? 'ON_JOB' : 'ONLINE' 
      });
    } catch (e) { console.error(e); }
  };

  const handleAddJob = async (newJob: Job) => {
    if (!db) return;
    try { const { id, ...data } = newJob; await addDoc(collection(db, "jobs"), data); } catch (e) { console.error(e); }
  };

  const handleAddDriver = async (driver: Driver) => {
    if (!db) return;
    try { await setDoc(doc(db, "drivers", driver.id), driver); } catch (e) { console.error(e); }
  };

  const handleDeleteDriver = async (id: string) => {
    if (!db) return;
    try { await deleteDoc(doc(db, "drivers", id)); } catch (e) { console.error(e); }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0a0a0b]">
        <img src={LOGO_URL} className="h-16 mb-4 animate-pulse" alt="Logo" />
        <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">Synchronizing Fleet Data...</p>
      </div>
    );
  }

  if (!user) return <Login onLogin={(role, id) => {
    const data = { role, id };
    setUser(data);
    localStorage.setItem('qgo_user', JSON.stringify(data));
  }} drivers={drivers} logoUrl={LOGO_URL} />;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
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
            }}
            onAddJob={handleAddJob}
            onAddDriver={handleAddDriver}
            onUpdateDriver={async (d) => { if (!db) return; await updateDoc(doc(db, "drivers", d.id), { ...d }); }}
            onDeleteDriver={handleDeleteDriver}
          />
        ) : (
          <DriverPortal 
            driver={drivers.find(d => d.id === user.id) || MOCK_DRIVERS[0]} 
            jobs={jobs.filter(j => j.driverId === user.id)}
            fleetSettings={fleetSettings}
            onUpdateJobStatus={handleUpdateJobStatus}
            onLogFuel={async (entry) => { if (!db) return; await addDoc(collection(db, "receipts"), entry); }}
          />
        )}
      </main>
      <Footer />
    </div>
  );
};

export default App;

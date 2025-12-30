import React, { useState, useEffect } from 'react';
import { ViewMode, Driver, Job, ReceiptEntry, JobStatus, FleetSettings, SyncSpeed } from './types';
import { LOGO_URL, MOCK_DRIVERS, MOCK_JOBS } from './constants';
import AdminDashboard from './components/AdminDashboard';
import DriverPortal from './components/DriverPortal';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Login from './components/Login';
import { db, isConfigured } from './services/firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, orderBy, getDoc, setDoc, deleteDoc } from "firebase/firestore";

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

    // Sync Fleet Settings
    const unsubSettings = onSnapshot(doc(db, "settings", "fleet"), (snap) => {
      if (snap.exists()) {
        setFleetSettings(snap.data() as FleetSettings);
      } else {
        setDoc(doc(db, "settings", "fleet"), { syncSpeed: 'MEDIUM', updatedAt: new Date().toISOString() });
      }
    });

    const unsubDrivers = onSnapshot(collection(db, "drivers"), 
      (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Driver));
        setDrivers(docs);
        // Turn off loader once we have initial data
        setIsLoading(false);
      },
      (err) => {
        console.error("Firestore Driver Sync Error:", err);
        setIsLoading(false);
      }
    );

    const unsubJobs = onSnapshot(query(collection(db, "jobs"), orderBy("assignedAt", "desc")), 
      (snap) => setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Job)))
    );

    const unsubReceipts = onSnapshot(query(collection(db, "receipts"), orderBy("date", "desc")), 
      (snap) => setReceipts(snap.docs.map(d => ({ id: d.id, ...d.data() } as ReceiptEntry)))
    );

    return () => { unsubSettings(); unsubDrivers(); unsubJobs(); unsubReceipts(); };
  }, []);

  const handleUpdateSyncSpeed = async (speed: SyncSpeed) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, "settings", "fleet"), {
        syncSpeed: speed,
        updatedAt: new Date().toISOString()
      });
    } catch (e) { console.error(e); }
  };

  const handleLogin = (role: ViewMode, id?: string) => {
    const userData = { role, id };
    setUser(userData);
    localStorage.setItem('qgo_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('qgo_user');
  };

  const handleAddJob = async (newJob: Job) => {
    if (!db) return;
    try { await addDoc(collection(db, "jobs"), newJob); } 
    catch (e) { console.error(e); }
  };

  const handleAddDriver = async (newDriver: Driver) => {
    if (!db) return;
    try { await setDoc(doc(db, "drivers", newDriver.id), newDriver); } 
    catch (e) { console.error(e); }
  };

  const handleUpdateDriver = async (updatedDriver: Driver) => {
    if (!db) return;
    try { await updateDoc(doc(db, "drivers", updatedDriver.id), { ...updatedDriver }); } 
    catch (e) { console.error(e); }
  };

  const handleDeleteDriver = async (driverId: string) => {
    if (!db) return;
    try { await deleteDoc(doc(db, "drivers", driverId)); } 
    catch (e) { console.error(e); }
  };

  const handleUpdateJobStatus = async (jobId: string, status: JobStatus) => {
    if (!db) return;
    try {
      const jobRef = doc(db, "jobs", jobId);
      const updates: any = { status };
      const targetJob = jobs.find(j => j.id === jobId);
      if (!targetJob) return;

      if (status === JobStatus.IN_PROGRESS) updates.startTime = new Date().toISOString();
      if (status === JobStatus.COMPLETED) updates.endTime = new Date().toISOString();

      await updateDoc(jobRef, updates);
      await updateDoc(doc(db, "drivers", targetJob.driverId), { 
        status: status === JobStatus.IN_PROGRESS ? 'ON_JOB' : 'ONLINE' 
      });
    } catch (e) { console.error(e); }
  };

  const handleLogReceipt = async (entry: ReceiptEntry) => {
    if (!db) return;
    try { await addDoc(collection(db, "receipts"), entry); } 
    catch (e) { console.error(e); }
  };

  // Show a loading screen until the app checks for existing login and drivers
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0a0a0b]">
        <img src={LOGO_URL} className="h-16 mb-4 animate-pulse" alt="Logo" />
        <div className="w-48 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 animate-[loading_1.5s_infinite]"></div>
        </div>
        <p className="mt-4 text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">Connecting to Cloud...</p>
      </div>
    );
  }

  if (!user) return <Login onLogin={handleLogin} drivers={drivers} logoUrl={LOGO_URL} />;

  // Find the current logged in driver if applicable
  const currentDriver = user.role === 'DRIVER' ? drivers.find(d => d.id === user.id) : null;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={handleLogout} logoUrl={LOGO_URL} />
      <main className="flex-grow container mx-auto px-4 py-8">
        {user.role === 'ADMIN' ? (
          <AdminDashboard 
            drivers={drivers} 
            jobs={jobs} 
            fuelEntries={receipts}
            fleetSettings={fleetSettings}
            onUpdateSyncSpeed={handleUpdateSyncSpeed}
            onAddJob={handleAddJob}
            onAddDriver={handleAddDriver}
            onUpdateDriver={handleUpdateDriver}
            onDeleteDriver={handleDeleteDriver}
          />
        ) : (
          // Only render DriverPortal if the driver data exists in the fetched list
          currentDriver ? (
            <DriverPortal 
              driver={currentDriver} 
              jobs={jobs.filter(j => j.driverId === user.id)}
              fleetSettings={fleetSettings}
              onUpdateJobStatus={handleUpdateJobStatus}
              onLogFuel={handleLogReceipt}
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
               <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-3xl"><i className="fas fa-user-slash"></i></div>
               <h2 className="font-black text-gray-900 uppercase tracking-tight">Driver Not Found</h2>
               <p className="text-gray-500 text-sm max-w-xs">Your driver account might have been deleted from the terminal. Please contact the Fleet Manager.</p>
               <button onClick={handleLogout} className="text-blue-600 font-black text-xs uppercase tracking-widest bg-blue-50 px-6 py-3 rounded-xl border border-blue-100">Return to Login</button>
            </div>
          )
        )}
      </main>
      <Footer />
    </div>
  );
};

export default App;
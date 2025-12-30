import React, { useState, useEffect } from 'react';
import { ViewMode, Driver, Job, ReceiptEntry, JobStatus } from './types';
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRulesHelper, setShowRulesHelper] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('qgo_user');
    if (savedUser) setUser(JSON.parse(savedUser));

    if (!isConfigured || !db) {
      setDrivers(MOCK_DRIVERS);
      setJobs(MOCK_JOBS);
      setIsLoading(false);
      return;
    }

    const handleError = (err: any) => {
      console.error("Firebase Sync Error:", err);
      if (err.code === 'permission-denied') {
        setError("Firebase Permission Denied");
        setShowRulesHelper(true);
      }
    };

    const unsubDrivers = onSnapshot(collection(db, "drivers"), 
      (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Driver));
        setDrivers(docs);
        setError(null);
      },
      handleError
    );

    const unsubJobs = onSnapshot(query(collection(db, "jobs"), orderBy("assignedAt", "desc")), 
      (snap) => setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Job))),
      handleError
    );

    const unsubReceipts = onSnapshot(query(collection(db, "receipts"), orderBy("date", "desc")), 
      (snap) => setReceipts(snap.docs.map(d => ({ id: d.id, ...d.data() } as ReceiptEntry))),
      handleError
    );

    setIsLoading(false);
    return () => { unsubDrivers(); unsubJobs(); unsubReceipts(); };
  }, []);

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
    try {
      await setDoc(doc(db, "drivers", newDriver.id), newDriver);
    } catch (e) { console.error(e); }
  };

  const handleUpdateDriver = async (updatedDriver: Driver) => {
    if (!db) return;
    try {
      const driverRef = doc(db, "drivers", updatedDriver.id);
      await updateDoc(driverRef, { ...updatedDriver });
    } catch (e) { console.error(e); }
  };

  const handleDeleteDriver = async (driverId: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, "drivers", driverId));
    } catch (e) { console.error(e); }
  };

  const handleUpdateJobStatus = async (jobId: string, status: JobStatus) => {
    if (!db) return;
    try {
      const jobRef = doc(db, "jobs", jobId);
      const updates: any = { status };
      
      const targetJob = jobs.find(j => j.id === jobId);
      if (!targetJob) return;

      if (status === JobStatus.IN_PROGRESS) {
        updates.startTime = new Date().toISOString();
      }
      
      if (status === JobStatus.COMPLETED) {
        updates.endTime = new Date().toISOString();
        const driverRef = doc(db, "drivers", targetJob.driverId);
        const driverSnap = await getDoc(driverRef);
        if (driverSnap.exists()) {
          const driverData = driverSnap.data() as Driver;
          if (driverData.lastKnownLocation) {
            updates.currentLocation = driverData.lastKnownLocation;
          }
        }
      }

      await updateDoc(jobRef, updates);

      if (targetJob.driverId) {
        await updateDoc(doc(db, "drivers", targetJob.driverId), { 
          status: status === JobStatus.IN_PROGRESS ? 'ON_JOB' : 'ONLINE' 
        });
      }
    } catch (e) { console.error(e); }
  };

  const handleLogReceipt = async (entry: ReceiptEntry) => {
    if (!db) return;
    try { await addDoc(collection(db, "receipts"), entry); } 
    catch (e) { console.error(e); }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0a0a0b]">
        <img src={LOGO_URL} className="h-16 mb-4 animate-pulse" alt="Logo" />
        <div className="w-48 h-1 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-600 animate-[loading_1.5s_infinite]"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} drivers={drivers} logoUrl={LOGO_URL} />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={handleLogout} logoUrl={LOGO_URL} />
      
      {error && (
        <div className="bg-red-600 text-white p-3 flex items-center justify-center space-x-4">
          <span className="text-xs font-black uppercase tracking-widest">
            <i className="fas fa-exclamation-triangle mr-2"></i>
            {error}
          </span>
          <button onClick={() => setShowRulesHelper(true)} className="bg-white text-red-600 px-3 py-1 rounded font-black text-[10px] uppercase">
            Fix Connection
          </button>
        </div>
      )}

      {showRulesHelper && (
        <div className="fixed inset-0 bg-gray-900/95 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-8 bg-blue-600 text-white flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black uppercase">Database Locked</h3>
                <p className="text-blue-100 text-xs font-bold">Update your Firestore rules to allow the app to sync.</p>
              </div>
              <button onClick={() => setShowRulesHelper(false)} className="text-white/50 hover:text-white"><i className="fas fa-times text-xl"></i></button>
            </div>
            <div className="p-8 space-y-4">
              <p className="text-sm font-bold text-gray-600">Paste this in your Firebase Console &gt; Firestore &gt; Rules:</p>
              <pre className="bg-gray-100 p-4 rounded-xl font-mono text-xs text-blue-800">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}
              </pre>
            </div>
          </div>
        </div>
      )}

      <main className="flex-grow container mx-auto px-4 py-8">
        {user.role === 'ADMIN' ? (
          <AdminDashboard 
            drivers={drivers} 
            jobs={jobs} 
            fuelEntries={receipts} 
            onAddJob={handleAddJob}
            onAddDriver={handleAddDriver}
            onUpdateDriver={handleUpdateDriver}
            onDeleteDriver={handleDeleteDriver}
          />
        ) : (
          <DriverPortal 
            driver={drivers.find(d => d.id === user.id) || drivers[0]} 
            jobs={jobs.filter(j => j.driverId === user.id)}
            onUpdateJobStatus={handleUpdateJobStatus}
            onLogFuel={handleLogReceipt}
          />
        )}
      </main>

      <Footer />
    </div>
  );
};

export default App;
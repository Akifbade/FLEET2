
import React, { useState, useEffect, useRef } from 'react';
import { Driver, Job, ReceiptEntry, JobStatus, ReceiptType, FleetSettings } from '../types';
import { db, fileToBase64 } from '../services/firebase';
import { doc, updateDoc } from "firebase/firestore";

interface DriverPortalProps {
  driver: Driver;
  jobs: Job[];
  fleetSettings: FleetSettings;
  onUpdateJobStatus: (jobId: string, status: JobStatus) => void;
  onLogFuel: (entry: ReceiptEntry) => void;
}

const DriverPortal: React.FC<DriverPortalProps> = ({ driver, jobs, fleetSettings, onUpdateJobStatus, onLogFuel }) => {
  const [showLogForm, setShowLogForm] = useState(false);
  const [logType, setLogType] = useState<ReceiptType>('FUEL');
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const geoWatchId = useRef<number | null>(null);
  const lastSyncTimestamp = useRef<number>(0);

  const getSyncCooldown = () => {
    switch(fleetSettings.syncSpeed) {
      case 'FAST': return 5000;
      case 'MEDIUM': return 15000;
      case 'SLOW': return 60000;
      default: return 15000;
    }
  };

  const activeJob = jobs.find(j => j.status === JobStatus.IN_PROGRESS);
  const pendingJobs = jobs.filter(j => j.status === JobStatus.PENDING);

  const handleStartTrip = async (jobId: string) => {
    setBusyJobId(jobId);
    try {
      await onUpdateJobStatus(jobId, JobStatus.IN_PROGRESS);
    } finally {
      setBusyJobId(null);
    }
  };

  const handleFinishTrip = async (jobId: string) => {
    setBusyJobId(jobId);
    try {
      await onUpdateJobStatus(jobId, JobStatus.COMPLETED);
    } finally {
      setBusyJobId(null);
    }
  };

  const handleManualSync = () => {
    if (!("geolocation" in navigator)) return;
    setIsSyncing(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          await updateDoc(doc(db, "drivers", driver.id), {
            lastKnownLocation: { lat: latitude, lng: longitude, timestamp: Date.now() }
          });
          lastSyncTimestamp.current = Date.now();
        } catch (e) { console.error(e); }
        finally { setIsSyncing(false); }
      },
      () => setIsSyncing(false),
      { enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    if ("geolocation" in navigator && activeJob) {
      geoWatchId.current = navigator.geolocation.watchPosition(
        async (position) => {
          const now = Date.now();
          const cooldown = getSyncCooldown();
          if (now - lastSyncTimestamp.current > cooldown) {
            const { latitude, longitude } = position.coords;
            try {
              await updateDoc(doc(db, "drivers", driver.id), {
                lastKnownLocation: { lat: latitude, lng: longitude, timestamp: now }
              });
              lastSyncTimestamp.current = now;
            } catch (e) { console.error(e); }
          }
        },
        null,
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
      );
    }
    return () => { if (geoWatchId.current) navigator.geolocation.clearWatch(geoWatchId.current); };
  }, [driver.id, fleetSettings.syncSpeed, activeJob]);

  const handleLogSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    const formData = new FormData(e.currentTarget);
    const fileInput = document.getElementById('receipt-upload') as HTMLInputElement;
    let base64Image = '';
    if (fileInput.files && fileInput.files[0]) base64Image = await fileToBase64(fileInput.files[0]);

    onLogFuel({
      id: `R${Date.now()}`,
      driverId: driver.id,
      jobId: activeJob?.id || 'NO_JOB',
      type: logType,
      amount: Number(formData.get('amount')),
      description: formData.get('description') as string,
      invoiceUrl: base64Image,
      date: new Date().toISOString(),
      status: 'PENDING',
    });
    setIsUploading(false);
    setShowLogForm(false);
  };

  return (
    <div className="max-w-md mx-auto space-y-6 pb-24 px-2">
      <div className="bg-gradient-to-br from-blue-700 to-indigo-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-3xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl border border-white/30"><i className="fas fa-truck-fast"></i></div>
              <div>
                <h2 className="text-2xl font-black tracking-tight">{driver.name}</h2>
                <p className="text-blue-200 text-xs font-black uppercase tracking-widest">{driver.vehicleNo}</p>
              </div>
            </div>
            <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${activeJob ? 'bg-orange-500 animate-pulse' : 'bg-green-500'}`}></div>
          </div>
          <button onClick={handleManualSync} disabled={isSyncing} className="w-full bg-white/10 hover:bg-white/20 border border-white/20 py-4 rounded-2xl flex items-center justify-center space-x-3 active:scale-95 disabled:opacity-50 transition-all">
            <i className={`fas ${isSyncing ? 'fa-circle-notch fa-spin' : 'fa-location-crosshairs'}`}></i>
            <span className="font-black text-[11px] uppercase tracking-wider">Update Location</span>
          </button>
          <div className="flex justify-between items-center mt-4 px-2">
             <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                  Sync: {fleetSettings.syncSpeed}
                </span>
             </div>
             <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest">
               Last: {driver.lastKnownLocation ? new Date(driver.lastKnownLocation.timestamp || 0).toLocaleTimeString() : '---'}
             </p>
          </div>
        </div>
      </div>

      {pendingJobs.length > 0 && !activeJob && (
        <div className="space-y-4">
           <div className="flex items-center space-x-2 px-4">
              <i className="fas fa-bell text-orange-500 text-xs"></i>
              <h3 className="font-black text-[10px] uppercase text-gray-400 tracking-widest">New Assignments ({pendingJobs.length})</h3>
           </div>
           {pendingJobs.map(job => (
             <div key={job.id} className="bg-white rounded-[2.5rem] p-8 border-2 border-orange-100 shadow-xl space-y-6">
               <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-1">Dispatch Alert</p>
                    <h4 className="font-black text-gray-900 text-xl">{job.origin} → {job.destination}</h4>
                  </div>
               </div>
               <button 
                onClick={() => handleStartTrip(job.id)}
                disabled={busyJobId === job.id}
                className="w-full bg-gray-900 text-white py-6 rounded-2xl font-black uppercase tracking-widest shadow-2xl active:scale-95 transition flex items-center justify-center space-x-3 disabled:bg-gray-400"
               >
                 {busyJobId === job.id ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-play text-xs text-orange-500"></i>}
                 <span>{busyJobId === job.id ? 'Processing...' : 'Start Delivery Trip'}</span>
               </button>
             </div>
           ))}
        </div>
      )}

      {activeJob && (
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 p-8 space-y-6">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-[11px] font-black uppercase text-blue-600 tracking-[0.2em]">Live Trip tracking</h4>
          </div>
          <div className="bg-gray-50 rounded-3xl p-6 flex items-center justify-between border border-gray-100 relative text-center">
            <div className="flex-1"><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">From</p><p className="font-black text-gray-900">{activeJob.origin}</p></div>
            <div className="px-2"><i className="fas fa-truck-moving text-blue-200"></i></div>
            <div className="flex-1"><p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">To</p><p className="font-black text-gray-900">{activeJob.destination}</p></div>
          </div>
          <button 
            onClick={() => handleFinishTrip(activeJob.id)} 
            disabled={busyJobId === activeJob.id}
            className="w-full bg-red-600 text-white py-6 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center space-x-3 active:scale-95 transition disabled:bg-red-400"
          >
             {busyJobId === activeJob.id ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-flag-checkered text-xl"></i>}
             <span>{busyJobId === activeJob.id ? 'Processing...' : 'Finish Delivery'}</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => { setLogType('FUEL'); setShowLogForm(true); }} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col items-center space-y-4 active:scale-95 transition group">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center text-2xl"><i className="fas fa-gas-pump"></i></div>
          <span className="font-black text-[11px] uppercase tracking-widest text-gray-700">Fuel Entry</span>
        </button>
        <button onClick={() => { setLogType('MAINTENANCE'); setShowLogForm(true); }} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col items-center space-y-4 active:scale-95 transition group">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl"><i className="fas fa-toolbox"></i></div>
          <span className="font-black text-[11px] uppercase tracking-widest text-gray-700">Repair Log</span>
        </button>
      </div>

      {!activeJob && pendingJobs.length === 0 && (
        <div className="bg-white rounded-[2.5rem] border-4 border-dashed border-gray-100 p-12 text-center text-gray-300">
          <i className="fas fa-map-location-dot text-4xl mb-4"></i>
          <h4 className="font-black uppercase text-[10px] tracking-widest">No Active Tasks</h4>
        </div>
      )}

      {showLogForm && (
        <div className="fixed inset-0 bg-gray-900/90 backdrop-blur-md z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-[3rem] sm:rounded-[3rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-black text-gray-900 uppercase tracking-tight text-lg">Log {logType}</h3>
              <button onClick={() => setShowLogForm(false)} className="text-gray-300 hover:text-red-500 transition text-3xl"><i className="fas fa-circle-xmark"></i></button>
            </div>
            <form onSubmit={handleLogSubmit} className="p-8 space-y-6">
              <div className="bg-gray-50 rounded-3xl p-5 border border-gray-100">
                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Amount (₹)</label>
                <input name="amount" type="number" required placeholder="0.00" className="w-full bg-transparent font-black text-2xl outline-none" />
              </div>
              <div className="bg-blue-50 border-4 border-dashed border-blue-100 rounded-[2rem] p-8 text-center relative group">
                <input type="file" className="hidden" id="receipt-upload" accept="image/*" capture="environment" required />
                <label htmlFor="receipt-upload" className="cursor-pointer flex flex-col items-center">
                  <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-3 shadow-xl"><i className="fas fa-camera text-xl"></i></div>
                  <p className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Snapshot Invoice</p>
                </label>
              </div>
              <button type="submit" disabled={isUploading} className="w-full bg-gray-900 text-white py-6 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center space-x-3">
                {isUploading ? <><i className="fas fa-circle-notch fa-spin"></i><span>Uploading...</span></> : 'Submit Ledger'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverPortal;

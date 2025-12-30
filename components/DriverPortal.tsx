
import React, { useState, useEffect, useRef } from 'react';
import { Driver, Job, ReceiptEntry, JobStatus, ReceiptType, FleetSettings, Location } from '../types';
import { db, fileToBase64 } from '../services/firebase';
import { doc, updateDoc, arrayUnion } from "firebase/firestore";

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
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const geoWatchId = useRef<number | null>(null);
  const lastSyncTimestamp = useRef<number>(0);

  const activeJob = jobs.find(j => j.status === JobStatus.IN_PROGRESS);
  const pendingJobs = jobs.filter(j => j.status === JobStatus.PENDING);

  const getSyncCooldown = () => {
    switch(fleetSettings.syncSpeed) {
      case 'FAST': return 5000;
      case 'MEDIUM': return 15000;
      case 'SLOW': return 60000;
      default: return 15000;
    }
  };

  const updateLocationInDB = async (pos: GeolocationPosition) => {
    try {
      const loc: Location = { 
        lat: pos.coords.latitude, 
        lng: pos.coords.longitude, 
        speed: pos.coords.speed || 0,
        timestamp: Date.now() 
      };

      // Update Driver's Last Known Location
      await updateDoc(doc(db, "drivers", driver.id), {
        lastKnownLocation: loc
      });

      // If on a job, append to route breadcrumbs
      if (activeJob) {
        await updateDoc(doc(db, "jobs", activeJob.id), {
          route: arrayUnion(loc)
        });
      }
      
      lastSyncTimestamp.current = Date.now();
    } catch (e) { console.error("Sync Failure:", e); }
  };

  useEffect(() => {
    if ("geolocation" in navigator && activeJob) {
      geoWatchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          const now = Date.now();
          if (now - lastSyncTimestamp.current > getSyncCooldown()) {
            updateLocationInDB(pos);
          }
        },
        null,
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
      );
    } else {
      if (geoWatchId.current) {
        navigator.geolocation.clearWatch(geoWatchId.current);
        geoWatchId.current = null;
      }
    }
    return () => { if (geoWatchId.current) navigator.geolocation.clearWatch(geoWatchId.current); };
  }, [activeJob, fleetSettings.syncSpeed]);

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
      jobId: activeJob?.id || 'OFF_DUTY',
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
    <div className="max-w-md mx-auto space-y-6 pb-24">
      {/* Status HUD */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-600/20 flex items-center justify-center text-2xl text-blue-400"><i className="fas fa-id-card"></i></div>
              <div>
                <h2 className="text-xl font-black tracking-tighter uppercase">{driver.name}</h2>
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{driver.vehicleNo}</p>
              </div>
            </div>
            <div className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-[0.2em] border ${activeJob ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 animate-pulse' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
              {activeJob ? 'Duty Live' : 'Standing By'}
            </div>
          </div>
        </div>
      </div>

      {/* Pending Jobs */}
      {pendingJobs.length > 0 && !activeJob && (
        <div className="space-y-4">
           {pendingJobs.map(job => (
             <div key={job.id} className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-xl space-y-6">
               <h4 className="font-black text-gray-900 text-xl leading-tight">{job.origin} <i className="fas fa-arrow-right text-gray-300 mx-1"></i> {job.destination}</h4>
               <button onClick={() => onUpdateJobStatus(job.id, JobStatus.IN_PROGRESS)} className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black uppercase tracking-widest shadow-2xl active:scale-95 transition">Accept & Start Trip</button>
             </div>
           ))}
        </div>
      )}

      {/* Active Job Duty Card */}
      {activeJob && (
        <div className="bg-white rounded-[2.5rem] shadow-2xl border-2 border-emerald-50 p-8 space-y-6">
          <div className="flex justify-between items-center">
            <h4 className="text-[11px] font-black uppercase text-emerald-600 tracking-[0.2em]">GPS Telemetry Active</h4>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          </div>
          <div className="bg-slate-900 rounded-[2rem] p-6 text-white text-center">
             <p className="font-black text-sm">{activeJob.origin} → {activeJob.destination}</p>
          </div>
          <button onClick={() => onUpdateJobStatus(activeJob.id, JobStatus.COMPLETED)} className="w-full bg-rose-600 text-white py-6 rounded-2xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center space-x-3 active:scale-95 transition">
             <i className="fas fa-flag-checkered"></i>
             <span>Finish Delivery</span>
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => { setLogType('FUEL'); setShowLogForm(true); }} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col items-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center text-xl shadow-sm"><i className="fas fa-gas-pump"></i></div>
          <span className="font-black text-[10px] uppercase tracking-widest text-gray-500">Fuel Log</span>
        </button>
        <button onClick={() => { setLogType('MAINTENANCE'); setShowLogForm(true); }} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col items-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shadow-sm"><i className="fas fa-screwdriver-wrench"></i></div>
          <span className="font-black text-[10px] uppercase tracking-widest text-gray-500">Maint Log</span>
        </button>
      </div>

      {/* Log Modal */}
      {showLogForm && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-[3rem] sm:rounded-[3rem] overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-black text-gray-900 uppercase tracking-widest text-lg">Record {logType}</h3>
              <button onClick={() => setShowLogForm(false)} className="text-gray-300 hover:text-rose-500 transition text-3xl"><i className="fas fa-times-circle"></i></button>
            </div>
            <form onSubmit={handleLogSubmit} className="p-8 space-y-6">
              <input name="amount" type="number" required placeholder="Amount (KWD)" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-5 text-lg font-black outline-none" />
              <input name="description" placeholder="Supplier / Description" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-5 text-sm font-bold outline-none" />
              <div className="border-4 border-dashed border-blue-50 rounded-[2rem] p-10 text-center bg-blue-50/20">
                <input type="file" className="hidden" id="receipt-upload" accept="image/*" capture="environment" required />
                <label htmlFor="receipt-upload" className="cursor-pointer flex flex-col items-center">
                  <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-4 shadow-xl"><i className="fas fa-camera text-2xl"></i></div>
                  <p className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Capture Physical Bill</p>
                </label>
              </div>
              <button type="submit" disabled={isUploading} className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black uppercase tracking-widest">
                {isUploading ? 'Processing...' : 'Submit Proof'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverPortal;

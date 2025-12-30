
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

  const handleStartTrip = async (jobId: string) => {
    setBusyJobId(jobId);
    try { await onUpdateJobStatus(jobId, JobStatus.IN_PROGRESS); } 
    finally { setBusyJobId(null); }
  };

  const handleFinishTrip = async (jobId: string) => {
    setBusyJobId(jobId);
    try { await onUpdateJobStatus(jobId, JobStatus.COMPLETED); } 
    finally { setBusyJobId(null); }
  };

  const updateLocationInDB = async (lat: number, lng: number) => {
    try {
      await updateDoc(doc(db, "drivers", driver.id), {
        lastKnownLocation: { lat, lng, timestamp: Date.now() }
      });
      lastSyncTimestamp.current = Date.now();
    } catch (e) { console.error("Sync Failure:", e); }
  };

  // STRICT TRACKING LOGIC: ACTIVATE ONLY DURING ACTIVE JOB
  useEffect(() => {
    if ("geolocation" in navigator && activeJob) {
      console.log("Duty Tracking Mode Activated");
      geoWatchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          const now = Date.now();
          if (now - lastSyncTimestamp.current > getSyncCooldown()) {
            updateLocationInDB(pos.coords.latitude, pos.coords.longitude);
          }
        },
        null,
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
      );
    } else {
      console.log("Duty Tracking Mode Suspended");
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
      {/* Unit Status Card */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 text-9xl"><i className="fas fa-truck-fast"></i></div>
        <div className="relative z-10 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-2xl text-blue-400"><i className="fas fa-id-card"></i></div>
              <div>
                <h2 className="text-xl font-black tracking-tighter uppercase">{driver.name}</h2>
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{driver.vehicleNo}</p>
              </div>
            </div>
            <div className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-[0.2em] border ${activeJob ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 animate-pulse' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
              {activeJob ? 'Duty Live' : 'Standing By'}
            </div>
          </div>
          
          <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex justify-between">
             <div className="text-center flex-1">
                <p className="text-[8px] font-black text-gray-500 uppercase mb-1">Telemetry</p>
                <p className="text-[10px] font-black uppercase">{fleetSettings.syncSpeed} MODE</p>
             </div>
             <div className="w-px bg-white/5"></div>
             <div className="text-center flex-1">
                <p className="text-[8px] font-black text-gray-500 uppercase mb-1">Signal Strength</p>
                <div className="flex items-center justify-center space-x-1">
                   {[1,2,3,4].map(i => <div key={i} className={`w-1 h-2 rounded-full ${i < 4 ? 'bg-emerald-500 shadow-[0_0_5px_#10b981]' : 'bg-white/10'}`}></div>)}
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Dispatch Feed */}
      {pendingJobs.length > 0 && !activeJob && (
        <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
           <h3 className="font-black text-[10px] uppercase text-gray-400 tracking-widest px-4">New Assignments ({pendingJobs.length})</h3>
           {pendingJobs.map(job => (
             <div key={job.id} className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-xl space-y-6">
               <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">{job.tripType}</span>
                    <span className="text-[10px] text-gray-400 font-bold"># {job.id}</span>
                  </div>
                  <h4 className="font-black text-gray-900 text-xl leading-tight">{job.origin} <i className="fas fa-arrow-right text-gray-300 mx-1"></i> {job.destination}</h4>
               </div>
               
               <div className="bg-gray-50 p-5 rounded-2xl text-xs text-gray-600 font-bold leading-relaxed border border-gray-100 italic">
                  "{job.description || 'Proceed to hub for documentation.'}"
               </div>
               
               {job.attachmentUrl && (
                 <a href={job.attachmentUrl} target="_blank" className="w-full bg-blue-600/5 text-blue-600 py-4 rounded-xl flex items-center justify-center space-x-3 text-[10px] font-black uppercase tracking-widest border border-blue-600/10">
                   <i className="fas fa-file-invoice-dollar text-sm"></i> <span>View Digital Manifest</span>
                 </a>
               )}

               <button 
                onClick={() => handleStartTrip(job.id)}
                disabled={busyJobId === job.id}
                className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition flex items-center justify-center space-x-3"
               >
                 {busyJobId === job.id ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-truck-moving text-sm text-blue-400"></i>}
                 <span>{busyJobId === job.id ? 'Starting Trip...' : 'Accept & Start Trip'}</span>
               </button>
             </div>
           ))}
        </div>
      )}

      {/* Duty HUD */}
      {activeJob && (
        <div className="bg-white rounded-[2.5rem] shadow-2xl border-2 border-emerald-50 p-8 space-y-6 animate-in zoom-in-95 duration-300">
          <div className="flex justify-between items-center">
            <h4 className="text-[11px] font-black uppercase text-emerald-600 tracking-[0.2em]">Live Tracking Active</h4>
            <div className="flex items-center space-x-2">
               <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
               <span className="text-[8px] font-black text-emerald-500 uppercase">Precise GPS</span>
            </div>
          </div>
          <div className="bg-slate-900 rounded-[2rem] p-6 text-white text-center space-y-5 relative overflow-hidden">
            <div className="grid grid-cols-2 gap-4">
               <div><p className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-1">Terminal</p><p className="font-black text-sm">{activeJob.origin}</p></div>
               <div><p className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-1">Consignee</p><p className="font-black text-sm">{activeJob.destination}</p></div>
            </div>
            <div className="h-px bg-white/5 w-full"></div>
            <p className="text-[9px] text-blue-400 font-black uppercase tracking-widest">Job Reference: {activeJob.id}</p>
          </div>
          
          <button 
            onClick={() => handleFinishTrip(activeJob.id)} 
            disabled={busyJobId === activeJob.id}
            className="w-full bg-rose-600 text-white py-6 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl flex items-center justify-center space-x-3 active:scale-95 transition"
          >
             {busyJobId === activeJob.id ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-flag-checkered text-xl"></i>}
             <span>{busyJobId === activeJob.id ? 'Finalizing...' : 'Finish Delivery'}</span>
          </button>
        </div>
      )}

      {/* Action Hub */}
      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => { setLogType('FUEL'); setShowLogForm(true); }} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col items-center space-y-3 active:scale-95 transition group">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center text-xl group-hover:bg-orange-600 group-hover:text-white transition-all shadow-sm"><i className="fas fa-gas-pump"></i></div>
          <span className="font-black text-[10px] uppercase tracking-widest text-gray-500 group-hover:text-gray-900">Fuel Log</span>
        </button>
        <button onClick={() => { setLogType('MAINTENANCE'); setShowLogForm(true); }} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col items-center space-y-3 active:scale-95 transition group">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm"><i className="fas fa-screwdriver-wrench"></i></div>
          <span className="font-black text-[10px] uppercase tracking-widest text-gray-500 group-hover:text-gray-900">Maint Log</span>
        </button>
      </div>

      {!activeJob && pendingJobs.length === 0 && (
        <div className="bg-white/40 backdrop-blur-sm rounded-[2.5rem] border-2 border-dashed border-gray-200 p-16 text-center text-gray-400">
          <i className="fas fa-satellite text-4xl mb-4 opacity-10"></i>
          <p className="font-black uppercase text-[10px] tracking-[0.2em]">Awaiting Dispatch Instructions</p>
        </div>
      )}

      {/* Finance Modal */}
      {showLogForm && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-[3rem] sm:rounded-[3rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-black text-gray-900 uppercase tracking-widest text-lg">Record {logType}</h3>
              <button onClick={() => setShowLogForm(false)} className="text-gray-300 hover:text-rose-500 transition text-3xl"><i className="fas fa-times-circle"></i></button>
            </div>
            <form onSubmit={handleLogSubmit} className="p-8 space-y-6">
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Expense Amount (₹)</label>
                <input name="amount" type="number" required placeholder="0.00" className="w-full bg-transparent font-black text-3xl outline-none" />
              </div>
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Reference Narration</label>
                <input name="description" placeholder="Supplier or bill description" className="w-full bg-transparent font-bold text-sm outline-none" />
              </div>
              <div className="border-4 border-dashed border-blue-50 rounded-[2rem] p-10 text-center bg-blue-50/20 active:bg-blue-100 transition-all cursor-pointer">
                <input type="file" className="hidden" id="receipt-upload" accept="image/*" capture="environment" required />
                <label htmlFor="receipt-upload" className="cursor-pointer flex flex-col items-center">
                  <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-4 shadow-xl"><i className="fas fa-camera text-2xl"></i></div>
                  <p className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Capture Physical Bill</p>
                </label>
              </div>
              <button type="submit" disabled={isUploading} className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black uppercase tracking-widest shadow-2xl flex items-center justify-center space-x-3 active:scale-95 transition">
                {isUploading ? <><i className="fas fa-circle-notch fa-spin"></i><span>Processing...</span></> : 'Submit Proof'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverPortal;

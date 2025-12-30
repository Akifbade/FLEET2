
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
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'HISTORY' | 'VEHICLE'>('DASHBOARD');
  const [showLogForm, setShowLogForm] = useState(false);
  const [logType, setLogType] = useState<ReceiptType>('FUEL');
  const [isUploading, setIsUploading] = useState(false);
  const geoWatchId = useRef<number | null>(null);
  const lastSyncTimestamp = useRef<number>(0);

  const activeJob = jobs.find(j => j.status === JobStatus.IN_PROGRESS);
  const pendingJobs = jobs.filter(j => j.status === JobStatus.PENDING);
  const completedJobs = jobs.filter(j => j.status === JobStatus.COMPLETED).sort((a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime());

  // Driver stats
  const dailyKm = completedJobs
    .filter(j => new Date(j.endTime!).toDateString() === new Date().toDateString())
    .reduce((acc, curr) => acc + (curr.distanceKm || 0), 0);

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

      await updateDoc(doc(db, "drivers", driver.id), {
        lastKnownLocation: loc
      });

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
    <div className="max-w-md mx-auto space-y-6 pb-32 min-h-screen">
      
      {/* Dynamic Header */}
      <div className="bg-slate-900 rounded-b-[3rem] -mt-8 p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-2xl font-black shadow-lg">
              {driver.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tighter uppercase">{driver.name}</h2>
              <p className="text-gray-400 text-[9px] font-black uppercase tracking-[0.2em]">{driver.vehicleNo} • ID: {driver.id}</p>
            </div>
          </div>
          <div className={`w-3 h-3 rounded-full ${activeJob ? 'bg-emerald-500 animate-pulse' : 'bg-gray-700'}`}></div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-8">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/5">
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Today's Dist</p>
            <p className="text-xl font-black">{dailyKm.toFixed(1)} <span className="text-[10px] text-gray-500">KM</span></p>
          </div>
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/5">
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Mission Stat</p>
            <p className="text-xl font-black">{activeJob ? 'ACTIVE' : 'READY'}</p>
          </div>
        </div>
      </div>

      {activeTab === 'DASHBOARD' && (
        <div className="space-y-6 px-4 animate-in slide-in-from-bottom-8">
          
          {/* NOTICE HUB */}
          <div className="bg-amber-50 rounded-[2rem] p-6 border border-amber-100 flex items-start space-x-4">
             <div className="w-10 h-10 bg-amber-200 text-amber-800 rounded-xl flex items-center justify-center text-lg"><i className="fas fa-bullhorn"></i></div>
             <div>
                <h4 className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1">Fleet Notification</h4>
                <p className="text-xs font-bold text-amber-700 leading-tight">Terminal check-in required for all Airport Cargo missions before 06:00 PM.</p>
             </div>
          </div>

          {/* ACTIVE / PENDING JOBS */}
          {activeJob ? (
            <div className="bg-white rounded-[2.5rem] shadow-2xl border-2 border-emerald-50 p-8 space-y-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500/20"></div>
              <div className="flex justify-between items-center">
                <h4 className="text-[11px] font-black uppercase text-emerald-600 tracking-[0.2em]">Live Mission Radar</h4>
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">ID: {activeJob.id}</span>
              </div>
              <div className="space-y-2">
                <p className="text-gray-400 text-[8px] font-black uppercase tracking-widest">Ongoing Path</p>
                <h4 className="font-black text-gray-900 text-2xl leading-tight">
                  {activeJob.origin} 
                  <i className="fas fa-chevron-right text-gray-200 mx-3 text-sm"></i> 
                  {activeJob.destination}
                </h4>
              </div>
              <div className="bg-slate-900 rounded-[2rem] p-6 text-white">
                 <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                    <span className="text-gray-500">Started At</span>
                    <span>{new Date(activeJob.startTime!).toLocaleTimeString()}</span>
                 </div>
              </div>
              <button onClick={() => onUpdateJobStatus(activeJob.id, JobStatus.COMPLETED)} className="w-full bg-emerald-600 text-white py-6 rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-200 active:scale-95 transition">
                 Finish Delivery
              </button>
            </div>
          ) : pendingJobs.length > 0 ? (
            <div className="space-y-4">
               <h3 className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Awaiting Missions</h3>
               {pendingJobs.map(job => (
                 <div key={job.id} className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-xl space-y-6 hover:border-blue-200 transition">
                   <div>
                     <p className="text-[9px] font-black text-blue-600 uppercase mb-2 tracking-widest">{job.tripType}</p>
                     <h4 className="font-black text-gray-900 text-xl leading-tight">{job.origin} → {job.destination}</h4>
                   </div>
                   <button onClick={() => onUpdateJobStatus(job.id, JobStatus.IN_PROGRESS)} className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black uppercase tracking-widest shadow-2xl active:scale-95 transition">Accept Dispatch</button>
                 </div>
               ))}
            </div>
          ) : (
            <div className="bg-white rounded-[2.5rem] p-12 text-center border-2 border-dashed border-gray-100">
               <i className="fas fa-truck-ramp-box text-gray-200 text-5xl mb-4"></i>
               <p className="text-gray-400 font-black uppercase text-[10px] tracking-widest">No Missions Assigned</p>
            </div>
          )}

          {/* Action Grid */}
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => { setLogType('FUEL'); setShowLogForm(true); }} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col items-center space-y-3 hover:shadow-md transition">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center text-2xl shadow-sm"><i className="fas fa-gas-pump"></i></div>
              <span className="font-black text-[10px] uppercase tracking-widest text-gray-600">Fuel Log</span>
            </button>
            <button onClick={() => { setLogType('MAINTENANCE'); setShowLogForm(true); }} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col items-center space-y-3 hover:shadow-md transition">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl shadow-sm"><i className="fas fa-screwdriver-wrench"></i></div>
              <span className="font-black text-[10px] uppercase tracking-widest text-gray-600">Maint Log</span>
            </button>
          </div>
        </div>
      )}

      {activeTab === 'HISTORY' && (
        <div className="space-y-6 px-4 animate-in slide-in-from-bottom-8">
           <div className="flex justify-between items-center px-2">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Recent Mission Logs</h3>
              <span className="text-[9px] font-black text-blue-600 uppercase bg-blue-50 px-3 py-1 rounded-full">{completedJobs.length} Completed</span>
           </div>
           <div className="space-y-4">
              {completedJobs.length === 0 ? (
                <div className="text-center py-20">
                  <i className="fas fa-clock-rotate-left text-gray-200 text-6xl mb-4"></i>
                  <p className="text-gray-400 font-black text-[10px] uppercase">History is empty</p>
                </div>
              ) : completedJobs.map(job => (
                <div key={job.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-1.5 h-full bg-gray-100"></div>
                   <div className="flex justify-between items-start mb-4">
                      <p className="text-[9px] font-black text-gray-400 uppercase">{new Date(job.endTime!).toLocaleDateString()}</p>
                      <p className="text-sm font-black text-emerald-600">+{job.distanceKm?.toFixed(1) || 0} KM</p>
                   </div>
                   <h4 className="font-black text-gray-900 text-sm tracking-tight">{job.origin} → {job.destination}</h4>
                   <div className="mt-4 flex space-x-4">
                      <div className="flex items-center space-x-1.5">
                         <i className="fas fa-gauge-high text-blue-500 text-[10px]"></i>
                         <span className="text-[10px] font-bold text-gray-500">{job.avgSpeed || 0} KM/H</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                         <i className="fas fa-clock text-blue-500 text-[10px]"></i>
                         <span className="text-[10px] font-bold text-gray-500">
                           {Math.round((new Date(job.endTime!).getTime() - new Date(job.startTime!).getTime()) / 60000)} MIN
                         </span>
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'VEHICLE' && (
        <div className="space-y-6 px-4 animate-in slide-in-from-bottom-8">
           <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-xl space-y-8">
              <div className="text-center">
                 <div className="w-24 h-24 bg-gray-50 rounded-[2rem] flex items-center justify-center mx-auto mb-4 border border-gray-100 shadow-inner">
                    <i className="fas fa-truck text-4xl text-blue-600"></i>
                 </div>
                 <h3 className="font-black text-gray-900 text-2xl tracking-tighter uppercase">{driver.vehicleNo}</h3>
                 <p className="text-blue-600 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Carrier Status: Prime</p>
              </div>

              <div className="space-y-4">
                 {[
                   { label: 'Carrier Health', value: 'Excellent', color: 'text-emerald-500', icon: 'fa-heart-pulse' },
                   { label: 'Next Oil Change', value: 'In 1,240 KM', color: 'text-orange-500', icon: 'fa-droplet' },
                   { label: 'Tire Pressure', value: 'Optimized', color: 'text-emerald-500', icon: 'fa-circle-dot' },
                   { label: 'Last Service', value: '14 Jan 2025', color: 'text-gray-400', icon: 'fa-calendar-check' },
                 ].map((stat, i) => (
                   <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex items-center space-x-4">
                        <i className={`fas ${stat.icon} ${stat.color} text-sm`}></i>
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{stat.label}</span>
                      </div>
                      <span className="text-[11px] font-black text-gray-900">{stat.value}</span>
                   </div>
                 ))}
              </div>

              <div className="pt-6 border-t border-gray-100">
                 <button className="w-full py-5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center space-x-3">
                    <i className="fas fa-clipboard-check"></i>
                    <span>Submit Inspection Report</span>
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* BOTTOM NAVIGATION */}
      <div className="fixed bottom-6 left-6 right-6 z-[100] pointer-events-none">
         <div className="max-w-md mx-auto bg-slate-900/95 backdrop-blur-xl rounded-[2.5rem] p-3 shadow-2xl border border-white/10 flex justify-between pointer-events-auto">
            {[
              { id: 'DASHBOARD', icon: 'fa-house', label: 'Home' },
              { id: 'HISTORY', icon: 'fa-clock-rotate-left', label: 'History' },
              { id: 'VEHICLE', icon: 'fa-truck-front', label: 'Vehicle' },
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex flex-col items-center py-3 rounded-[2rem] transition-all duration-300 ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
              >
                <i className={`fas ${tab.icon} text-lg mb-1`}></i>
                <span className="text-[8px] font-black uppercase tracking-widest">{tab.label}</span>
              </button>
            ))}
         </div>
      </div>

      {/* Log Modal */}
      {showLogForm && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-[3rem] sm:rounded-[3rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-20">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-black text-gray-900 uppercase tracking-widest text-lg">Record {logType}</h3>
              <button onClick={() => setShowLogForm(false)} className="text-gray-300 hover:text-rose-500 transition text-3xl"><i className="fas fa-times-circle"></i></button>
            </div>
            <form onSubmit={handleLogSubmit} className="p-8 space-y-6">
              <div className="space-y-1">
                 <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Total Amount (KWD)</label>
                 <input name="amount" type="number" step="0.001" required placeholder="0.000" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-5 text-2xl font-black outline-none focus:border-blue-500 transition" />
              </div>
              <div className="space-y-1">
                 <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Description / Vendor</label>
                 <input name="description" placeholder="e.g. Al-Oula Fuel Station" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-5 text-sm font-bold outline-none focus:border-blue-500 transition" />
              </div>
              <div className="border-4 border-dashed border-blue-50 rounded-[2rem] p-10 text-center bg-blue-50/20 group hover:border-blue-200 transition">
                <input type="file" className="hidden" id="receipt-upload" accept="image/*" capture="environment" required />
                <label htmlFor="receipt-upload" className="cursor-pointer flex flex-col items-center">
                  <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-4 shadow-xl group-hover:scale-110 transition-transform"><i className="fas fa-camera text-2xl"></i></div>
                  <p className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Capture Photo Proof</p>
                </label>
              </div>
              <button type="submit" disabled={isUploading} className="w-full bg-slate-900 text-white py-6 rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition disabled:opacity-50">
                {isUploading ? 'Encrypting Data...' : 'Submit Records'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverPortal;

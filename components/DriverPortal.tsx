
import React, { useState, useEffect, useRef } from 'react';
import { Driver, Job, ReceiptEntry, JobStatus, ReceiptType, FleetSettings, Location } from '../types';
import { db, fileToBase64 } from '../services/firebase';
import { doc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";

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
  const lastRecordedLatLng = useRef<[number, number] | null>(null);

  const activeJob = jobs.find(j => j.status === JobStatus.IN_PROGRESS);
  const pendingJobs = jobs.filter(j => j.status === JobStatus.PENDING);
  const completedJobs = jobs.filter(j => j.status === JobStatus.COMPLETED).sort((a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime());

  // Heartbeat Logic for Real-time Status
  useEffect(() => {
    if (!db) return;

    const updatePresence = async (status: 'ONLINE' | 'ON_JOB' | 'OFFLINE') => {
      try {
        await updateDoc(doc(db, "drivers", driver.id), {
          status: status,
          lastSeen: Date.now()
        });
      } catch (e) {
        console.error("Presence update failed", e);
      }
    };

    updatePresence(activeJob ? 'ON_JOB' : 'ONLINE');
    const heartbeat = setInterval(() => {
      updatePresence(activeJob ? 'ON_JOB' : 'ONLINE');
    }, 20000); // More aggressive heartbeat

    return () => {
      clearInterval(heartbeat);
      updatePresence('OFFLINE');
    };
  }, [driver.id, activeJob]);

  // Driver stats
  const dailyKm = completedJobs
    .filter(j => new Date(j.endTime!).toDateString() === new Date().toDateString())
    .reduce((acc, curr) => acc + (curr.distanceKm || 0), 0);

  const updateLocationInDB = async (pos: GeolocationPosition) => {
    try {
      const { latitude, longitude, speed } = pos.coords;
      const loc: Location = { 
        lat: latitude, 
        lng: longitude, 
        speed: speed || 0,
        timestamp: Date.now() 
      };

      // Only update if significant movement or time elapsed
      const timeSinceLastSync = Date.now() - lastSyncTimestamp.current;
      const distMoved = lastRecordedLatLng.current ? 
        Math.sqrt(Math.pow(latitude - lastRecordedLatLng.current[0], 2) + Math.pow(longitude - lastRecordedLatLng.current[1], 2)) : 100;

      // Thresholds: Every 5 meters or every 5 seconds if moving
      if (distMoved > 0.00005 || timeSinceLastSync > 5000) {
        await updateDoc(doc(db, "drivers", driver.id), {
          lastKnownLocation: loc,
          lastSeen: Date.now() 
        });

        if (activeJob) {
          await updateDoc(doc(db, "jobs", activeJob.id), {
            route: arrayUnion(loc)
          });
        }
        
        lastSyncTimestamp.current = Date.now();
        lastRecordedLatLng.current = [latitude, longitude];
      }
    } catch (e) { console.error("Sync Failure:", e); }
  };

  useEffect(() => {
    if ("geolocation" in navigator && activeJob) {
      geoWatchId.current = navigator.geolocation.watchPosition(
        (pos) => updateLocationInDB(pos),
        (err) => console.error("GPS Error:", err),
        { 
          enableHighAccuracy: true, 
          maximumAge: 0, 
          timeout: 5000 
        }
      );
    } else {
      if (geoWatchId.current) {
        navigator.geolocation.clearWatch(geoWatchId.current);
        geoWatchId.current = null;
      }
    }
    return () => { if (geoWatchId.current) navigator.geolocation.clearWatch(geoWatchId.current); };
  }, [activeJob]);

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
      
      {/* Header */}
      <div className="bg-slate-900 rounded-b-[3rem] -mt-8 p-10 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/30 rounded-full blur-[80px] -mr-16 -mt-16"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center space-x-5">
            <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center text-3xl font-black shadow-[0_10px_30px_rgba(37,99,235,0.4)]">
              {driver.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tighter uppercase leading-none mb-2">{driver.name}</h2>
              <div className="flex items-center space-x-2">
                 <span className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">{driver.vehicleNo}</span>
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-10">
          <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-6 border border-white/10 shadow-inner">
            <p className="text-[9px] font-black text-blue-300 uppercase tracking-widest mb-1">Trip Meter</p>
            <p className="text-2xl font-black">{dailyKm.toFixed(1)} <span className="text-xs text-blue-300/60 ml-1">KM</span></p>
          </div>
          <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-6 border border-white/10 shadow-inner">
            <p className="text-[9px] font-black text-blue-300 uppercase tracking-widest mb-1">Assignment</p>
            <p className="text-2xl font-black">{activeJob ? 'ACTIVE' : 'READY'}</p>
          </div>
        </div>
      </div>

      {activeTab === 'DASHBOARD' && (
        <div className="space-y-6 px-4 animate-in slide-in-from-bottom-8">
          
          {/* Active Task Card */}
          {activeJob ? (
            <div className="bg-white rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] border border-gray-100 p-8 space-y-8 relative overflow-hidden">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                   <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></div>
                   <h4 className="text-[11px] font-black uppercase text-emerald-600 tracking-[0.3em]">Live Mission Telemetry</h4>
                </div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{activeJob.id}</span>
              </div>
              
              <div className="space-y-2">
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Active Corridor</p>
                <div className="flex items-center space-x-5">
                   <h4 className="font-black text-slate-900 text-2xl tracking-tight">{activeJob.origin}</h4>
                   <i className="fas fa-arrow-right-long text-blue-200 text-xl"></i>
                   <h4 className="font-black text-slate-900 text-2xl tracking-tight">{activeJob.destination}</h4>
                </div>
              </div>

              <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white">
                 <div className="flex justify-between items-center">
                    <div>
                       <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Departure Time</p>
                       <p className="text-xl font-black">{new Date(activeJob.startTime!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Mission Clock</p>
                       <p className="text-xl font-black text-emerald-400">ON-TIME</p>
                    </div>
                 </div>
              </div>

              <button onClick={() => onUpdateJobStatus(activeJob.id, JobStatus.COMPLETED)} className="w-full bg-emerald-600 text-white py-7 rounded-[2rem] font-black uppercase tracking-[0.3em] shadow-[0_20px_40px_-10px_rgba(16,185,129,0.4)] active:scale-95 transition-all">
                 Complete Payload
              </button>
            </div>
          ) : pendingJobs.length > 0 ? (
            <div className="space-y-4">
               <h3 className="px-6 text-[11px] font-black text-gray-400 uppercase tracking-[0.3em]">Available Dispatches</h3>
               {pendingJobs.map(job => (
                 <div key={job.id} className="bg-white rounded-[3rem] p-8 border border-gray-100 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.05)] space-y-8 hover:border-blue-200 transition-all">
                   <div>
                     <p className="text-[10px] font-black text-blue-600 uppercase mb-3 tracking-[0.3em]">{job.tripType}</p>
                     <h4 className="font-black text-slate-900 text-2xl tracking-tight">{job.origin} <i className="fas fa-chevron-right text-gray-200 mx-3 text-lg"></i> {job.destination}</h4>
                   </div>
                   <button onClick={() => onUpdateJobStatus(job.id, JobStatus.IN_PROGRESS)} className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition">Accept & Move</button>
                 </div>
               ))}
            </div>
          ) : (
            <div className="bg-white rounded-[3rem] p-20 text-center border-4 border-dashed border-gray-50">
               <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6"><i className="fas fa-truck-loading text-gray-200 text-4xl"></i></div>
               <p className="text-gray-400 font-black uppercase text-[11px] tracking-[0.3em]">Standby for orders</p>
            </div>
          )}

          {/* Rapid Logs */}
          <div className="grid grid-cols-2 gap-5">
            <button onClick={() => { setLogType('FUEL'); setShowLogForm(true); }} className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 flex flex-col items-center space-y-4 hover:shadow-lg transition">
              <div className="w-16 h-16 rounded-[1.5rem] bg-orange-50 text-orange-600 flex items-center justify-center text-2xl shadow-sm"><i className="fas fa-gas-pump"></i></div>
              <span className="font-black text-[11px] uppercase tracking-widest text-slate-700">Fuel Log</span>
            </button>
            <button onClick={() => { setLogType('MAINTENANCE'); setShowLogForm(true); }} className="bg-white p-8 rounded-[3rem] shadow-sm border border-gray-100 flex flex-col items-center space-y-4 hover:shadow-lg transition">
              <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl shadow-sm"><i className="fas fa-wrench"></i></div>
              <span className="font-black text-[11px] uppercase tracking-widest text-slate-700">Service</span>
            </button>
          </div>
        </div>
      )}

      {/* Navigation - Based on professional fleet app layout */}
      <div className="fixed bottom-8 left-8 right-8 z-[100] pointer-events-none">
         <div className="max-w-md mx-auto bg-slate-900/95 backdrop-blur-2xl rounded-[3rem] p-3 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] border border-white/10 flex justify-between pointer-events-auto">
            {[
              { id: 'DASHBOARD', icon: 'fa-cube', label: 'Console' },
              { id: 'HISTORY', icon: 'fa-layer-group', label: 'Logs' },
              { id: 'VEHICLE', icon: 'fa-shuttle-space', label: 'Unit' },
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex flex-col items-center py-4 rounded-[2.5rem] transition-all duration-500 ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-xl translate-y-[-4px]' : 'text-gray-500 hover:text-white'}`}
              >
                <i className={`fas ${tab.icon} text-xl mb-1.5`}></i>
                <span className="text-[9px] font-black uppercase tracking-widest">{tab.label}</span>
              </button>
            ))}
         </div>
      </div>

      {/* Expense Modal - Capture Ready */}
      {showLogForm && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-2xl z-[200] flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-[4rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full duration-500">
            <div className="p-10 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-black text-slate-900 uppercase tracking-tight text-xl">Registry: {logType}</h3>
              <button onClick={() => setShowLogForm(false)} className="text-gray-300 hover:text-rose-500 transition text-4xl"><i className="fas fa-times-circle"></i></button>
            </div>
            <form onSubmit={handleLogSubmit} className="p-10 space-y-8">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Payment Amount (KWD)</label>
                 <input name="amount" type="number" step="0.001" required placeholder="0.000" className="w-full bg-gray-50 border-2 border-gray-100 rounded-[2rem] p-6 text-3xl font-black outline-none focus:border-blue-500 transition" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Vendor / Terminal</label>
                 <input name="description" placeholder="Specify location" className="w-full bg-gray-50 border-2 border-gray-100 rounded-[2rem] p-6 text-sm font-black outline-none focus:border-blue-500" />
              </div>
              <div className="border-4 border-dashed border-blue-50 rounded-[3rem] p-12 text-center bg-blue-50/20 group hover:border-blue-200 transition-all cursor-pointer relative">
                <input type="file" className="hidden" id="receipt-upload" accept="image/*" capture="environment" required />
                <label htmlFor="receipt-upload" className="cursor-pointer flex flex-col items-center">
                  <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white mb-5 shadow-xl group-hover:scale-110 transition-transform"><i className="fas fa-camera text-3xl"></i></div>
                  <p className="text-[11px] font-black text-blue-900 uppercase tracking-widest">Verify with Proof</p>
                </label>
              </div>
              <button type="submit" disabled={isUploading} className="w-full bg-slate-900 text-white py-7 rounded-[2rem] font-black uppercase tracking-[0.3em] shadow-2xl active:scale-95 transition-all mb-10">
                {isUploading ? 'Encrypting Payload...' : 'Submit to Core'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverPortal;

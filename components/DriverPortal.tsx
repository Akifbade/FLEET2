
import React, { useState, useEffect, useRef } from 'react';
import { Driver, Job, ReceiptEntry, JobStatus, ReceiptType } from '../types';
import { db, fileToBase64 } from '../services/firebase';
import { doc, updateDoc } from "firebase/firestore";

interface DriverPortalProps {
  driver: Driver;
  jobs: Job[];
  onUpdateJobStatus: (jobId: string, status: JobStatus) => void;
  onLogFuel: (entry: ReceiptEntry) => void;
}

const DriverPortal: React.FC<DriverPortalProps> = ({ driver, jobs, onUpdateJobStatus, onLogFuel }) => {
  const [showLogForm, setShowLogForm] = useState(false);
  const [logType, setLogType] = useState<ReceiptType>('FUEL');
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const geoWatchId = useRef<number | null>(null);
  const wakeLock = useRef<any>(null);

  const activeJob = jobs.find(j => j.status === JobStatus.IN_PROGRESS);

  // MANAGE SCREEN WAKE LOCK (Keeps screen ON during trips)
  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLock.current = await (navigator as any).wakeLock.request('screen');
        console.log('Screen Wake Lock is active');
      } catch (err) {
        console.error(`${err.name}, ${err.message}`);
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLock.current) {
      wakeLock.current.release().then(() => {
        wakeLock.current = null;
      });
    }
  };

  useEffect(() => {
    if (activeJob) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
    return () => releaseWakeLock();
  }, [activeJob]);

  // MANUAL SYNC FUNCTION
  const handleManualSync = () => {
    if (!("geolocation" in navigator)) return;
    
    setIsSyncing(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const driverRef = doc(db, "drivers", driver.id);
        try {
          await updateDoc(driverRef, {
            lastKnownLocation: { lat: latitude, lng: longitude, timestamp: Date.now() }
          });
          // Show success briefly
          setTimeout(() => setIsSyncing(false), 1000);
        } catch (e) {
          console.error("Manual sync failed:", e);
          setIsSyncing(false);
        }
      },
      (error) => {
        console.error("GPS Error during manual sync:", error);
        setIsSyncing(false);
        alert("GPS Signal Weak. Please try again in an open area.");
      },
      { enableHighAccuracy: true }
    );
  };

  // REAL GPS STREAMING
  useEffect(() => {
    if ("geolocation" in navigator) {
      geoWatchId.current = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const driverRef = doc(db, "drivers", driver.id);
          try {
            await updateDoc(driverRef, {
              lastKnownLocation: { lat: latitude, lng: longitude, timestamp: Date.now() }
            });
          } catch (e) {
            console.error("Cloud location sync failed:", e);
          }
        },
        (error) => console.error("GPS Error:", error),
        { 
          enableHighAccuracy: true, 
          maximumAge: 5000, // Sync every 5 seconds
          timeout: 15000 
        }
      );
    }
    return () => {
      if (geoWatchId.current) navigator.geolocation.clearWatch(geoWatchId.current);
    };
  }, [driver.id]);

  const handleLogSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    
    const formData = new FormData(e.currentTarget);
    const amount = Number(formData.get('amount'));
    const description = formData.get('description') as string;
    const fileInput = document.getElementById('receipt-upload') as HTMLInputElement;

    let base64Image = '';
    if (fileInput.files && fileInput.files[0]) {
      base64Image = await fileToBase64(fileInput.files[0]);
    }

    const entry: ReceiptEntry = {
      id: `R${Date.now()}`,
      driverId: driver.id,
      jobId: activeJob?.id || 'NO_JOB',
      type: logType,
      amount,
      description,
      invoiceUrl: base64Image,
      date: new Date().toISOString(),
      status: 'PENDING',
    };

    onLogFuel(entry);
    setIsUploading(false);
    setShowLogForm(false);
  };

  return (
    <div className="max-w-md mx-auto space-y-6 pb-24 px-2">
      {/* Real-time Header */}
      <div className="bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-3xl bg-white/20 backdrop-blur-md flex items-center justify-center text-3xl border border-white/30 shadow-inner">
                <i className="fas fa-truck-fast"></i>
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight">{driver.name}</h2>
                <p className="text-blue-200 text-xs font-black uppercase tracking-widest">{driver.vehicleNo}</p>
              </div>
            </div>
            <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${
              activeJob ? 'bg-orange-500 animate-pulse' : 'bg-green-500'
            }`}></div>
          </div>

          <div className="pt-2">
            <button 
              onClick={handleManualSync}
              disabled={isSyncing}
              className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 py-4 rounded-2xl flex items-center justify-center space-x-3 transition-all active:scale-95 disabled:opacity-50"
            >
              <i className={`fas ${isSyncing ? 'fa-circle-notch fa-spin' : 'fa-location-crosshairs'} text-lg`}></i>
              <span className="font-black text-[11px] uppercase tracking-wider">
                {isSyncing ? 'Syncing Coordinates...' : 'Sync Current Location'}
              </span>
            </button>
            <p className="text-[9px] text-white/40 font-bold uppercase text-center mt-3 tracking-widest">
              Last Sync: {driver.lastKnownLocation ? new Date(driver.lastKnownLocation.timestamp || 0).toLocaleTimeString() : 'No Signal'}
            </p>
          </div>
        </div>
        {/* Background signal icon */}
        <i className="fas fa-satellite absolute -right-6 -bottom-6 text-white/5 text-[10rem] rotate-12"></i>
      </div>

      {activeJob && (
        <div className="bg-blue-50 border border-blue-100 p-5 rounded-3xl flex items-start space-x-4 shadow-sm">
          <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <i className="fas fa-shield-halved"></i>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-black text-blue-900 uppercase tracking-wide">Stealth Tracking Active</p>
            <p className="text-[10px] font-medium text-blue-800 leading-relaxed">
              Your screen will stay on during the trip. This ensures Admin gets your 100% accurate location data.
            </p>
          </div>
        </div>
      )}

      {/* Driver Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => { setLogType('FUEL'); setShowLogForm(true); }} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col items-center space-y-4 active:scale-95 transition group">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center text-2xl group-hover:scale-110 transition shadow-sm">
            <i className="fas fa-gas-pump"></i>
          </div>
          <span className="font-black text-[11px] uppercase tracking-widest text-gray-700">Fuel Entry</span>
        </button>
        <button onClick={() => { setLogType('MAINTENANCE'); setShowLogForm(true); }} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col items-center space-y-4 active:scale-95 transition group">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl group-hover:scale-110 transition shadow-sm">
            <i className="fas fa-toolbox"></i>
          </div>
          <span className="font-black text-[11px] uppercase tracking-widest text-gray-700">Repair Log</span>
        </button>
      </div>

      {/* Active Trip Info */}
      {activeJob ? (
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 p-8 space-y-8 animate-in slide-in-from-bottom-4">
          <div className="flex justify-between items-center">
            <h4 className="text-[11px] font-black uppercase text-blue-600 tracking-[0.2em]">Deployment Details</h4>
            <div className="px-3 py-1 bg-green-50 rounded-full border border-green-100 flex items-center space-x-2">
               <span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="bg-green-500 h-2 w-2 rounded-full relative"></span></span>
               <span className="text-[9px] font-black text-green-600">LIVE FEED</span>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-3xl p-6 flex items-center justify-between border border-gray-100 relative">
            <div className="text-center flex-1">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Origin</p>
              <p className="font-black text-gray-900 text-lg leading-tight">{activeJob.origin}</p>
            </div>
            <div className="px-4">
              <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-gray-300 border border-gray-100">
                <i className="fas fa-arrow-right"></i>
              </div>
            </div>
            <div className="text-center flex-1">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Target</p>
              <p className="font-black text-gray-900 text-lg leading-tight">{activeJob.destination}</p>
            </div>
          </div>

          <div className="space-y-4">
            <button onClick={() => onUpdateJobStatus(activeJob.id, JobStatus.COMPLETED)} className="w-full bg-red-600 text-white py-6 rounded-[1.5rem] font-black uppercase tracking-widest shadow-2xl shadow-red-100 active:scale-95 transition-all flex items-center justify-center space-x-3">
               <i className="fas fa-flag-checkered text-xl"></i>
               <span>Finish Delivery</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border-4 border-dashed border-gray-100 p-12 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-200 shadow-inner">
            <i className="fas fa-map-location-dot text-3xl"></i>
          </div>
          <h4 className="font-black text-gray-300 uppercase text-[12px] tracking-[0.3em]">Awaiting Dispatch</h4>
        </div>
      )}

      {/* Log Receipt Modal */}
      {showLogForm && (
        <div className="fixed inset-0 bg-gray-900/90 backdrop-blur-md z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-md rounded-t-[3rem] sm:rounded-[3rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="font-black text-gray-900 uppercase tracking-tight text-lg">Log {logType}</h3>
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Financial Submission</p>
              </div>
              <button onClick={() => setShowLogForm(false)} className="text-gray-300 hover:text-red-500 transition text-3xl"><i className="fas fa-circle-xmark"></i></button>
            </div>
            <form onSubmit={handleLogSubmit} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-3xl p-5 border border-gray-100 focus-within:border-blue-500 transition-colors">
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Expense Amount</label>
                  <div className="flex items-center space-x-2">
                    <span className="font-black text-gray-400 text-xl">₹</span>
                    <input name="amount" type="number" required placeholder="0.00" className="w-full bg-transparent font-black text-2xl outline-none placeholder:text-gray-200" />
                  </div>
                </div>
                <div className="bg-gray-50 rounded-3xl p-5 border border-gray-100 focus-within:border-blue-500 transition-colors">
                  <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Narration</label>
                  <input name="description" placeholder="Petrol Pump Name, Bill No..." className="w-full bg-transparent font-bold text-sm outline-none placeholder:text-gray-300" />
                </div>
              </div>
              
              <div className="bg-blue-50 border-4 border-dashed border-blue-100 rounded-[2rem] p-10 text-center relative group active:bg-blue-100 transition-colors">
                <input type="file" className="hidden" id="receipt-upload" accept="image/*" capture="environment" required />
                <label htmlFor="receipt-upload" className="cursor-pointer flex flex-col items-center">
                  <div className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center text-white mb-4 shadow-xl group-active:scale-95 transition-transform"><i className="fas fa-camera-retro text-2xl"></i></div>
                  <p className="text-[11px] font-black text-blue-900 uppercase tracking-widest">Snapshot Invoice</p>
                  <p className="text-[9px] text-blue-400 font-bold mt-1 uppercase">Cloud Proof Required</p>
                </label>
              </div>

              <button type="submit" disabled={isUploading} className={`w-full ${isUploading ? 'bg-gray-400' : 'bg-gray-900'} text-white py-6 rounded-[1.5rem] font-black uppercase tracking-widest transition-all shadow-2xl shadow-gray-200 flex items-center justify-center space-x-3`}>
                {isUploading ? <><i className="fas fa-circle-notch fa-spin"></i><span>Syncing Data...</span></> : 'Submit Ledger'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverPortal;

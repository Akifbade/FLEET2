
import React, { useState, useEffect } from 'react';
import { Driver, Job, ReceiptEntry, JobStatus, FleetSettings, SyncSpeed, TripType, Location } from '../types';
import LiveMap from './LiveMap';
import FuelTracker from './FuelTracker';
import DriverPerformance from './DriverPerformance';
import { getPerformanceSummary } from '../services/geminiService';
import { fileToBase64 } from '../services/firebase';
import { GoogleGenAI } from "@google/genai";

interface AdminDashboardProps {
  drivers: Driver[];
  jobs: Job[];
  fuelEntries: ReceiptEntry[];
  fleetSettings: FleetSettings;
  onUpdateSyncSpeed: (speed: SyncSpeed) => void;
  onAddJob: (job: Job) => void;
  onAddDriver: (driver: Driver) => void;
  onUpdateDriver: (driver: Driver) => void;
  onDeleteDriver: (driverId: string) => void;
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Utility to determine real-time presence based on heartbeat
export const getEffectiveStatus = (driver: Driver): 'ONLINE' | 'OFFLINE' | 'ON_JOB' => {
  const HEARTBEAT_TIMEOUT = 60000; // 60 seconds
  if (!driver.lastSeen || (Date.now() - driver.lastSeen > HEARTBEAT_TIMEOUT)) {
    return 'OFFLINE';
  }
  return driver.status;
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  drivers, jobs, fuelEntries, fleetSettings, onUpdateSyncSpeed,
  onAddJob, onAddDriver, onUpdateDriver, onDeleteDriver 
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'MAP' | 'REPORTS' | 'DRIVERS' | 'AI'>('OVERVIEW');
  const [aiInsight, setAiInsight] = useState<string>('Analyzing fleet velocity and efficiency...');
  const [showJobModal, setShowJobModal] = useState(false);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [showEditDriverModal, setShowEditDriverModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedJobForRadar, setSelectedJobForRadar] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [addressMap, setAddressMap] = useState<Record<string, string>>({});

  const [newJob, setNewJob] = useState({ 
    origin: '', destination: '', driverId: '', description: '', 
    tripType: TripType.LOCAL_MOVE, attachmentUrl: '' 
  });
  const [newDriver, setNewDriver] = useState({ id: '', name: '', vehicleNo: '', password: '', phone: '' });
  const [editDriverData, setEditDriverData] = useState<Driver | null>(null);

  useEffect(() => {
    if (activeTab === 'AI') getPerformanceSummary(drivers, jobs, fuelEntries).then(setAiInsight);
  }, [activeTab, drivers, jobs, fuelEntries]);

  // Reverse geocoding for report addresses using Gemini
  useEffect(() => {
    const resolveAddresses = async () => {
      const coordsToResolve: string[] = [];
      jobs.filter(j => j.status === JobStatus.COMPLETED).forEach(j => {
        if (j.startLocation && !addressMap[`${j.startLocation.lat},${j.startLocation.lng}`]) {
          coordsToResolve.push(`${j.startLocation.lat},${j.startLocation.lng}`);
        }
        if (j.endLocation && !addressMap[`${j.endLocation.lat},${j.endLocation.lng}`]) {
          coordsToResolve.push(`${j.endLocation.lat},${j.endLocation.lng}`);
        }
      });

      if (coordsToResolve.length > 0) {
        try {
          const uniqueCoords = Array.from(new Set(coordsToResolve));
          const resp = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `For these coordinates, provide a short human-readable landmark or area name (max 3 words each) in English. Return as JSON object where key is the coordinate string: ${uniqueCoords.join(', ')}`,
            config: { responseMimeType: "application/json" }
          });
          const parsed = JSON.parse(resp.text || '{}');
          setAddressMap(prev => ({ ...prev, ...parsed }));
        } catch (e) { console.error("Geocode failed", e); }
      }
    };
    resolveAddresses();
  }, [jobs]);

  const activeMissions = jobs.filter(j => j.status === JobStatus.IN_PROGRESS);
  const completedJobs = jobs.filter(j => j.status === JobStatus.COMPLETED);
  const totalKm = completedJobs.reduce((acc, curr) => acc + (curr.distanceKm || 0), 0);
  const avgFleetSpeed = Math.round(completedJobs.reduce((acc, curr) => acc + (curr.avgSpeed || 0), 0) / (completedJobs.length || 1));

  const handleOpenEdit = () => {
    const driver = drivers.find(d => d.id === selectedDriverId);
    if (driver) {
      setEditDriverData({ ...driver });
      setShowEditDriverModal(true);
    }
  };

  const handleUpdateDriverSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editDriverData) {
      onUpdateDriver(editDriverData);
      setShowEditDriverModal(false);
    }
  };

  const selectedDriver = drivers.find(d => d.id === selectedDriverId);
  const driverJobs = selectedDriver ? jobs.filter(j => j.driverId === selectedDriver.id) : [];
  const driverTotalKm = driverJobs.filter(j => j.status === JobStatus.COMPLETED).reduce((acc, curr) => acc + (curr.distanceKm || 0), 0);
  const driverReceipts = selectedDriver ? fuelEntries.filter(r => r.driverId === selectedDriver.id) : [];

  const radarJob = jobs.find(j => j.id === selectedJobForRadar);
  const radarDriver = drivers.find(d => d.id === radarJob?.driverId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 gap-4">
        <div>
          <h2 className="font-black text-gray-900 text-3xl tracking-tighter uppercase">QGO Master Console</h2>
          <div className="flex items-center space-x-2 mt-1">
             <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
             <p className="text-[10px] text-emerald-600 font-black tracking-widest uppercase">Live Operational Status</p>
          </div>
        </div>
        <div className="flex space-x-2 w-full md:w-auto">
           <button onClick={() => setShowDriverModal(true)} className="flex-1 md:flex-none bg-gray-50 text-gray-800 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition border border-gray-200">Register Unit</button>
           <button onClick={() => setShowJobModal(true)} className="flex-1 md:flex-none bg-blue-600 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition flex items-center justify-center space-x-2">
             <i className="fas fa-plus"></i><span>Dispatch Cargo</span>
           </button>
        </div>
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Fleet', value: drivers.length, icon: 'fa-truck', color: 'bg-blue-50 text-blue-600' },
          { label: 'Total Odometer', value: `${totalKm.toFixed(1)} KM`, icon: 'fa-road', color: 'bg-indigo-50 text-indigo-600' },
          { label: 'Avg Fleet Speed', value: `${avgFleetSpeed} KM/H`, icon: 'fa-gauge-high', color: 'bg-orange-50 text-orange-600' },
          { label: 'Fuel Spend', value: `KWD ${fuelEntries.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}`, icon: 'fa-wallet', color: 'bg-rose-50 text-rose-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
            <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center text-sm mb-4`}><i className={`fas ${stat.icon}`}></i></div>
            <p className="text-gray-400 text-[9px] font-black uppercase tracking-widest">{stat.label}</p>
            <h3 className="text-2xl font-black text-gray-900 mt-1">{stat.value}</h3>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 bg-gray-100/50 p-1.5 rounded-3xl overflow-x-auto scrollbar-hide">
        {(['OVERVIEW', 'MAP', 'REPORTS', 'DRIVERS', 'AI'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-gray-900 shadow-md' : 'text-gray-400 hover:text-gray-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2 space-y-6">
              <DriverPerformance drivers={drivers} jobs={jobs} receipts={fuelEntries} onSelectDriver={setSelectedDriverId} />
              <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
                <h3 className="font-black text-gray-900 uppercase tracking-tight mb-4">Live Dispatch Feed</h3>
                <div className="space-y-4">
                  {jobs.slice(0, 5).map(job => (
                    <div key={job.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="flex items-center space-x-4">
                        <div className={`w-2 h-2 rounded-full ${job.status === JobStatus.IN_PROGRESS ? 'bg-emerald-500 animate-pulse' : job.status === JobStatus.PENDING ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                        <div>
                          <p className="text-xs font-black text-gray-900">{job.origin} → {job.destination}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase">{job.tripType} • {drivers.find(d => d.id === job.driverId)?.name}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                         <span className="text-[10px] font-black text-gray-500 uppercase">{job.status}</span>
                         {job.status === JobStatus.IN_PROGRESS && (
                           <button 
                             onClick={() => { setSelectedJobForRadar(job.id); setActiveTab('MAP'); }}
                             className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-100 hover:bg-emerald-600 hover:text-white transition"
                           >
                             Live Track
                           </button>
                         )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
           </div>
           <div className="space-y-6">
              <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm h-fit">
                <h3 className="font-black text-gray-900 uppercase tracking-tight text-xl mb-6">Terminal Settings</h3>
                <div className="space-y-4">
                   <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Update Frequency</p>
                   <div className="grid grid-cols-1 gap-3">
                     {(['FAST', 'MEDIUM', 'SLOW'] as SyncSpeed[]).map(speed => (
                       <button key={speed} onClick={() => onUpdateSyncSpeed(speed)} className={`w-full p-5 rounded-2xl border-2 text-left flex justify-between items-center transition-all ${fleetSettings.syncSpeed === speed ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-gray-50 border-gray-100 text-gray-500 hover:border-blue-200'}`}>
                         <span className="font-black uppercase text-[11px] tracking-widest">{speed} Mode</span>
                         {fleetSettings.syncSpeed === speed && <i className="fas fa-check-circle"></i>}
                       </button>
                     ))}
                   </div>
                </div>
              </div>
              <FuelTracker fuelEntries={fuelEntries} drivers={drivers} />
           </div>
        </div>
      )}

      {activeTab === 'MAP' && (
        <div className="h-[calc(100vh-320px)] md:h-[750px] min-h-[500px] bg-white rounded-[3rem] overflow-hidden border border-gray-100 shadow-inner relative">
          <LiveMap 
            drivers={drivers} 
            jobs={jobs}
            selectedJobId={selectedJobForRadar} 
            route={radarJob?.route || []}
          />
        </div>
      )}

      {activeTab === 'REPORTS' && (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden animate-in fade-in duration-500">
           <div className="p-8 border-b border-gray-100 bg-gray-50/50">
             <h3 className="font-black text-gray-900 uppercase tracking-tight">Enterprise Logistics Ledger</h3>
           </div>
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b border-gray-100">
                 <tr>
                   <th className="px-8 py-5">Job Details</th>
                   <th className="px-8 py-5 text-center">KM / Speed</th>
                   <th className="px-8 py-5">Timeline</th>
                   <th className="px-8 py-5 text-right">Route Replay</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {completedJobs.map(job => (
                   <tr key={job.id} className="hover:bg-blue-50/30 transition-colors">
                     <td className="px-8 py-6">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest">{job.tripType}</span>
                          <span className="font-black text-gray-900 text-xs">ID: {job.id}</span>
                        </div>
                        <p className="font-black text-gray-800 text-sm">
                          {job.origin} <i className="fas fa-arrow-right mx-2 text-gray-300"></i> {job.destination}
                        </p>
                        <p className="text-[10px] text-gray-400 font-bold mt-2 uppercase tracking-wider">{drivers.find(d => d.id === job.driverId)?.name}</p>
                     </td>
                     <td className="px-8 py-6 text-center">
                        <div className="flex flex-col space-y-1 items-center">
                          <span className="bg-blue-50 text-blue-600 px-6 py-2 rounded-full text-[10px] font-black border border-blue-100 shadow-sm">{job.distanceKm?.toFixed(2) || 0} KM</span>
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{job.avgSpeed || 0} KM/H AVG</span>
                        </div>
                     </td>
                     <td className="px-8 py-6">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest space-y-1">
                           <div className="flex justify-between w-32"><span>UP:</span> <span className="text-gray-900">{new Date(job.startTime!).toLocaleTimeString()}</span></div>
                           <div className="flex justify-between w-32"><span>OFF:</span> <span className="text-gray-900">{new Date(job.endTime!).toLocaleTimeString()}</span></div>
                        </div>
                     </td>
                     <td className="px-8 py-6 text-right">
                        <button 
                          onClick={() => { setSelectedJobForRadar(job.id); setActiveTab('MAP'); }}
                          className="bg-blue-600 text-white px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-lg shadow-blue-200 hover:bg-slate-900 transition"
                        >
                          View Replay
                        </button>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      )}

      {activeTab === 'DRIVERS' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {drivers.map(driver => {
            const effectiveStatus = getEffectiveStatus(driver);
            const dJobs = jobs.filter(j => j.driverId === driver.id && j.status === JobStatus.COMPLETED);
            const dKm = dJobs.reduce((acc, j) => acc + (j.distanceKm || 0), 0);
            return (
              <div key={driver.id} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-xl transition-all cursor-pointer" onClick={() => setSelectedDriverId(driver.id)}>
                <div className={`absolute top-0 right-0 w-3 h-full ${effectiveStatus === 'ONLINE' ? 'bg-emerald-500' : effectiveStatus === 'ON_JOB' ? 'bg-orange-500' : 'bg-gray-200'}`}></div>
                <h3 className="font-black text-gray-900 uppercase tracking-tight text-xl">{driver.name}</h3>
                <p className="text-blue-600 text-[10px] font-black uppercase tracking-widest mb-6">{driver.vehicleNo}</p>
                <div className="grid grid-cols-2 gap-3 mb-6">
                   <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-center">
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Odometer</p>
                      <p className="text-sm font-black text-gray-900">{dKm.toFixed(2)} KM</p>
                   </div>
                   <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-center">
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Successful</p>
                      <p className="text-sm font-black text-gray-900">{dJobs.length}</p>
                   </div>
                </div>
                <button className="w-full py-4 bg-gray-900 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-600 transition shadow-lg">Open Mission History</button>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'AI' && <div className="bg-white rounded-[2.5rem] p-12 border border-gray-100 text-gray-700 leading-relaxed text-lg font-medium whitespace-pre-wrap animate-in slide-in-from-bottom-4">{aiInsight}</div>}

      {/* REPLAY DOSSIER MODAL */}
      {selectedDriverId && selectedDriver && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[300] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-5xl rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-12 duration-500">
              <div className="p-10 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                 <div className="flex items-center space-x-6">
                    <div className="w-20 h-20 rounded-[2.5rem] bg-slate-900 text-white flex items-center justify-center text-4xl font-black shadow-2xl">
                       {selectedDriver.name.charAt(0)}
                    </div>
                    <div>
                       <h3 className="font-black text-gray-900 uppercase text-4xl tracking-tighter">{selectedDriver.name}</h3>
                       <p className="text-blue-600 font-black uppercase text-xs tracking-[0.2em]">{selectedDriver.vehicleNo} • Terminal Ref: {selectedDriver.id}</p>
                    </div>
                 </div>
                 <div className="flex items-center space-x-4">
                    <button onClick={handleOpenEdit} className="w-12 h-12 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 transition shadow-sm border border-gray-200">
                       <i className="fas fa-edit text-lg"></i>
                    </button>
                    <button onClick={() => setSelectedDriverId(null)} className="text-gray-300 hover:text-rose-500 transition text-5xl"><i className="fas fa-times-circle"></i></button>
                 </div>
              </div>
              
              <div className="flex-grow overflow-y-auto p-10 space-y-12 scrollbar-hide">
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                    {[
                       { label: 'Cumulative Dist', value: `${driverTotalKm.toFixed(2)} KM`, color: 'bg-blue-50 text-blue-600', sub: 'Real GPS Data' },
                       { label: 'Active Status', value: getEffectiveStatus(selectedDriver), color: 'bg-emerald-50 text-emerald-600', sub: 'Terminal Live' },
                       { label: 'Fuel Refills', value: fuelEntries.filter(f => f.driverId === selectedDriver.id && f.type === 'FUEL').length, color: 'bg-orange-50 text-orange-600', sub: 'Verified Proofs' },
                       { label: 'Avg Velocity', value: `${Math.round(driverJobs.reduce((acc, j) => acc + (j.avgSpeed || 0), 0) / (driverJobs.length || 1))} KM/H`, color: 'bg-indigo-50 text-indigo-600', sub: 'Mission Metric' },
                    ].map((s, i) => (
                       <div key={i} className={`${s.color} p-6 rounded-[2.5rem] border border-white shadow-sm`}>
                          <p className="text-[9px] font-black uppercase tracking-widest mb-1 opacity-70">{s.label}</p>
                          <h4 className="text-2xl font-black">{s.value}</h4>
                          <p className="text-[8px] font-bold uppercase mt-1 opacity-50">{s.sub}</p>
                       </div>
                    ))}
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 space-y-6">
                       <h5 className="font-black uppercase text-gray-900 tracking-tight text-xl px-2">Mission Replay Log</h5>
                       <div className="space-y-4">
                          {driverJobs.filter(j => j.status === JobStatus.COMPLETED).map(job => (
                             <div key={job.id} className="bg-white border-2 border-gray-50 p-8 rounded-[2.5rem] shadow-sm hover:border-blue-100 transition group relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500 opacity-20"></div>
                                <div className="flex justify-between items-start mb-6">
                                   <div>
                                      <p className="text-[10px] font-black text-blue-600 uppercase mb-2 tracking-widest">{job.tripType} • {new Date(job.endTime!).toLocaleDateString()}</p>
                                      <h4 className="text-2xl font-black text-gray-900 tracking-tight">{job.origin} <i className="fas fa-chevron-right text-gray-200 mx-2 text-sm"></i> {job.destination}</h4>
                                   </div>
                                   <div className="text-right">
                                      <p className="text-3xl font-black text-gray-900">{job.distanceKm?.toFixed(2) || '0.00'} <span className="text-sm text-gray-400">KM</span></p>
                                      <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-1">Status: Success</p>
                                   </div>
                                </div>
                                <button 
                                  onClick={() => { setSelectedJobForRadar(job.id); setSelectedDriverId(null); setActiveTab('MAP'); }}
                                  className="w-full mt-4 py-4 bg-gray-50 text-gray-900 text-[10px] font-black uppercase tracking-widest rounded-2xl border border-gray-100 hover:bg-blue-600 hover:text-white transition"
                                >
                                  Replay Route on Map
                                </button>
                             </div>
                          ))}
                       </div>
                    </div>

                    <div className="space-y-6">
                       <h5 className="font-black uppercase text-gray-900 tracking-tight text-xl px-2">Expense Ledger</h5>
                       <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-6 shadow-2xl h-fit">
                          <div className="flex justify-between items-center pb-4 border-b border-white/5">
                             <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Expenses</p>
                             <p className="text-xl font-black">KWD {driverReceipts.reduce((acc, r) => acc + r.amount, 0).toLocaleString()}</p>
                          </div>
                          <div className="space-y-4 max-h-[400px] overflow-y-auto scrollbar-hide">
                             {driverReceipts.map(r => (
                                <div key={r.id} className="flex justify-between items-center group">
                                   <div>
                                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">{r.type}</p>
                                      <p className="text-xs font-bold text-gray-400">{new Date(r.date).toLocaleDateString()}</p>
                                   </div>
                                   <div className="text-right">
                                      <p className="font-black">KWD {r.amount}</p>
                                      <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Verified</p>
                                   </div>
                                </div>
                             ))}
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
              
              <div className="p-10 bg-gray-900 text-white flex justify-between items-center">
                 <div className="flex space-x-12">
                    <div>
                       <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-2">Unit Passcode</p>
                       <p className="text-xl font-black tracking-[0.4em]">{selectedDriver.password}</p>
                    </div>
                 </div>
                 <button onClick={() => setShowDeleteConfirm(true)} className="bg-rose-600 text-white px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition shadow-2xl hover:bg-rose-700">Decommission Unit</button>
              </div>
           </div>
        </div>
      )}

      {/* DELETE CONFIRMATION */}
      {showDeleteConfirm && selectedDriver && (
        <div className="fixed inset-0 bg-rose-900/95 backdrop-blur-xl z-[400] flex items-center justify-center p-4">
           <div className="bg-white max-w-md w-full rounded-[3rem] p-10 text-center shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-[2.5rem] flex items-center justify-center text-3xl mx-auto mb-6 border border-rose-100">
                 <i className="fas fa-exclamation-triangle"></i>
              </div>
              <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight mb-2">Strict Deletion Warning</h3>
              <p className="text-gray-500 text-sm font-bold mb-8">Are you absolutely sure you want to decommission <span className="text-rose-600 font-black">{selectedDriver.name}</span>? This action is permanent and cannot be undone.</p>
              <div className="grid grid-cols-2 gap-4">
                 <button onClick={() => setShowDeleteConfirm(false)} className="py-4 rounded-2xl bg-gray-100 text-gray-900 font-black uppercase text-[10px] tracking-widest hover:bg-gray-200 transition">Cancel</button>
                 <button onClick={() => { 
                   onDeleteDriver(selectedDriver.id); 
                   setShowDeleteConfirm(false); 
                   setSelectedDriverId(null);
                 }} className="py-4 rounded-2xl bg-rose-600 text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-rose-200 hover:bg-rose-700 transition">Confirm Delete</button>
              </div>
           </div>
        </div>
      )}

      {/* EDIT DRIVER */}
      {showEditDriverModal && editDriverData && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[400] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[3rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-8">
            <div className="p-8 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-black text-gray-900 uppercase tracking-tight text-xl">Edit Carrier Profile</h3>
              <button onClick={() => setShowEditDriverModal(false)} className="text-gray-300 hover:text-rose-500 transition text-2xl"><i className="fas fa-times-circle"></i></button>
            </div>
            <form onSubmit={handleUpdateDriverSubmit} className="p-8 space-y-5">
              <div className="space-y-1">
                 <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Full Name</label>
                 <input required value={editDriverData.name} onChange={e => setEditDriverData({...editDriverData, name: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-1">
                 <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Vehicle Plate</label>
                 <input required value={editDriverData.vehicleNo} onChange={e => setEditDriverData({...editDriverData, vehicleNo: e.target.value.toUpperCase()})} className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none uppercase focus:border-blue-500" />
              </div>
              <div className="space-y-1">
                 <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Security PIN</label>
                 <input required value={editDriverData.password} onChange={e => setEditDriverData({...editDriverData, password: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-blue-500" />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-200 mt-4 active:scale-95 transition">Commit Updates</button>
            </form>
          </div>
        </div>
      )}

      {/* DISPATCH MODAL */}
      {showJobModal && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <h3 className="font-black text-gray-900 uppercase tracking-tighter text-2xl">Dispatch Console</h3>
              <button onClick={() => setShowJobModal(false)} className="text-gray-300 hover:text-rose-500 transition text-3xl"><i className="fas fa-times-circle"></i></button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              onAddJob({ id: `QG${Date.now().toString().slice(-6)}`, ...newJob, status: JobStatus.PENDING, assignedAt: new Date().toISOString() } as Job);
              setShowJobModal(false);
            }} className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <input required value={newJob.origin} onChange={e => setNewJob({...newJob, origin: e.target.value})} placeholder="Departure Hub" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none" />
                <input required value={newJob.destination} onChange={e => setNewJob({...newJob, destination: e.target.value})} placeholder="Arrival Terminal" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <select required value={newJob.tripType} onChange={e => setNewJob({...newJob, tripType: e.target.value as TripType})} className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-black outline-none appearance-none cursor-pointer">
                  {Object.values(TripType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select required value={newJob.driverId} onChange={e => setNewJob({...newJob, driverId: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-black outline-none appearance-none cursor-pointer">
                  <option value="">Select Carrier</option>
                  {drivers.map(d => <option key={d.id} value={d.id}>{d.name} ({d.vehicleNo})</option>)}
                </select>
              </div>
              <textarea value={newJob.description} onChange={e => setNewJob({...newJob, description: e.target.value})} placeholder="Shipment Narrative" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold h-24" />
              <button type="submit" disabled={isUploading} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl transition disabled:opacity-50">Confirm Dispatch</button>
            </form>
          </div>
        </div>
      )}

      {/* REGISTRATION MODAL */}
      {showDriverModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[3rem] overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-gray-100 bg-gray-50">
              <h3 className="font-black text-gray-900 uppercase tracking-tight text-2xl text-center">Unit Enrollment</h3>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              onAddDriver({ ...newDriver, status: 'OFFLINE' } as Driver);
              setShowDriverModal(false);
            }} className="p-8 space-y-5">
              <input required value={newDriver.name} onChange={e => setNewDriver({...newDriver, name: e.target.value})} placeholder="Driver Full Name" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none" />
              <input required value={newDriver.id} onChange={e => setNewDriver({...newDriver, id: e.target.value.toUpperCase()})} placeholder="Unit ID" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none uppercase" />
              <input required value={newDriver.vehicleNo} onChange={e => setNewDriver({...newDriver, vehicleNo: e.target.value.toUpperCase()})} placeholder="Plate Number" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none uppercase" />
              <input required value={newDriver.password} onChange={e => setNewDriver({...newDriver, password: e.target.value})} placeholder="Access PIN" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none" />
              <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl">Activate Unit</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

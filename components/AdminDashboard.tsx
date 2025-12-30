
import React, { useState, useEffect } from 'react';
import { Driver, Job, ReceiptEntry, JobStatus, FleetSettings, SyncSpeed, TripType } from '../types';
import LiveMap from './LiveMap';
import FuelTracker from './FuelTracker';
import DriverPerformance from './DriverPerformance';
import { getPerformanceSummary } from '../services/geminiService';
import { fileToBase64 } from '../services/firebase';

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

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  drivers, jobs, fuelEntries, fleetSettings, onUpdateSyncSpeed,
  onAddJob, onAddDriver, onUpdateDriver, onDeleteDriver 
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'MAP' | 'REPORTS' | 'DRIVERS' | 'AI'>('OVERVIEW');
  const [aiInsight, setAiInsight] = useState<string>('Analyzing fleet velocity and efficiency...');
  const [showJobModal, setShowJobModal] = useState(false);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [newJob, setNewJob] = useState({ 
    origin: '', destination: '', driverId: '', description: '', 
    tripType: TripType.LOCAL_MOVE, attachmentUrl: '' 
  });
  const [newDriver, setNewDriver] = useState({ id: '', name: '', vehicleNo: '', password: '', phone: '' });

  useEffect(() => {
    if (activeTab === 'AI') getPerformanceSummary(drivers, jobs, fuelEntries).then(setAiInsight);
  }, [activeTab, drivers, jobs, fuelEntries]);

  const completedJobs = jobs.filter(j => j.status === JobStatus.COMPLETED);
  const totalKm = completedJobs.reduce((acc, curr) => acc + (curr.distanceKm || 0), 0);
  const avgFleetSpeed = Math.round(completedJobs.reduce((acc, curr) => acc + (curr.avgSpeed || 0), 0) / (completedJobs.length || 1));

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsUploading(true);
      const base64 = await fileToBase64(e.target.files[0]);
      setNewJob({ ...newJob, attachmentUrl: base64 });
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Header */}
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

      {/* Analytics High-Density Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Fleet', value: drivers.length, icon: 'fa-truck', color: 'bg-blue-50 text-blue-600' },
          { label: 'Total Odometer', value: `${totalKm} KM`, icon: 'fa-road', color: 'bg-indigo-50 text-indigo-600' },
          { label: 'Avg Fleet Speed', value: `${avgFleetSpeed} KM/H`, icon: 'fa-gauge-high', color: 'bg-orange-50 text-orange-600' },
          { label: 'Fuel Spend', value: `₹${fuelEntries.reduce((acc, curr) => acc + curr.amount, 0)}`, icon: 'fa-wallet', color: 'bg-rose-50 text-rose-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
            <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center text-sm mb-4`}><i className={`fas ${stat.icon}`}></i></div>
            <p className="text-gray-400 text-[9px] font-black uppercase tracking-widest">{stat.label}</p>
            <h3 className="text-2xl font-black text-gray-900 mt-1">{stat.value}</h3>
          </div>
        ))}
      </div>

      {/* Professional Navigation Tabs */}
      <div className="flex space-x-2 bg-gray-100/50 p-1.5 rounded-3xl overflow-x-auto scrollbar-hide">
        {(['OVERVIEW', 'MAP', 'REPORTS', 'DRIVERS', 'AI'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-gray-900 shadow-md' : 'text-gray-400 hover:text-gray-700'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Main Content Areas */}
      {activeTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2"><DriverPerformance drivers={drivers} jobs={jobs} receipts={fuelEntries} /></div>
           <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-8 h-fit">
              <h3 className="font-black text-gray-900 uppercase tracking-tight text-xl">Terminal Settings</h3>
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
              <div className="pt-6 border-t border-gray-100">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4">Driver Interface Access</p>
                <div className="bg-slate-900 text-blue-400 p-4 rounded-xl font-mono text-[10px] break-all border border-white/10 mb-4">{window.location.href}</div>
                <button onClick={() => { navigator.clipboard.writeText(window.location.href); }} className="w-full bg-blue-50 text-blue-600 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition">Copy Terminal Link</button>
              </div>
           </div>
        </div>
      )}

      {activeTab === 'MAP' && <div className="h-[650px] bg-white rounded-[3rem] overflow-hidden border border-gray-100 shadow-inner"><LiveMap drivers={drivers} /></div>}

      {activeTab === 'REPORTS' && (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden animate-in fade-in duration-500">
           <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
             <div>
               <h3 className="font-black text-gray-900 uppercase tracking-tight">Enterprise Logistics Ledger</h3>
               <p className="text-[9px] text-gray-400 font-bold uppercase mt-1 tracking-widest">Digital Proof of Deliveries</p>
             </div>
             <button className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest">Download master log</button>
           </div>
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 border-b border-gray-100">
                 <tr>
                   <th className="px-8 py-5">Job Details</th>
                   <th className="px-8 py-5 text-center">KM / Speed</th>
                   <th className="px-8 py-5">Coordinates</th>
                   <th className="px-8 py-5">Timeline</th>
                   <th className="px-8 py-5 text-right">Manifest</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {completedJobs.length === 0 ? (
                    <tr><td colSpan={5} className="py-20 text-center text-gray-300 font-black uppercase text-sm italic">No completed records yet</td></tr>
                 ) : completedJobs.map(job => (
                   <tr key={job.id} className="hover:bg-blue-50/30 transition-colors">
                     <td className="px-8 py-6">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest">{job.tripType}</span>
                          <span className="font-black text-gray-900 text-xs">ID: {job.id}</span>
                        </div>
                        <p className="font-black text-gray-800 text-sm">{job.origin} <i className="fas fa-arrow-right mx-2 text-gray-300"></i> {job.destination}</p>
                        <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-wider">{drivers.find(d => d.id === job.driverId)?.name}</p>
                     </td>
                     <td className="px-8 py-6 text-center">
                        <div className="flex flex-col space-y-1">
                          <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full text-[10px] font-black border border-indigo-100">{job.distanceKm || 0} KM</span>
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{job.avgSpeed || 0} KM/H AVG</span>
                        </div>
                     </td>
                     <td className="px-8 py-6">
                        <div className="space-y-1.5">
                           <div className="flex items-center space-x-2 text-[9px] font-black text-emerald-600 uppercase">
                             <i className="fas fa-location-dot"></i>
                             <span>S: {job.startLocation?.lat.toFixed(4)}, {job.startLocation?.lng.toFixed(4)}</span>
                           </div>
                           <div className="flex items-center space-x-2 text-[9px] font-black text-rose-500 uppercase">
                             <i className="fas fa-location-arrow"></i>
                             <span>E: {job.endLocation?.lat.toFixed(4)}, {job.endLocation?.lng.toFixed(4)}</span>
                           </div>
                        </div>
                     </td>
                     <td className="px-8 py-6">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-relaxed">
                           <div>UP: {new Date(job.startTime!).toLocaleTimeString()}</div>
                           <div>OFF: {new Date(job.endTime!).toLocaleTimeString()}</div>
                        </div>
                     </td>
                     <td className="px-8 py-6 text-right">
                        {job.attachmentUrl ? (
                          <a href={job.attachmentUrl} target="_blank" className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white transition shadow-sm border border-blue-100 mx-auto">
                            <i className="fas fa-file-pdf"></i>
                          </a>
                        ) : <span className="text-[9px] font-black text-gray-300 uppercase italic">N/A</span>}
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
          {drivers.map(driver => (
            <div key={driver.id} className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-xl transition-all">
              <div className={`absolute top-0 right-0 w-3 h-full ${driver.status === 'ONLINE' ? 'bg-emerald-500' : driver.status === 'ON_JOB' ? 'bg-orange-500' : 'bg-gray-200'}`}></div>
              <h3 className="font-black text-gray-900 uppercase tracking-tight text-xl">{driver.name}</h3>
              <p className="text-blue-600 text-[10px] font-black uppercase tracking-widest mb-6">{driver.vehicleNo}</p>
              <div className="bg-gray-50 p-5 rounded-2xl mb-6 space-y-3 border border-gray-100">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest border-b border-gray-200 pb-2">Unit Credentials</p>
                <div className="flex justify-between text-xs font-black"><span>ID</span><span className="text-gray-900">{driver.id}</span></div>
                <div className="flex justify-between text-xs font-black"><span>PIN</span><span className="text-gray-900">{driver.password}</span></div>
              </div>
              <button onClick={() => onDeleteDriver(driver.id)} className="w-full py-4 bg-rose-50 text-rose-600 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-600 hover:text-white transition">Decommission Unit</button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'AI' && <div className="bg-white rounded-[2.5rem] p-12 border border-gray-100 text-gray-700 leading-relaxed text-lg font-medium whitespace-pre-wrap animate-in slide-in-from-bottom-4">{aiInsight}</div>}

      {/* Professional Job Dispatch Modal */}
      {showJobModal && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <div>
                 <h3 className="font-black text-gray-900 uppercase tracking-tighter text-2xl">Dispatch Console</h3>
                 <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">Assign New Shipment Task</p>
              </div>
              <button onClick={() => setShowJobModal(false)} className="text-gray-300 hover:text-rose-500 transition text-3xl"><i className="fas fa-times-circle"></i></button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              onAddJob({ id: `QG${Date.now().toString().slice(-6)}`, ...newJob, status: JobStatus.PENDING, assignedAt: new Date().toISOString() } as Job);
              setShowJobModal(false);
            }} className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">Departure Hub</label>
                   <input required value={newJob.origin} onChange={e => setNewJob({...newJob, origin: e.target.value})} placeholder="Location Name" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-4 ring-blue-500/10 transition" />
                </div>
                <div className="space-y-2">
                   <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">Arrival Terminal</label>
                   <input required value={newJob.destination} onChange={e => setNewJob({...newJob, destination: e.target.value})} placeholder="Location Name" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none focus:ring-4 ring-blue-500/10 transition" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                   <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">Service Type</label>
                   <select required value={newJob.tripType} onChange={e => setNewJob({...newJob, tripType: e.target.value as TripType})} className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-black outline-none appearance-none cursor-pointer">
                     {Object.values(TripType).map(t => <option key={t} value={t}>{t}</option>)}
                   </select>
                </div>
                <div className="space-y-2">
                   <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">Unit Assignment</label>
                   <select required value={newJob.driverId} onChange={e => setNewJob({...newJob, driverId: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-black outline-none appearance-none cursor-pointer">
                     <option value="">Select Carrier</option>
                     {drivers.map(d => <option key={d.id} value={d.id}>{d.name} ({d.vehicleNo})</option>)}
                   </select>
                </div>
              </div>
              <div className="space-y-2">
                 <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-2">Shipment Narratives</label>
                 <textarea value={newJob.description} onChange={e => setNewJob({...newJob, description: e.target.value})} placeholder="Load details, safety instructions, special requirements..." className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none h-24 resize-none" />
              </div>
              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center group hover:bg-blue-50/50 hover:border-blue-200 transition-all relative">
                <input type="file" onChange={handleFileChange} className="hidden" id="job-attach" />
                <label htmlFor="job-attach" className="cursor-pointer flex flex-col items-center">
                  <i className={`fas ${isUploading ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'} text-2xl text-blue-500 mb-2`}></i>
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{newJob.attachmentUrl ? 'Digital Copy Secured ✓' : 'Attach Manifest (PDF/IMG)'}</span>
                </label>
              </div>
              <button type="submit" disabled={isUploading} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition disabled:opacity-50">Confirm Dispatch</button>
            </form>
          </div>
        </div>
      )}

      {/* Driver Modal */}
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
              <input required value={newDriver.id} onChange={e => setNewDriver({...newDriver, id: e.target.value.toUpperCase()})} placeholder="Unit ID (e.g. QG-101)" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none uppercase" />
              <input required value={newDriver.vehicleNo} onChange={e => setNewDriver({...newDriver, vehicleNo: e.target.value.toUpperCase()})} placeholder="Plate Number" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none uppercase" />
              <input required value={newDriver.password} onChange={e => setNewDriver({...newDriver, password: e.target.value})} placeholder="Terminal Access PIN (4-Digits)" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none" />
              <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl">Activate Unit</button>
              <button type="button" onClick={() => setShowDriverModal(false)} className="w-full text-[10px] font-black text-gray-400 uppercase tracking-widest">Abort</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

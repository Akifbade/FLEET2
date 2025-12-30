
import React, { useState, useEffect } from 'react';
import { Driver, Job, ReceiptEntry, JobStatus, FleetSettings, SyncSpeed } from '../types';
import LiveMap from './LiveMap';
import FuelTracker from './FuelTracker';
import DriverPerformance from './DriverPerformance';
import { getPerformanceSummary } from '../services/geminiService';
import { isConfigured } from '../services/firebase';

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
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'MAP' | 'REPORTS' | 'RECEPTS' | 'DRIVERS' | 'AI'>('OVERVIEW');
  const [aiInsight, setAiInsight] = useState<string>('Generating operational insights...');
  const [showJobModal, setShowJobModal] = useState(false);
  const [showDriverModal, setShowDriverModal] = useState(false);
  
  const [newJob, setNewJob] = useState({ origin: '', destination: '', driverId: '', description: '' });
  const [newDriver, setNewDriver] = useState({ id: '', name: '', vehicleNo: '', password: '', phone: '' });

  useEffect(() => {
    if (activeTab === 'AI') {
      getPerformanceSummary(drivers, jobs, fuelEntries).then(setAiInsight);
    }
  }, [activeTab, drivers, jobs, fuelEntries]);

  const completedJobs = jobs.filter(j => j.status === JobStatus.COMPLETED);
  const totalKm = completedJobs.reduce((acc, curr) => acc + (curr.distanceKm || 0), 0);
  const avgFleetSpeed = Math.round(completedJobs.reduce((acc, curr) => acc + (curr.avgSpeed || 0), 0) / (completedJobs.length || 1));

  const stats = [
    { label: 'Fleet Size', value: drivers.length, icon: 'fa-truck', color: 'text-blue-600' },
    { label: 'Total Distance', value: `${totalKm} KM`, icon: 'fa-road', color: 'text-indigo-500' },
    { label: 'Fleet Spends', value: `₹${fuelEntries.reduce((acc, curr) => acc + curr.amount, 0)}`, icon: 'fa-wallet', color: 'text-red-500' },
    { label: 'Avg Speed', value: `${avgFleetSpeed} KM/H`, icon: 'fa-gauge-high', color: 'text-orange-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white"><i className="fas fa-truck-ramp-box"></i></div>
          <div>
            <h2 className="font-black text-gray-900 tracking-tight uppercase">Fleet Hub</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Analytics Terminal</p>
          </div>
        </div>
        <div className="flex space-x-2">
           <button onClick={() => setShowDriverModal(true)} className="bg-gray-100 text-gray-800 px-4 py-3 rounded-2xl text-[10px] font-black uppercase hover:bg-gray-200 transition">Add Driver</button>
           <button onClick={() => setShowJobModal(true)} className="bg-gray-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-blue-600 transition">New Job</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
            <div className={`text-xl ${stat.color} bg-gray-50 rounded-xl p-3`}><i className={`fas ${stat.icon}`}></i></div>
            <div>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-wider">{stat.label}</p>
              <h3 className="text-xl font-black text-gray-900">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="flex border-b border-gray-200 overflow-x-auto whitespace-nowrap scrollbar-hide mb-6">
        {(['OVERVIEW', 'MAP', 'REPORTS', 'RECEPTS', 'DRIVERS', 'AI'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-6 py-4 font-black text-[10px] uppercase tracking-[0.15em] transition-all border-b-2 ${activeTab === tab ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-400 hover:text-gray-900'}`}>
            <i className={`fas ${tab === 'OVERVIEW' ? 'fa-list-ul' : tab === 'MAP' ? 'fa-satellite' : tab === 'REPORTS' ? 'fa-chart-line' : tab === 'RECEPTS' ? 'fa-file-invoice' : tab === 'DRIVERS' ? 'fa-users-cog' : 'fa-brain'} mr-2`}></i>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-[2.5rem] p-8 text-white shadow-xl">
               <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center text-xl shadow-lg"><i className="fas fa-satellite-dish"></i></div>
                  <div><h3 className="text-lg font-black uppercase tracking-tight">Fleet Controls</h3><p className="text-blue-300 text-[10px] font-bold uppercase mt-1">Update Frequency</p></div>
               </div>
               <div className="grid grid-cols-3 gap-3">
                  {(['FAST', 'MEDIUM', 'SLOW'] as SyncSpeed[]).map((speed) => (
                    <button key={speed} onClick={() => onUpdateSyncSpeed(speed)} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center ${fleetSettings.syncSpeed === speed ? 'bg-blue-600 border-white' : 'bg-white/5 border-white/10'}`}>
                      <span className="text-[10px] font-black uppercase tracking-widest">{speed}</span>
                    </button>
                  ))}
               </div>
            </div>
            <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm">
               <h3 className="font-black text-gray-900 uppercase tracking-tight text-xl mb-2">Driver Link</h3>
               <p className="text-gray-500 text-sm mb-6 leading-relaxed">Share terminal URL for driver logins.</p>
               <div className="flex-1 bg-gray-50 p-4 rounded-2xl border border-gray-100 text-[10px] font-mono mb-4">{window.location.href}</div>
               <button onClick={() => { navigator.clipboard.writeText(window.location.href); alert("Link Copied!"); }} className="w-full bg-blue-600 text-white p-4 rounded-2xl font-black uppercase tracking-widest">Copy Link</button>
            </div>
          </div>
          <DriverPerformance drivers={drivers} jobs={jobs} receipts={fuelEntries} />
        </div>
      )}

      {activeTab === 'REPORTS' && (
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
           <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <div>
                <h3 className="font-black text-gray-800 uppercase tracking-tight text-xs">Trip Performance Reports</h3>
                <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">Detailed Log of Completed Assignments</p>
              </div>
              <button className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase border border-blue-100">Export CSV</button>
           </div>
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400">
                 <tr>
                   <th className="px-8 py-4">Trip Details</th>
                   <th className="px-8 py-4">Driver</th>
                   <th className="px-8 py-4 text-center">KM covered</th>
                   <th className="px-8 py-4 text-center">Avg Speed</th>
                   <th className="px-8 py-4 text-center">Duration</th>
                   <th className="px-8 py-4">Timeline</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100">
                 {completedJobs.length === 0 ? (
                   <tr><td colSpan={6} className="p-20 text-center text-gray-400 font-black uppercase text-xs italic">No trip reports available yet</td></tr>
                 ) : completedJobs.map(job => {
                    const start = job.startTime ? new Date(job.startTime) : null;
                    const end = job.endTime ? new Date(job.endTime) : null;
                    const durationMins = start && end ? Math.round((end.getTime() - start.getTime()) / (1000 * 60)) : 0;
                    return (
                      <tr key={job.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="px-8 py-6">
                          <p className="font-black text-gray-900 text-sm">{job.origin} → {job.destination}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">ID: {job.id}</p>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs"><i className="fas fa-user"></i></div>
                            <p className="font-bold text-gray-700">{drivers.find(d => d.id === job.driverId)?.name || 'Deleted User'}</p>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-center">
                          <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full text-xs font-black border border-indigo-100">{job.distanceKm || 0} KM</span>
                        </td>
                        <td className="px-8 py-6 text-center">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-black border ${
                            (job.avgSpeed || 0) > 60 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          }`}>
                            {job.avgSpeed || 0} KM/H
                          </span>
                        </td>
                        <td className="px-8 py-6 text-center">
                          <p className="font-black text-gray-700 text-sm">{Math.floor(durationMins / 60)}h {durationMins % 60}m</p>
                        </td>
                        <td className="px-8 py-6">
                           <div className="space-y-1">
                             <div className="flex items-center space-x-2 text-[9px] font-black text-gray-400 uppercase"><i className="fas fa-play text-emerald-500"></i> <span>{start?.toLocaleTimeString() || '--'}</span></div>
                             <div className="flex items-center space-x-2 text-[9px] font-black text-gray-400 uppercase"><i className="fas fa-stop text-red-500"></i> <span>{end?.toLocaleTimeString() || '--'}</span></div>
                           </div>
                        </td>
                      </tr>
                    )
                 })}
               </tbody>
             </table>
           </div>
        </div>
      )}

      {activeTab === 'MAP' && <div className="bg-white rounded-[2.5rem] h-[600px] overflow-hidden border border-gray-100"><LiveMap drivers={drivers} /></div>}
      {activeTab === 'RECEPTS' && <FuelTracker fuelEntries={fuelEntries} drivers={drivers} />}
      {activeTab === 'DRIVERS' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {drivers.map(driver => (
            <div key={driver.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group">
              <div className={`absolute top-0 right-0 w-2 h-full ${driver.status === 'ONLINE' ? 'bg-green-500' : driver.status === 'ON_JOB' ? 'bg-orange-500' : 'bg-gray-300'}`}></div>
              <h3 className="font-black text-gray-900 uppercase tracking-tight">{driver.name}</h3>
              <p className="text-blue-600 text-[10px] font-black uppercase mb-4">{driver.vehicleNo}</p>
              <div className="bg-gray-50 p-3 rounded-xl mb-4 text-[11px] font-mono">
                <p>Login ID: <span className="text-gray-900 font-bold">{driver.id}</span></p>
                <p>PIN: <span className="text-gray-900 font-bold">{driver.password}</span></p>
              </div>
              <button onClick={() => onDeleteDriver(driver.id)} className="w-full py-2 bg-red-50 text-[10px] font-black uppercase rounded-lg text-red-500 hover:bg-red-500 hover:text-white transition">Delete Driver</button>
            </div>
          ))}
        </div>
      )}
      {activeTab === 'AI' && <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 text-gray-600 leading-loose text-lg font-medium whitespace-pre-wrap">{aiInsight}</div>}
      
      {/* Modals for Job and Driver addition */}
      {showJobModal && (
        <div className="fixed inset-0 bg-gray-900/90 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-black text-gray-900 uppercase tracking-tight text-xl">Dispatch Job</h3>
              <button onClick={() => setShowJobModal(false)} className="text-gray-300 hover:text-red-500 transition text-2xl"><i className="fas fa-times-circle"></i></button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              onAddJob({ id: `J${Date.now()}`, ...newJob, status: JobStatus.PENDING, assignedAt: new Date().toISOString() } as Job);
              setShowJobModal(false);
            }} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <input required value={newJob.origin} onChange={e => setNewJob({...newJob, origin: e.target.value})} placeholder="Origin" className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none" />
                <input required value={newJob.destination} onChange={e => setNewJob({...newJob, destination: e.target.value})} placeholder="Destination" className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none" />
              </div>
              <select required value={newJob.driverId} onChange={e => setNewJob({...newJob, driverId: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none appearance-none">
                <option value="">Select a Driver</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name} ({d.vehicleNo})</option>)}
              </select>
              <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest">Create Assignment</button>
            </form>
          </div>
        </div>
      )}

      {showDriverModal && (
        <div className="fixed inset-0 bg-gray-900/90 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-black text-gray-900 uppercase tracking-tight text-xl">Register Driver</h3>
              <button onClick={() => setShowDriverModal(false)} className="text-gray-300 hover:text-red-500 transition text-2xl"><i className="fas fa-times-circle"></i></button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              onAddDriver({ ...newDriver, status: 'OFFLINE' } as Driver);
              setShowDriverModal(false);
            }} className="p-8 space-y-6">
              <input required value={newDriver.name} onChange={e => setNewDriver({...newDriver, name: e.target.value})} placeholder="Full Name" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none" />
              <input required value={newDriver.id} onChange={e => setNewDriver({...newDriver, id: e.target.value.toUpperCase()})} placeholder="Driver ID" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none uppercase" />
              <input required value={newDriver.vehicleNo} onChange={e => setNewDriver({...newDriver, vehicleNo: e.target.value.toUpperCase()})} placeholder="Vehicle Number" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none uppercase" />
              <input required value={newDriver.password} onChange={e => setNewDriver({...newDriver, password: e.target.value})} placeholder="4-Digit PIN" className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm font-bold outline-none" />
              <button type="submit" className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest">Save Driver</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

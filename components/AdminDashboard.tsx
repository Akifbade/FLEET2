
import React, { useState, useEffect } from 'react';
import { Driver, Job, ReceiptEntry, JobStatus } from '../types';
import LiveMap from './LiveMap';
import FuelTracker from './FuelTracker';
import DriverPerformance from './DriverPerformance';
import { getPerformanceSummary } from '../services/geminiService';
import { isConfigured } from '../services/firebase';

interface AdminDashboardProps {
  drivers: Driver[];
  jobs: Job[];
  fuelEntries: ReceiptEntry[];
  onAddJob: (job: Job) => void;
  onAddDriver: (driver: Driver) => void;
  onUpdateDriver: (driver: Driver) => void;
  onDeleteDriver: (driverId: string) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  drivers, jobs, fuelEntries, onAddJob, onAddDriver, onUpdateDriver, onDeleteDriver 
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'MAP' | 'RECEPTS' | 'DRIVERS' | 'AI' | 'DEPLOY'>('OVERVIEW');
  const [aiInsight, setAiInsight] = useState<string>('Generating operational insights...');
  const [showJobModal, setShowJobModal] = useState(false);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [deletingDriver, setDeletingDriver] = useState<Driver | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  useEffect(() => {
    if (activeTab === 'AI') {
      getPerformanceSummary(drivers, jobs, fuelEntries).then(setAiInsight);
    }
  }, [activeTab, drivers, jobs, fuelEntries]);

  const stats = [
    { label: 'Fleet Size', value: drivers.length, icon: 'fa-truck', color: 'text-blue-600' },
    { label: 'Live Trips', value: jobs.filter(j => j.status === JobStatus.IN_PROGRESS).length, icon: 'fa-route', color: 'text-orange-500' },
    { label: 'Total Spends', value: `₹${fuelEntries.reduce((acc, curr) => acc + curr.amount, 0)}`, icon: 'fa-wallet', color: 'text-red-500' },
    { label: 'Cloud Status', value: isConfigured ? 'LIVE' : 'DEMO', icon: 'fa-cloud', color: isConfigured ? 'text-green-500' : 'text-gray-400' },
  ];

  const getCleanUrl = () => {
    let url = window.location.href.split('?')[0].split('#')[0];
    if (url.endsWith('index.html')) url = url.replace('index.html', '');
    return url.replace(/\/$/, "");
  };

  const copyAppURL = () => {
    const url = getCleanUrl();
    navigator.clipboard.writeText(url);
    alert("✅ Link Copied!\n" + url);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white">
            <i className="fas fa-truck-ramp-box"></i>
          </div>
          <div>
            <h2 className="font-black text-gray-900 tracking-tight uppercase">Fleet Hub</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">QGO Logistics Intelligence</p>
          </div>
        </div>
        <div className="flex space-x-2">
           <button onClick={() => setShowDriverModal(true)} className="bg-gray-100 text-gray-800 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition">
            <i className="fas fa-user-plus mr-2 text-blue-600"></i> Add Driver
          </button>
          <button onClick={() => setShowJobModal(true)} className="bg-gray-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition shadow-xl shadow-gray-200">
            <i className="fas fa-plus-circle mr-2 text-blue-400"></i> New Job
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
            <div className={`text-xl ${stat.color} bg-gray-50 rounded-xl p-3 border border-gray-100`}>
              <i className={`fas ${stat.icon}`}></i>
            </div>
            <div>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-wider">{stat.label}</p>
              <h3 className="text-xl font-black text-gray-900">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="flex border-b border-gray-200 overflow-x-auto whitespace-nowrap scrollbar-hide mb-6">
        {(['OVERVIEW', 'MAP', 'RECEPTS', 'DRIVERS', 'AI', 'DEPLOY'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-4 font-black text-[10px] uppercase tracking-[0.15em] transition-all border-b-2 ${
              activeTab === tab 
                ? 'border-blue-600 text-blue-600 bg-blue-50/50' 
                : 'border-transparent text-gray-400 hover:text-gray-900'
            }`}
          >
            <i className={`fas ${
              tab === 'OVERVIEW' ? 'fa-list-ul' :
              tab === 'MAP' ? 'fa-satellite' :
              tab === 'RECEPTS' ? 'fa-file-invoice' :
              tab === 'DRIVERS' ? 'fa-users-cog' : 
              tab === 'AI' ? 'fa-brain' : 'fa-rocket'
            } mr-2`}></i>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-700 to-indigo-900 rounded-[2.5rem] p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between">
             <div className="flex items-center space-x-6">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl border border-white/20 backdrop-blur-md">
                   <i className="fas fa-link"></i>
                </div>
                <div>
                   <h3 className="text-xl font-black uppercase tracking-tight">Driver Portal Link</h3>
                   <p className="text-blue-100 text-xs font-bold">Share with your drivers on WhatsApp</p>
                </div>
             </div>
             <button onClick={copyAppURL} className="bg-white text-blue-800 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-gray-100 transition mt-4 md:mt-0">
               Copy URL
             </button>
          </div>
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
             <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                <h3 className="font-black text-gray-800 uppercase tracking-tight text-xs">Active Deployments</h3>
             </div>
             <div className="p-10 text-center text-gray-400 italic font-medium">Use the tabs above to manage Fleet</div>
          </div>
        </div>
      )}

      {activeTab === 'MAP' && <div className="bg-white rounded-[2.5rem] h-[600px] overflow-hidden border border-gray-100"><LiveMap drivers={drivers} /></div>}
      {activeTab === 'RECEPTS' && <FuelTracker fuelEntries={fuelEntries} drivers={drivers} />}
      {activeTab === 'DEPLOY' && (
        <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 space-y-10 animate-in slide-in-from-bottom-8 max-w-5xl mx-auto">
           <div className="flex items-center space-x-6">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl shadow-2xl">
                 <i className="fas fa-rocket"></i>
              </div>
              <div>
                 <h2 className="text-3xl font-black text-gray-900 uppercase tracking-tight">GitHub + Vercel Guide</h2>
                 <p className="text-blue-600 text-xs font-black uppercase tracking-widest">Aapka GitHub pehle se connected hai!</p>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-8">
                 <h3 className="font-black text-gray-900 uppercase text-lg border-l-4 border-blue-600 pl-4">Step 1: GitHub pe Upload</h3>
                 <div className="space-y-4">
                    <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                       <p className="text-[10px] font-black text-blue-600 uppercase mb-2">1. Create Repo</p>
                       <p className="text-sm font-bold text-gray-700"><a href="https://github.com/new" target="_blank" className="underline">GitHub.com/new</a> par jayein aur "qgo-fleet" naam ka project banayein.</p>
                    </div>
                    <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                       <p className="text-[10px] font-black text-blue-600 uppercase mb-2">2. Upload Files</p>
                       <p className="text-sm font-bold text-gray-700">Meri di hui saari files wahan "Upload" button se daal dein aur "Commit" kar dein.</p>
                    </div>
                 </div>
              </div>

              <div className="space-y-8">
                 <h3 className="font-black text-gray-900 uppercase text-lg border-l-4 border-emerald-500 pl-4">Step 2: Vercel par Import</h3>
                 <div className="space-y-4">
                    <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100">
                       <p className="text-[10px] font-black text-emerald-600 uppercase mb-2">3. Refresh Vercel</p>
                       <p className="text-sm font-bold text-gray-700">Jo screen aapne photo mein bheji hai, use Refresh karein. Wahan list mein "qgo-fleet" aa jayega.</p>
                    </div>
                    <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100">
                       <p className="text-[10px] font-black text-emerald-600 uppercase mb-2">4. Click Import</p>
                       <p className="text-sm font-bold text-gray-700">"Import" par click karke "Deploy" daba dein. Aapka server link 1 minute mein ready!</p>
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-orange-50 p-8 rounded-[2rem] border border-orange-100">
              <h4 className="font-black text-orange-900 uppercase text-xs mb-3">Zaroori Information</h4>
              <p className="text-sm text-orange-800 font-medium">
                Vercel par deploy hone ke baad <b>Settings -> Environment Variables</b> mein jakar <code>API_KEY</code> zaroor daal dena, warna AI (Gemini) kaam nahi karega.
              </p>
           </div>
        </div>
      )}

      {activeTab === 'AI' && <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 text-gray-600 leading-loose text-lg font-medium whitespace-pre-wrap">{aiInsight}</div>}
      {activeTab === 'DRIVERS' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {drivers.map(driver => (
            <div key={driver.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
              <h3 className="font-black text-gray-900 uppercase tracking-tight">{driver.name}</h3>
              <p className="text-blue-600 text-[10px] font-black uppercase mb-4">{driver.vehicleNo}</p>
              <div className="bg-gray-50 p-3 rounded-xl mb-4 text-[11px] font-mono">
                <p>Login ID: <span className="text-gray-900 font-bold">{driver.id}</span></p>
                <p>PIN: <span className="text-gray-900 font-bold">{driver.password}</span></p>
              </div>
              <div className="flex space-x-2">
                <button onClick={() => setEditingDriver(driver)} className="flex-1 py-2 bg-gray-50 text-[10px] font-black uppercase rounded-lg">Edit</button>
                <button onClick={() => onDeleteDriver(driver.id)} className="flex-1 py-2 bg-gray-50 text-[10px] font-black uppercase rounded-lg text-red-500">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

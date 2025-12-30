
import React, { useState } from 'react';
import { ViewMode, Driver } from '../types';

interface LoginProps {
  onLogin: (role: ViewMode, id?: string) => void;
  drivers: Driver[];
  logoUrl: string;
}

const Login: React.FC<LoginProps> = ({ onLogin, drivers, logoUrl }) => {
  const [role, setRole] = useState<ViewMode | null>(null);
  const [driverId, setDriverId] = useState('');
  const [driverPin, setDriverPin] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');

  // DEFAULT ADMIN PASSWORD: qgoadmin
  const ADMIN_PASSCODE = 'qgoadmin';

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === ADMIN_PASSCODE) {
      onLogin('ADMIN');
    } else {
      setError('Incorrect Admin Passcode');
    }
  };

  const handleDriverSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = driverId.trim().toUpperCase();
    const found = drivers.find(d => 
      d.id.toUpperCase() === cleanId || 
      d.vehicleNo.toUpperCase() === cleanId
    );
    
    if (found) {
      if (found.password === driverPin) {
        onLogin('DRIVER', found.id);
      } else {
        setError('Incorrect Security PIN');
      }
    } else {
      setError('Invalid Driver ID or Vehicle Number');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-blue-600 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-indigo-600 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-md z-10 space-y-8">
        <div className="text-center space-y-4">
          <img src={logoUrl} alt="QGO Logo" className="h-20 mx-auto" />
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">QGO CARGO</h1>
            <p className="text-gray-500 font-bold uppercase tracking-[0.3em] text-[10px]">Fleet Intelligence Portal</p>
          </div>
        </div>

        {!role ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button 
              onClick={() => { setRole('ADMIN'); setError(''); }}
              className="w-full bg-white/5 border border-white/10 p-6 rounded-3xl text-left hover:bg-white/10 transition group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-xl">
                    <i className="fas fa-shield-alt"></i>
                  </div>
                  <div>
                    <h3 className="text-white font-black text-lg">Admin Login</h3>
                    <p className="text-gray-500 text-xs">Manage fleet, jobs & accounts</p>
                  </div>
                </div>
                <i className="fas fa-chevron-right text-gray-700 group-hover:text-blue-500 transition"></i>
              </div>
            </button>

            <button 
              onClick={() => { setRole('DRIVER'); setError(''); }}
              className="w-full bg-white/5 border border-white/10 p-6 rounded-3xl text-left hover:bg-white/10 transition group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center text-white text-xl">
                    <i className="fas fa-truck"></i>
                  </div>
                  <div>
                    <h3 className="text-white font-black text-lg">Driver Access</h3>
                    <p className="text-gray-500 text-xs">Secure trip & fuel terminal</p>
                  </div>
                </div>
                <i className="fas fa-chevron-right text-gray-700 group-hover:text-orange-500 transition"></i>
              </div>
            </button>
          </div>
        ) : role === 'ADMIN' ? (
          <form onSubmit={handleAdminSubmit} className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] space-y-6 backdrop-blur-xl animate-in zoom-in-95 duration-300">
            <div className="text-center">
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Control Center</h2>
              <p className="text-gray-500 text-xs font-bold">Authentication Required</p>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <input 
                  type="password" 
                  autoFocus
                  value={passcode}
                  onChange={(e) => { setPasscode(e.target.value); setError(''); }}
                  placeholder="Admin Passcode" 
                  className="w-full bg-white/10 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none focus:border-blue-500 transition text-center" 
                />
                <i className="fas fa-lock absolute right-5 top-5 text-white/20"></i>
              </div>
              {error && <p className="text-red-500 text-[10px] font-black uppercase text-center tracking-widest">{error}</p>}
              <button 
                type="submit"
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition"
              >
                Unlock Terminal
              </button>
              <button type="button" onClick={() => setRole(null)} className="w-full text-gray-500 text-xs font-bold uppercase hover:text-white transition">Back to selection</button>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">Default Passcode: qgoadmin</p>
            </div>
          </form>
        ) : (
          <form onSubmit={handleDriverSubmit} className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] space-y-5 backdrop-blur-xl animate-in zoom-in-95 duration-300">
            <div className="text-center">
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Driver Secure Login</h2>
              <p className="text-gray-500 text-xs font-bold">Verification Required</p>
            </div>
            <div className="space-y-4">
              <div className="relative">
                <input 
                  autoFocus
                  value={driverId}
                  onChange={(e) => { setDriverId(e.target.value); setError(''); }}
                  placeholder="Access ID (e.g. QGO-123)" 
                  className="w-full bg-white/10 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none focus:border-orange-500 transition uppercase text-center" 
                />
                <i className="fas fa-id-card absolute right-5 top-5 text-white/20"></i>
              </div>
              <div className="relative">
                <input 
                  type="password"
                  inputMode="numeric"
                  value={driverPin}
                  onChange={(e) => { setDriverPin(e.target.value); setError(''); }}
                  placeholder="Security PIN" 
                  className="w-full bg-white/10 border border-white/10 rounded-2xl p-4 text-white font-bold outline-none focus:border-orange-500 transition text-center" 
                />
                <i className="fas fa-key absolute right-5 top-5 text-white/20"></i>
              </div>
              {error && <p className="text-red-500 text-[10px] font-black uppercase text-center tracking-widest">{error}</p>}
              <button 
                type="submit"
                className="w-full bg-orange-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-orange-900/20 active:scale-95 transition"
              >
                Log In Securely
              </button>
              <button type="button" onClick={() => setRole(null)} className="w-full text-gray-500 text-xs font-bold uppercase hover:text-white transition">Back to selection</button>
            </div>
          </form>
        )}

        <div className="text-center pt-8">
          <p className="text-gray-600 text-[10px] font-black uppercase tracking-widest">Powered by QGO Logistics Core v2.5</p>
        </div>
      </div>
    </div>
  );
};

export default Login;

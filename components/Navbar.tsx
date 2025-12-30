
import React from 'react';
import { ViewMode } from '../types';

interface NavbarProps {
  user: { role: ViewMode; id?: string };
  onLogout: () => void;
  logoUrl: string;
}

const Navbar: React.FC<NavbarProps> = ({ user, onLogout, logoUrl }) => {
  return (
    <nav className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img src={logoUrl} alt="QGO Logo" className="h-10 w-auto" />
          <div className="hidden md:block">
            <span className="text-lg font-black text-gray-900 tracking-tight block leading-none">QGO CARGO</span>
            <span className="text-[8px] font-black text-blue-600 uppercase tracking-widest">{user.role} INTERFACE</span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3 pr-4 border-r border-gray-200">
             <div className="text-right hidden sm:block">
               <p className="text-xs font-black text-gray-900">{user.role === 'ADMIN' ? 'Fleet Manager' : `Driver ${user.id}`}</p>
               <p className="text-[10px] text-green-500 font-bold uppercase">System Online</p>
             </div>
             <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
               <i className={`fas ${user.role === 'ADMIN' ? 'fa-user-tie' : 'fa-id-card'}`}></i>
             </div>
          </div>
          
          <button 
            onClick={onLogout}
            className="text-gray-400 hover:text-red-600 transition p-2"
            title="Logout"
          >
            <i className="fas fa-sign-out-alt text-lg"></i>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

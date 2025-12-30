
import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-100 border-t border-gray-200 py-6 mt-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex items-center space-x-2">
            <img src="http://qgocargo.com/logo.png" alt="QGO Logo" className="h-6 grayscale opacity-60" />
            <p className="text-xs text-gray-500 font-medium tracking-widest uppercase">
              QGO CARGO FLEET MANAGEMENT SYSTEMS
            </p>
          </div>
          
          <div className="flex space-x-6">
            <a href="#" className="text-xs text-gray-400 hover:text-blue-600 transition">Privacy Policy</a>
            <a href="#" className="text-xs text-gray-400 hover:text-blue-600 transition">Support Center</a>
            <a href="#" className="text-xs text-gray-400 hover:text-blue-600 transition">API Documentation</a>
          </div>

          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} QGO Global Logistics. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

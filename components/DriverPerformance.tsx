
import React from 'react';
import { Driver, Job, ReceiptEntry, JobStatus } from '../types';

interface DriverPerformanceProps {
  drivers: Driver[];
  jobs: Job[];
  receipts: ReceiptEntry[];
}

const DriverPerformance: React.FC<DriverPerformanceProps> = ({ drivers, jobs, receipts }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {drivers.map(driver => {
        const driverJobs = jobs.filter(j => j.driverId === driver.id);
        const completedJobs = driverJobs.filter(j => j.status === JobStatus.COMPLETED);
        const driverReceipts = receipts.filter(r => r.driverId === driver.id);
        const fuelSpend = driverReceipts.filter(r => r.type === 'FUEL').reduce((acc, r) => acc + r.amount, 0);
        const maintenanceSpend = driverReceipts.filter(r => r.type === 'MAINTENANCE').reduce((acc, r) => acc + r.amount, 0);
        
        // Mock rating logic
        const rating = completedJobs.length > 5 ? 'Excellent' : completedJobs.length > 2 ? 'Good' : 'New';
        
        return (
          <div key={driver.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col hover:shadow-md transition">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-black">
                  {driver.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-black text-gray-800">{driver.name}</h4>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{driver.vehicleNo}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${
                rating === 'Excellent' ? 'bg-green-100 text-green-700' :
                rating === 'Good' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {rating}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 p-3 rounded-xl">
                <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Total Trips</p>
                <p className="text-xl font-black text-gray-800">{driverJobs.length}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl">
                <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Completion</p>
                <p className="text-xl font-black text-gray-800">
                  {driverJobs.length > 0 ? Math.round((completedJobs.length / driverJobs.length) * 100) : 0}%
                </p>
              </div>
            </div>

            <div className="space-y-3 flex-grow">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 font-bold flex items-center">
                  <i className="fas fa-gas-pump w-5 text-orange-500"></i> Fuel Cost
                </span>
                <span className="font-black text-gray-800">₹{fuelSpend}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 font-bold flex items-center">
                  <i className="fas fa-tools w-5 text-red-500"></i> Maintenance
                </span>
                <span className="font-black text-gray-800">₹{maintenanceSpend}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-t border-dashed border-gray-200 pt-3">
                <span className="text-gray-700 font-black">Total Efficiency</span>
                <span className="font-black text-blue-600">High</span>
              </div>
            </div>

            <button className="mt-6 w-full py-3 bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-600 rounded-xl font-bold text-xs transition border border-gray-100">
              View Detailed History
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default DriverPerformance;

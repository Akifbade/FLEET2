
import React, { useState } from 'react';
import { ReceiptEntry, Driver } from '../types';

interface FuelTrackerProps {
  fuelEntries: ReceiptEntry[];
  drivers: Driver[];
}

const FuelTracker: React.FC<FuelTrackerProps> = ({ fuelEntries, drivers }) => {
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptEntry | null>(null);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
             <h3 className="font-black text-gray-800 uppercase tracking-tight">Financial Proofs</h3>
             <span className="text-[10px] font-black bg-blue-100 text-blue-600 px-2 py-1 rounded">Real-time Cloud Sync</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-black">
                <tr>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Driver</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm font-medium">
                {fuelEntries.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${
                        entry.type === 'FUEL' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                      }`}>{entry.type}</span>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900">{drivers.find(d => d.id === entry.driverId)?.name}</td>
                    <td className="px-6 py-4 font-black text-blue-700">KWD {entry.amount.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <button onClick={() => setSelectedReceipt(entry)} className="text-blue-600 hover:text-blue-800 font-bold text-xs bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                        View Proof
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedReceipt && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in duration-300">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-black text-gray-800 uppercase">Verification Hub</h3>
              <button onClick={() => setSelectedReceipt(null)} className="text-gray-400 hover:text-red-500"><i className="fas fa-times-circle text-2xl"></i></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="aspect-[3/4] bg-gray-100 rounded-2xl flex items-center justify-center border border-gray-200 overflow-hidden">
                {selectedReceipt.invoiceUrl && selectedReceipt.invoiceUrl.startsWith('data:image') ? (
                   <img src={selectedReceipt.invoiceUrl} alt="Invoice" className="w-full h-full object-contain" />
                ) : (
                   <div className="text-center p-10"><i className="fas fa-file-image text-gray-300 text-5xl mb-3"></i><p className="text-gray-400 font-bold uppercase text-xs">No cloud image data</p></div>
                )}
              </div>
              <div className="bg-gray-50 p-5 rounded-2xl flex justify-between">
                <div><p className="text-[10px] font-black text-gray-400 uppercase">Amount</p><p className="text-2xl font-black text-blue-700">KWD {selectedReceipt.amount.toLocaleString()}</p></div>
                <div className="text-right"><p className="text-[10px] font-black text-gray-400 uppercase">Type</p><p className="text-lg font-black text-gray-800">{selectedReceipt.type}</p></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FuelTracker;

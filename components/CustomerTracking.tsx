
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { Job, Driver, JobStatus } from '../types';
import { db } from '../services/firebase';
import { doc, onSnapshot, DocumentSnapshot } from 'firebase/firestore';
import { Package, MapPin, Truck, Clock, Navigation } from 'lucide-react';

// Custom icons for the map
const truckIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/1048/1048314.png',
  iconSize: [35, 35],
  iconAnchor: [17, 17],
});

const originIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/447/447031.png',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

const destIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
});

interface CustomerTrackingProps {
  jobId: string;
}

const CustomerTracking: React.FC<CustomerTrackingProps> = ({ jobId }) => {
  const [job, setJob] = useState<Job | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      setError("Database connection not available.");
      setLoading(false);
      return;
    }

    const unsubJob = onSnapshot(doc(db, "jobs", jobId), (snap: DocumentSnapshot) => {
      if (snap.exists()) {
        const jobData = { ...snap.data(), id: snap.id } as Job;
        setJob(jobData);
        
        // Once we have the job, listen to the driver's location
        const unsubDriver = onSnapshot(doc(db, "drivers", jobData.driverId), (dSnap: DocumentSnapshot) => {
          if (dSnap.exists()) {
            setDriver({ ...dSnap.data(), id: dSnap.id } as Driver);
          }
          setLoading(false);
        });

        return () => unsubDriver();
      } else {
        setError("Job not found or invalid tracking ID.");
        setLoading(false);
      }
    });

    return () => unsubJob();
  }, [jobId]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 font-medium">Locating your shipment...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tracking Error</h1>
          <p className="text-gray-600 mb-6">{error || "We couldn't find the shipment you're looking for."}</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const isMoving = job.status === JobStatus.IN_PROGRESS;
  const currentLocation = driver?.lastKnownLocation;

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <Truck className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-black text-lg tracking-tight text-gray-900">QGO TRACK</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Live Shipment Tracking</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-400 font-bold uppercase">Order ID</p>
          <p className="font-mono font-bold text-blue-600">#{job.id.slice(-8).toUpperCase()}</p>
        </div>
      </header>

      <div className="flex-grow relative flex flex-col md:flex-row">
        {/* Map Section */}
        <div className="flex-grow h-[50vh] md:h-auto relative">
          <MapContainer 
            center={currentLocation ? [currentLocation.lat, currentLocation.lng] : [20.5937, 78.9629]} 
            zoom={13} 
            className="h-full w-full"
          >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
            
            {/* Origin */}
            {job.startLocation && (
              <Marker position={[job.startLocation.lat, job.startLocation.lng]} icon={originIcon}>
                <Popup>Origin: {job.origin}</Popup>
              </Marker>
            )}

            {/* Destination (Mocking a location if not set for visual) */}
            {job.endLocation && (
              <Marker position={[job.endLocation.lat, job.endLocation.lng]} icon={destIcon}>
                <Popup>Destination: {job.destination}</Popup>
              </Marker>
            )}

            {/* Driver/Truck */}
            {currentLocation && (
              <Marker position={[currentLocation.lat, currentLocation.lng]} icon={truckIcon}>
                <Popup>
                  <div className="p-2">
                    <p className="font-bold">{driver?.name}</p>
                    <p className="text-xs text-gray-500">{driver?.vehicleNo}</p>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Route Line */}
            {job.route && job.route.length > 1 && (
              <Polyline 
                positions={job.route.map(p => [p.lat, p.lng])} 
                color="#2563eb" 
                weight={4} 
                opacity={0.6} 
                dashArray="10, 10"
              />
            )}
          </MapContainer>

          {/* Status Overlay */}
          <div className="absolute top-4 left-4 right-4 md:left-auto md:w-80 z-[1000]">
            <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white">
              <div className="flex items-center justify-between mb-4">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                  job.status === JobStatus.COMPLETED ? 'bg-emerald-100 text-emerald-700' :
                  job.status === JobStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-700 animate-pulse' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {job.status.replace('_', ' ')}
                </span>
                {isMoving && (
                  <div className="flex items-center gap-1 text-emerald-600">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                    <span className="text-[10px] font-bold uppercase">Live</span>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                    <div className="w-0.5 h-10 bg-gray-200 my-1"></div>
                    <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                  </div>
                  <div className="flex-grow">
                    <div className="mb-4">
                      <p className="text-[10px] text-gray-400 font-bold uppercase">From</p>
                      <p className="text-sm font-bold text-gray-800">{job.origin}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">To</p>
                      <p className="text-sm font-bold text-gray-800">{job.destination}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info Sidebar */}
        <div className="w-full md:w-96 bg-white p-6 overflow-y-auto shadow-2xl z-10">
          <h2 className="text-xl font-black text-gray-900 mb-6">Shipment Details</h2>
          
          <div className="space-y-6">
            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-2xl">
              <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                <Package className="text-blue-600 w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Cargo Type</p>
                <p className="font-bold text-gray-800">{job.tripType}</p>
                <p className="text-xs text-gray-500 mt-1">{job.description}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-2xl">
              <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                <Truck className="text-blue-600 w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Vehicle Info</p>
                <p className="font-bold text-gray-800">{driver?.vehicleNo || 'Assigning...'}</p>
                <p className="text-xs text-gray-500 mt-1">Driver: {driver?.name || '---'}</p>
              </div>
            </div>

            {job.distanceKm && (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <p className="text-[10px] text-blue-400 font-bold uppercase">Distance</p>
                  <p className="text-xl font-black text-blue-700">{job.distanceKm} <span className="text-xs">KM</span></p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <p className="text-[10px] text-emerald-400 font-bold uppercase">Avg Speed</p>
                  <p className="text-xl font-black text-emerald-700">{job.avgSpeed || 0} <span className="text-xs">KM/H</span></p>
                </div>
              </div>
            )}

            <div className="pt-6 border-t">
              <p className="text-[10px] text-gray-400 font-bold uppercase mb-4">Timeline</p>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-800">Dispatched</p>
                    <p className="text-[10px] text-gray-500">{new Date(job.assignedAt).toLocaleString()}</p>
                  </div>
                </div>
                {job.startTime && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                      <Navigation className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-800">In Transit</p>
                      <p className="text-[10px] text-gray-500">{new Date(job.startTime).toLocaleString()}</p>
                    </div>
                  </div>
                )}
                {job.endTime && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-800">Delivered</p>
                      <p className="text-[10px] text-gray-500">{new Date(job.endTime).toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerTracking;

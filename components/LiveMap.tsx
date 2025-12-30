
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Driver, Location, JobStatus, Job } from '../types';
import { getEffectiveStatus } from './AdminDashboard';

interface LiveMapProps {
  drivers: Driver[];
  jobs: Job[];
  selectedJobId?: string | null;
  route?: Location[];
}

const LiveMap: React.FC<LiveMapProps> = ({ drivers, jobs, selectedJobId, route = [] }) => {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const replayMarkerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const userMarkerRef = useRef<L.CircleMarker | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Map & Interaction States
  const [isLocked, setIsLocked] = useState(false);
  const [lockedTargetId, setLockedTargetId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true); 
  const [activeTab, setActiveTab] = useState<'DRIVERS' | 'MISSIONS'>('DRIVERS');

  // Replay System States
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playbackIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      center: [29.3759, 47.9774], // Center of Kuwait
      zoom: 12,
      zoomControl: false,
      attributionControl: false
    });

    // Clean, high-clarity map style
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{y}/{x}{r}.png', {
      maxZoom: 19,
    }).addTo(mapRef.current);

    // Initial Fit to Drivers
    const validDrivers = drivers.filter(d => d.lastKnownLocation);
    if (validDrivers.length > 0) {
      const bounds = L.latLngBounds(validDrivers.map(d => [d.lastKnownLocation!.lat, d.lastKnownLocation!.lng]));
      mapRef.current.fitBounds(bounds, { padding: [100, 100], maxZoom: 15 });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const locateUser = () => {
    if (!mapRef.current) return;
    mapRef.current.locate({ setView: true, maxZoom: 17 });
    mapRef.current.once('locationfound', (e) => {
      if (userMarkerRef.current) userMarkerRef.current.remove();
      userMarkerRef.current = L.circleMarker(e.latlng, {
        radius: 8, fillColor: '#2563eb', color: '#fff', weight: 4, opacity: 1, fillOpacity: 0.9
      }).addTo(mapRef.current!);
    });
  };

  // Replay Logic
  useEffect(() => {
    if (selectedJobId && route && route.length > 0) {
      setReplayIndex(0);
      setIsReplaying(false);
      setShowSidebar(false); // Hide sidebar during replay
      if (polylineRef.current) polylineRef.current.remove();
      
      const latlngs = route.map(loc => [loc.lat, loc.lng] as L.LatLngExpression);
      polylineRef.current = L.polyline(latlngs, {
        color: '#10b981', weight: 5, opacity: 1, lineJoin: 'round', lineCap: 'round'
      }).addTo(mapRef.current!);

      mapRef.current?.fitBounds(polylineRef.current.getBounds(), { padding: [100, 100] });
    } else {
      if (polylineRef.current) polylineRef.current.remove();
      if (replayMarkerRef.current) replayMarkerRef.current.remove();
      setReplayIndex(0);
      setIsReplaying(false);
    }
  }, [selectedJobId, route]);

  useEffect(() => {
    if (isReplaying && route.length > 0) {
      playbackIntervalRef.current = window.setInterval(() => {
        setReplayIndex(prev => {
          if (prev >= route.length - 1) {
            setIsReplaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000 / (playbackSpeed * 3));
    } else {
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    }
    return () => { if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current); };
  }, [isReplaying, route, playbackSpeed]);

  useEffect(() => {
    if (selectedJobId && route[replayIndex]) {
      const point = route[replayIndex];
      const latLng: L.LatLngExpression = [point.lat, point.lng];
      if (!replayMarkerRef.current) {
        replayMarkerRef.current = L.marker(latLng, {
          icon: L.divIcon({ 
            html: `
              <div class="relative flex flex-col items-center">
                <div class="w-10 h-10 rounded-full bg-emerald-500 border-4 border-white shadow-2xl flex items-center justify-center text-white">
                  <i class="fas fa-truck text-sm"></i>
                </div>
              </div>
            `,
            className: 'custom-div-icon', iconSize: [40, 40], iconAnchor: [20, 20] 
          })
        }).addTo(mapRef.current!);
      } else {
        replayMarkerRef.current.setLatLng(latLng);
      }
      if (isLocked) mapRef.current?.setView(latLng);
    }
  }, [replayIndex, selectedJobId, isLocked]);

  // Live Tracking Logic
  useEffect(() => {
    if (!mapRef.current || selectedJobId) return;

    drivers.forEach(driver => {
      if (!driver.lastKnownLocation) return;
      const latLng: L.LatLngExpression = [driver.lastKnownLocation.lat, driver.lastKnownLocation.lng];
      const effectiveStatus = getEffectiveStatus(driver);

      const iconHtml = `
        <div class="relative flex flex-col items-center group">
          <div class="w-12 h-12 rounded-[1.25rem] flex items-center justify-center text-white border-4 border-white transition-all shadow-[0_10px_20px_rgba(0,0,0,0.2)] ${
            effectiveStatus === 'ON_JOB' ? 'bg-emerald-600 animate-pulse' : 
            effectiveStatus === 'ONLINE' ? 'bg-blue-600' : 'bg-gray-500'
          }">
            <i class="fas ${effectiveStatus === 'ON_JOB' ? 'fa-truck-fast' : 'fa-truck'} text-base"></i>
          </div>
          <div class="mt-1 px-3 py-1 bg-slate-900 rounded-lg text-[9px] font-black text-white uppercase border border-white/20 shadow-lg">
            ${driver.vehicleNo}
          </div>
        </div>
      `;

      if (markersRef.current[driver.id]) {
        markersRef.current[driver.id].setLatLng(latLng);
        markersRef.current[driver.id].setIcon(L.divIcon({
          html: iconHtml, className: 'custom-div-icon', iconSize: [48, 48], iconAnchor: [24, 24]
        }));
      } else {
        const marker = L.marker(latLng, {
          icon: L.divIcon({
            html: iconHtml, className: 'custom-div-icon', iconSize: [48, 48], iconAnchor: [24, 24]
          })
        }).addTo(mapRef.current!);
        
        marker.on('click', () => {
          focusOnDriver(driver);
        });
        
        markersRef.current[driver.id] = marker;
      }

      if (isLocked && lockedTargetId === driver.id) {
        mapRef.current?.setView(latLng, 17, { animate: true });
      }
    });
  }, [drivers, selectedJobId, isLocked, lockedTargetId]);

  const focusOnDriver = (driver: Driver) => {
    if (!driver.lastKnownLocation || !mapRef.current) return;
    setIsLocked(true);
    setLockedTargetId(driver.id);
    mapRef.current.setView([driver.lastKnownLocation.lat, driver.lastKnownLocation.lng], 17, { animate: true });
    if (window.innerWidth < 768) setShowSidebar(false);
  };

  const activeMissions = jobs.filter(j => j.status === JobStatus.IN_PROGRESS);

  return (
    <div className="w-full h-full relative overflow-hidden bg-white">
      {/* Map Element */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Controls */}
      <div className="absolute top-6 left-6 z-[1000] flex flex-col space-y-3">
        <button onClick={() => setShowSidebar(!showSidebar)} className="w-12 h-12 bg-slate-900 text-white rounded-[1.25rem] flex items-center justify-center shadow-2xl border border-white/10 hover:bg-blue-600 transition active:scale-95">
          <i className={`fas ${showSidebar ? 'fa-indent' : 'fa-list-ul'}`}></i>
        </button>
        <button onClick={locateUser} className="w-12 h-12 bg-white text-slate-900 rounded-[1.25rem] flex items-center justify-center shadow-2xl border border-gray-100 hover:bg-gray-50 transition active:scale-95">
          <i className="fas fa-location-crosshairs text-lg"></i>
        </button>
        <button onClick={() => { setIsLocked(false); setLockedTargetId(null); }} className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center shadow-2xl border transition active:scale-95 ${isLocked ? 'bg-blue-600 text-white border-blue-400' : 'bg-white text-gray-400 border-gray-200'}`}>
          <i className={`fas ${isLocked ? 'fa-lock' : 'fa-lock-open'}`}></i>
        </button>
      </div>

      {/* Side Panel (Based on Screenshot 1) */}
      {showSidebar && !selectedJobId && (
        <div className="absolute top-6 right-6 bottom-6 z-[1000] w-[340px] hidden md:flex flex-col animate-in slide-in-from-right-12">
          <div className="bg-white/95 backdrop-blur-xl rounded-[3rem] border border-gray-100 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] flex flex-col h-full overflow-hidden">
            <div className="p-4 flex bg-gray-50/80 border-b border-gray-100">
              <button 
                onClick={() => setActiveTab('DRIVERS')} 
                className={`flex-1 py-4 rounded-3xl font-black text-[11px] uppercase tracking-widest transition-all duration-300 ${activeTab === 'DRIVERS' ? 'bg-slate-900 text-white shadow-xl translate-y-[-2px]' : 'text-gray-400 hover:text-gray-900'}`}
              >
                Units
              </button>
              <button 
                onClick={() => setActiveTab('MISSIONS')} 
                className={`flex-1 py-4 rounded-3xl font-black text-[11px] uppercase tracking-widest transition-all duration-300 ${activeTab === 'MISSIONS' ? 'bg-slate-900 text-white shadow-xl translate-y-[-2px]' : 'text-gray-400 hover:text-gray-900'}`}
              >
                Missions
              </button>
            </div>

            <div className="flex-grow overflow-y-auto scrollbar-hide p-6 space-y-4">
              {activeTab === 'DRIVERS' ? (
                drivers.map(d => {
                  const effectiveStatus = getEffectiveStatus(d);
                  return (
                    <div 
                      key={d.id} 
                      onClick={() => focusOnDriver(d)} 
                      className={`group p-6 rounded-[2rem] border-2 transition-all cursor-pointer ${lockedTargetId === d.id ? 'bg-white border-blue-500 shadow-xl' : 'bg-white border-transparent hover:border-gray-100 hover:shadow-lg shadow-sm border-gray-50'}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-black text-slate-900 uppercase tracking-tight text-base">{d.name}</span>
                        <div className={`w-2.5 h-2.5 rounded-full ${effectiveStatus === 'ON_JOB' ? 'bg-emerald-500 animate-pulse' : effectiveStatus === 'ONLINE' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{d.vehicleNo}</span>
                        <span className="text-[11px] font-black text-slate-900">{Math.round(d.lastKnownLocation?.speed || 0)} KM/H</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                activeMissions.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4"><i className="fas fa-truck-fast text-gray-300 text-2xl"></i></div>
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">No live tasks</p>
                  </div>
                ) : (
                  activeMissions.map(m => (
                    <div key={m.id} onClick={() => {
                      const d = drivers.find(d => d.id === m.driverId);
                      if (d) focusOnDriver(d);
                    }} className="p-6 rounded-[2rem] bg-emerald-50 border-2 border-emerald-100 hover:border-emerald-300 transition-all cursor-pointer shadow-sm">
                      <div className="flex justify-between mb-4">
                        <span className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.3em]">{m.tripType}</span>
                        <span className="text-[9px] font-black text-emerald-900/30">ID: {m.id}</span>
                      </div>
                      <p className="text-slate-900 font-black text-base leading-tight mb-2">{m.origin} → {m.destination}</p>
                      <p className="text-[10px] font-black text-emerald-600/80 uppercase tracking-wider">Unit: {drivers.find(d => d.id === m.driverId)?.vehicleNo}</p>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Replay HUD (Based on Screenshot 2) */}
      {selectedJobId && route.length > 0 && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1100] w-full max-w-2xl px-6 animate-in slide-in-from-bottom-20">
          <div className="bg-slate-900/95 backdrop-blur-3xl rounded-[3.5rem] p-10 border border-white/10 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)]">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h4 className="text-white text-2xl font-black tracking-tighter uppercase">Dossier Analysis</h4>
                <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] mt-1">{route.length} Recorded Checkpoints</p>
              </div>
              <div className="flex space-x-2">
                {[1, 2, 4].map(s => (
                  <button key={s} onClick={() => setPlaybackSpeed(s)} className={`px-4 py-2 rounded-xl text-[10px] font-black transition ${playbackSpeed === s ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}>{s}X</button>
                ))}
              </div>
            </div>

            <div className="relative h-2 bg-white/10 rounded-full mb-10 cursor-pointer group" onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setReplayIndex(Math.floor(((e.clientX - rect.left) / rect.width) * (route.length - 1)));
            }}>
              <div className="absolute top-0 left-0 h-full bg-emerald-500 rounded-full shadow-[0_0_25px_rgba(16,185,129,0.8)] transition-all duration-300" style={{ width: `${(replayIndex / (route.length - 1)) * 100}%` }}></div>
            </div>

            <div className="flex justify-center items-center space-x-10">
              <button onClick={() => setReplayIndex(Math.max(0, replayIndex - 10))} className="w-16 h-16 rounded-[2rem] bg-white/5 text-gray-400 hover:text-white transition border border-white/5 text-xl active:scale-90"><i className="fas fa-backward-step"></i></button>
              <button onClick={() => setIsReplaying(!isReplaying)} className="w-24 h-24 rounded-[2.5rem] bg-white text-slate-950 text-4xl flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition">
                <i className={`fas ${isReplaying ? 'fa-pause' : 'fa-play'}`}></i>
              </button>
              <button onClick={() => setReplayIndex(Math.min(route.length - 1, replayIndex + 10))} className="w-16 h-16 rounded-[2rem] bg-white/5 text-gray-400 hover:text-white transition border border-white/5 text-xl active:scale-90"><i className="fas fa-forward-step"></i></button>
            </div>

            <div className="mt-10 flex justify-between text-[10px] font-black text-gray-500 uppercase tracking-widest border-t border-white/5 pt-6">
              <div className="flex items-center space-x-3">
                 <i className="fas fa-clock text-blue-500"></i>
                 <span>{new Date(route[replayIndex].timestamp || 0).toLocaleTimeString()}</span>
              </div>
              <div className="text-emerald-500 font-black tracking-[0.2em] animate-pulse">Telemetry Sync v2.5</div>
              <div className="flex items-center space-x-3">
                 <span className="text-white">{Math.round(route[replayIndex].speed || 0)} KM/H</span>
                 <i className="fas fa-gauge-high text-blue-500"></i>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveMap;

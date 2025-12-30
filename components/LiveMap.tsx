
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
  const [showSidebar, setShowSidebar] = useState(false); 
  const [activeTab, setActiveTab] = useState<'DRIVERS' | 'MISSIONS'>('DRIVERS');

  // Replay System States
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playbackIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Show sidebar by default on larger screens
    if (window.innerWidth >= 768) {
      setShowSidebar(true);
    }

    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      center: [29.3759, 47.9774], // Center of Kuwait
      zoom: 11,
      zoomControl: false,
      attributionControl: false
    });

    // High Clarity Voyager Map
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{y}/{x}{r}.png', {
      maxZoom: 19,
      attribution: 'QGO Cargo Systems'
    }).addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Handle User Location Button
  const locateUser = () => {
    if (!mapRef.current) return;
    mapRef.current.locate({ setView: true, maxZoom: 15 });
    mapRef.current.once('locationfound', (e) => {
      if (userMarkerRef.current) userMarkerRef.current.remove();
      userMarkerRef.current = L.circleMarker(e.latlng, {
        radius: 8, fillColor: '#3b82f6', color: '#fff', weight: 3, opacity: 1, fillOpacity: 0.9
      }).addTo(mapRef.current!);
    });
  };

  // Replay Logic
  useEffect(() => {
    if (selectedJobId && route && route.length > 0) {
      setReplayIndex(0);
      setIsReplaying(false);
      if (polylineRef.current) polylineRef.current.remove();
      
      const latlngs = route.map(loc => [loc.lat, loc.lng] as L.LatLngExpression);
      polylineRef.current = L.polyline(latlngs, {
        color: '#10b981', weight: 4, opacity: 0.8, lineJoin: 'round'
      }).addTo(mapRef.current!);

      mapRef.current?.fitBounds(polylineRef.current.getBounds(), { padding: [50, 50] });
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
            html: '<div class="w-8 h-8 rounded-full bg-emerald-500 border-2 border-white shadow-lg flex items-center justify-center text-white"><i class="fas fa-truck text-xs"></i></div>',
            className: 'custom-div-icon', iconSize: [32, 32], iconAnchor: [16, 16] 
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
        <div class="relative flex flex-col items-center">
          <div class="w-10 h-10 rounded-2xl flex items-center justify-center text-white border-2 border-white/40 transition-all shadow-[0_5px_15px_rgba(0,0,0,0.3)] ${
            effectiveStatus === 'ON_JOB' ? 'bg-emerald-600 animate-pulse' : 
            effectiveStatus === 'ONLINE' ? 'bg-blue-600' : 'bg-gray-500 grayscale'
          }">
            <i class="fas ${effectiveStatus === 'ON_JOB' ? 'fa-truck-fast' : 'fa-truck'} text-sm"></i>
          </div>
          <div class="mt-1 px-2 py-0.5 bg-slate-900 rounded-md text-[8px] font-black text-white uppercase border border-white/10 shadow-sm">
            ${driver.vehicleNo}
          </div>
        </div>
      `;

      if (markersRef.current[driver.id]) {
        markersRef.current[driver.id].setLatLng(latLng);
        markersRef.current[driver.id].setIcon(L.divIcon({
          html: iconHtml, className: 'custom-div-icon', iconSize: [40, 40], iconAnchor: [20, 20]
        }));
      } else {
        const marker = L.marker(latLng, {
          icon: L.divIcon({
            html: iconHtml, className: 'custom-div-icon', iconSize: [40, 40], iconAnchor: [20, 20]
          })
        }).addTo(mapRef.current!);
        
        marker.on('click', () => {
          focusOnDriver(driver);
        });
        
        markersRef.current[driver.id] = marker;
      }

      if (isLocked && lockedTargetId === driver.id) {
        mapRef.current?.setView(latLng);
      }
    });

    Object.keys(markersRef.current).forEach(id => {
      if (!drivers.find(d => d.id === id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });
  }, [drivers, selectedJobId, isLocked, lockedTargetId]);

  const focusOnDriver = (driver: Driver) => {
    if (!driver.lastKnownLocation || !mapRef.current) return;
    setIsLocked(true);
    setLockedTargetId(driver.id);
    mapRef.current.setView([driver.lastKnownLocation.lat, driver.lastKnownLocation.lng], 16, { animate: true });
    // Hide sidebar on mobile after selection to see map
    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
  };

  const activeMissions = jobs.filter(j => j.status === JobStatus.IN_PROGRESS);

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-100 flex flex-col md:block">
      {/* MAP CONTAINER */}
      <div ref={mapContainerRef} className="w-full flex-grow md:h-full z-0" />

      {/* TOOLBAR - Floating on Desktop, Fixed Top on Mobile when sidebar is open */}
      <div className={`absolute left-4 z-[1000] flex flex-col space-y-2 sm:space-y-3 transition-all duration-300 ${showSidebar && window.innerWidth < 768 ? 'top-4' : 'top-4'}`}>
        <button onClick={() => setShowSidebar(!showSidebar)} className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-900 text-white rounded-xl sm:rounded-2xl flex items-center justify-center shadow-2xl border border-white/10 hover:bg-blue-600 transition">
          <i className={`fas ${showSidebar ? 'fa-chevron-down' : 'fa-list-ul'} md:${showSidebar ? 'fa-indent' : 'fa-outdent'}`}></i>
        </button>
        {!showSidebar && (
          <>
            <button onClick={locateUser} className="w-10 h-10 sm:w-12 sm:h-12 bg-white text-slate-900 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-2xl border border-gray-100 hover:bg-blue-50 transition">
              <i className="fas fa-location-crosshairs text-base sm:text-lg"></i>
            </button>
            <button onClick={() => { setIsLocked(false); setLockedTargetId(null); }} className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-2xl border transition ${isLocked ? 'bg-blue-600 text-white border-blue-400' : 'bg-white text-gray-400 border-gray-200'}`}>
              <i className={`fas ${isLocked ? 'fa-lock' : 'fa-lock-open'}`}></i>
            </button>
          </>
        )}
      </div>

      {/* DRAWER / SIDEBAR */}
      <div className={`
        absolute z-[1001] transition-all duration-500 ease-in-out
        ${showSidebar 
          ? 'bottom-0 left-0 right-0 h-[60vh] md:h-auto md:top-6 md:bottom-6 md:right-6 md:left-auto md:w-80' 
          : 'bottom-[-100%] left-0 right-0 h-[60vh] md:h-auto md:top-6 md:bottom-6 md:right-[-400px] md:left-auto md:w-80'}
        bg-white/95 backdrop-blur-xl rounded-t-[2.5rem] md:rounded-[2.5rem] border border-gray-200 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] md:shadow-2xl flex flex-col overflow-hidden
      `}>
        {/* Mobile Drag Handle */}
        <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 md:hidden"></div>
        
        <div className="p-4 sm:p-6 border-b border-gray-100 flex space-x-2 bg-gray-50/50">
          <button onClick={() => setActiveTab('DRIVERS')} className={`flex-1 py-2 sm:py-3 rounded-xl sm:rounded-2xl text-[10px] font-black uppercase tracking-widest transition ${activeTab === 'DRIVERS' ? 'bg-slate-900 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}>Fleet</button>
          <button onClick={() => setActiveTab('MISSIONS')} className={`flex-1 py-2 sm:py-3 rounded-xl sm:rounded-2xl text-[10px] font-black uppercase tracking-widest transition ${activeTab === 'MISSIONS' ? 'bg-slate-900 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}>Tasks</button>
        </div>

        <div className="flex-grow overflow-y-auto scrollbar-hide p-3 sm:p-4 space-y-2 sm:space-y-3 pb-8">
          {activeTab === 'DRIVERS' ? (
            drivers.map(d => {
              const effectiveStatus = getEffectiveStatus(d);
              return (
                <button key={d.id} onClick={() => focusOnDriver(d)} className={`w-full text-left p-3 sm:p-4 rounded-2xl sm:rounded-3xl border transition-all ${lockedTargetId === d.id ? 'bg-blue-600 border-blue-400' : 'bg-white border-gray-100 hover:border-blue-200 shadow-sm'}`}>
                  <div className="flex justify-between items-start mb-1 sm:mb-2">
                    <span className={`font-black text-xs sm:text-sm ${lockedTargetId === d.id ? 'text-white' : 'text-gray-900'}`}>{d.name}</span>
                    <span className={`w-2 h-2 rounded-full ${effectiveStatus === 'ON_JOB' ? 'bg-emerald-500 animate-pulse' : effectiveStatus === 'ONLINE' ? 'bg-blue-500' : 'bg-gray-400'}`}></span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest ${lockedTargetId === d.id ? 'text-blue-100' : 'text-gray-400'}`}>{d.vehicleNo}</span>
                    <span className={`text-[8px] sm:text-[10px] font-black ${lockedTargetId === d.id ? 'text-white' : 'text-gray-600'}`}>{Math.round(d.lastKnownLocation?.speed || 0)} KM/H</span>
                  </div>
                </button>
              );
            })
          ) : (
            activeMissions.length === 0 ? (
              <div className="text-center py-10 sm:py-20 text-gray-400">
                <i className="fas fa-truck-fast text-2xl sm:text-4xl mb-2 sm:mb-4 opacity-20"></i>
                <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest">No Active Missions</p>
              </div>
            ) : (
              activeMissions.map(m => (
                <button key={m.id} onClick={() => {
                  const d = drivers.find(d => d.id === m.driverId);
                  if (d) focusOnDriver(d);
                }} className="w-full text-left p-4 sm:p-5 rounded-2xl sm:rounded-[2rem] bg-emerald-50 border border-emerald-100 hover:border-emerald-300 transition shadow-sm">
                  <div className="flex justify-between mb-2 sm:mb-3">
                     <span className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.2em]">{m.tripType}</span>
                     <span className="text-[7px] sm:text-[8px] font-black text-gray-400 uppercase opacity-50">ID: {m.id}</span>
                  </div>
                  <p className="text-gray-900 font-black text-xs sm:text-sm mb-1">{m.origin} → {m.destination}</p>
                  <p className="text-[8px] sm:text-[9px] font-black text-emerald-600/80 uppercase">Assignee: {drivers.find(d => d.id === m.driverId)?.name}</p>
                </button>
              ))
            )}
          </div>
      </div>

      {/* REPLAY COCKPIT HUD - Mobile Adaptive */}
      {selectedJobId && route.length > 0 && (
        <div className="absolute bottom-4 left-2 right-2 sm:bottom-10 sm:left-1/2 sm:-translate-x-1/2 z-[1002] w-auto sm:w-full sm:max-w-3xl">
          <div className="bg-slate-900/95 backdrop-blur-3xl rounded-[2rem] sm:rounded-[3.5rem] p-4 sm:p-8 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-20">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <div>
                <h4 className="text-white text-sm sm:text-xl font-black tracking-tight uppercase">Trip Dossier</h4>
                <p className="text-emerald-400 text-[8px] font-black uppercase tracking-[0.2em] mt-0.5">{route.length} GPS Points</p>
              </div>
              <div className="flex space-x-1 sm:space-x-2">
                {[1, 2].map(s => (
                  <button key={s} onClick={() => setPlaybackSpeed(s)} className={`px-2 py-1 rounded-lg text-[8px] font-black transition ${playbackSpeed === s ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-500'}`}>{s}X</button>
                ))}
                <button onClick={() => { /* Close logic here */ }} className="px-2 py-1 text-[10px] text-gray-400 hover:text-white"><i className="fas fa-times"></i></button>
              </div>
            </div>

            <div className="relative h-1.5 bg-white/10 rounded-full mb-6 cursor-pointer" onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setReplayIndex(Math.floor(((e.clientX - rect.left) / rect.width) * (route.length - 1)));
            }}>
              <div className="absolute top-0 left-0 h-full bg-emerald-500 rounded-full shadow-[0_0_15px_#10b981]" style={{ width: `${(replayIndex / (route.length - 1)) * 100}%` }}></div>
            </div>

            <div className="flex justify-center items-center space-x-6 sm:space-x-10">
              <button onClick={() => setReplayIndex(Math.max(0, replayIndex - 5))} className="w-10 h-10 rounded-xl bg-white/5 text-gray-400 border border-white/5 flex items-center justify-center"><i className="fas fa-backward-step"></i></button>
              <button onClick={() => setIsReplaying(!isReplaying)} className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white text-slate-950 text-xl sm:text-2xl flex items-center justify-center shadow-2xl transition active:scale-95">
                <i className={`fas ${isReplaying ? 'fa-pause' : 'fa-play'}`}></i>
              </button>
              <button onClick={() => setReplayIndex(Math.min(route.length - 1, replayIndex + 5))} className="w-10 h-10 rounded-xl bg-white/5 text-gray-400 border border-white/5 flex items-center justify-center"><i className="fas fa-forward-step"></i></button>
            </div>

            <div className="mt-6 flex justify-between text-[8px] font-black text-gray-500 uppercase tracking-widest border-t border-white/5 pt-4">
              <div className="flex items-center space-x-2">
                 <i className="fas fa-clock text-blue-500"></i>
                 <span>{new Date(route[replayIndex].timestamp || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex items-center space-x-2">
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

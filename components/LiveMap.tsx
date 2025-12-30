
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Driver, Location, JobStatus, Job, getEffectiveStatus } from '../types';

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

  // Map Provider State (m = roadmap, s = satellite, y = hybrid)
  const [mapType, setMapType] = useState<'m' | 'y'>('m');
  
  // Interaction States
  const [isLocked, setIsLocked] = useState(false);
  const [lockedTargetId, setLockedTargetId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true); 
  const [activeTab, setActiveTab] = useState<'DRIVERS' | 'MISSIONS'>('DRIVERS');

  // Replay System States
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playbackIntervalRef = useRef<number | null>(null);

  // Update Map Layer when type changes
  useEffect(() => {
    if (!mapRef.current) return;
    
    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        mapRef.current?.removeLayer(layer);
      }
    });

    L.tileLayer(`https://{s}.google.com/vt/lyrs=${mapType}&x={x}&y={y}&z={z}`, {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      noWrap: true,
      bounds: [[-85.0511, -180], [85.0511, 180]]
    }).addTo(mapRef.current);
  }, [mapType]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      center: [28.6139, 77.2090], 
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
      maxZoom: 20,
      minZoom: 4, 
      worldCopyJump: false,
      inertia: true
    });

    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      noWrap: true
    }).addTo(mapRef.current);

    const driversWithLoc = drivers.filter(d => d.lastKnownLocation);
    if (driversWithLoc.length > 0) {
      const markers = driversWithLoc.map(d => L.marker([d.lastKnownLocation!.lat, d.lastKnownLocation!.lng]));
      const group = L.featureGroup(markers);
      mapRef.current.fitBounds(group.getBounds().pad(0.3), { maxZoom: 15 });
    }

    const refreshMap = () => mapRef.current?.invalidateSize();
    window.addEventListener('resize', refreshMap);
    const interval = setInterval(refreshMap, 3000);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      window.removeEventListener('resize', refreshMap);
      clearInterval(interval);
    };
  }, []);

  // Snap to target when locked
  useEffect(() => {
    if (isLocked && mapRef.current) {
      if (selectedJobId && route[replayIndex]) {
        mapRef.current.setView([route[replayIndex].lat, route[replayIndex].lng], 18, { animate: true });
      } else if (lockedTargetId) {
        const target = drivers.find(d => d.id === lockedTargetId);
        if (target?.lastKnownLocation) {
          mapRef.current.setView([target.lastKnownLocation.lat, target.lastKnownLocation.lng], 18, { animate: true });
        }
      }
    }
  }, [isLocked, selectedJobId, lockedTargetId]);

  // Sync Replay Route
  useEffect(() => {
    if (selectedJobId && route && route.length > 0 && mapRef.current) {
      setReplayIndex(0);
      setIsReplaying(false);
      setShowSidebar(false);
      setIsLocked(true); // Auto-lock on replay start
      if (polylineRef.current) polylineRef.current.remove();
      
      const latlngs = route.map(loc => [loc.lat, loc.lng] as L.LatLngExpression);
      polylineRef.current = L.polyline(latlngs, {
        color: '#3b82f6', weight: 6, opacity: 0.9, lineJoin: 'round', lineCap: 'round'
      }).addTo(mapRef.current);

      mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [100, 100], maxZoom: 17 });
    } else {
      if (polylineRef.current) polylineRef.current.remove();
      if (replayMarkerRef.current) replayMarkerRef.current.remove();
    }
  }, [selectedJobId, route]);

  // Real-time Driver Tracking
  useEffect(() => {
    if (!mapRef.current || selectedJobId) return;

    drivers.forEach(driver => {
      if (!driver.lastKnownLocation) return;
      const latLng: L.LatLngExpression = [driver.lastKnownLocation.lat, driver.lastKnownLocation.lng];
      const effectiveStatus = getEffectiveStatus(driver);

      const iconHtml = `
        <div class="relative flex flex-col items-center group">
          <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-white border-[3px] border-white transition-all shadow-xl ${
            effectiveStatus === 'ON_JOB' ? 'bg-emerald-600 animate-pulse' : 
            effectiveStatus === 'ONLINE' ? 'bg-blue-600' : 'bg-slate-500'
          }">
            <i class="fas ${effectiveStatus === 'ON_JOB' ? 'fa-truck-fast' : 'fa-truck'} text-xl"></i>
          </div>
          <div class="mt-1.5 px-3 py-1 bg-slate-900 rounded-lg text-[9px] font-black text-white uppercase border border-white/20 shadow-lg whitespace-nowrap">
            ${driver.vehicleNo}
          </div>
        </div>
      `;

      if (markersRef.current[driver.id]) {
        markersRef.current[driver.id].setLatLng(latLng);
        markersRef.current[driver.id].setIcon(L.divIcon({
          html: iconHtml, className: 'custom-div-icon', iconSize: [56, 56], iconAnchor: [28, 56]
        }));
      } else {
        const marker = L.marker(latLng, {
          icon: L.divIcon({ html: iconHtml, className: 'custom-div-icon', iconSize: [56, 56], iconAnchor: [28, 56] })
        }).addTo(mapRef.current!);
        marker.on('click', () => focusOnDriver(driver));
        markersRef.current[driver.id] = marker;
      }

      if (isLocked && lockedTargetId === driver.id) {
        mapRef.current?.setView(latLng, 18, { animate: true });
      }
    });
  }, [drivers, selectedJobId, isLocked, lockedTargetId]);

  const focusOnDriver = (driver: Driver) => {
    if (!driver.lastKnownLocation || !mapRef.current) return;
    setIsLocked(true);
    setLockedTargetId(driver.id);
    mapRef.current.setView([driver.lastKnownLocation.lat, driver.lastKnownLocation.lng], 18, { animate: true });
    if (window.innerWidth < 768) setShowSidebar(false);
  };

  const locateUser = () => {
    if (!mapRef.current) return;
    mapRef.current.locate({ setView: true, maxZoom: 18 });
    mapRef.current.once('locationfound', (e) => {
      if (userMarkerRef.current) userMarkerRef.current.remove();
      userMarkerRef.current = L.circleMarker(e.latlng, {
        radius: 10, fillColor: '#2563eb', color: '#fff', weight: 3, opacity: 1, fillOpacity: 0.8
      }).addTo(mapRef.current!);
    });
  };

  const handleLockToggle = () => {
    setIsLocked(!isLocked);
    // If we are locking and have a target, snap immediately
    if (!isLocked && mapRef.current) {
       if (selectedJobId && route[replayIndex]) {
          mapRef.current.setView([route[replayIndex].lat, route[replayIndex].lng], 18, { animate: true });
       } else if (lockedTargetId) {
          const target = drivers.find(d => d.id === lockedTargetId);
          if (target?.lastKnownLocation) {
             mapRef.current.setView([target.lastKnownLocation.lat, target.lastKnownLocation.lng], 18, { animate: true });
          }
       }
    }
  };

  // Replay Logic
  useEffect(() => {
    if (isReplaying && route.length > 0) {
      playbackIntervalRef.current = window.setInterval(() => {
        setReplayIndex(prev => (prev >= route.length - 1 ? (setIsReplaying(false), prev) : prev + 1));
      }, 1000 / (playbackSpeed * 3));
    } else {
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    }
    return () => { if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current); };
  }, [isReplaying, route, playbackSpeed]);

  useEffect(() => {
    if (selectedJobId && route[replayIndex] && mapRef.current) {
      const point = route[replayIndex];
      const latLng: L.LatLngExpression = [point.lat, point.lng];
      if (!replayMarkerRef.current) {
        replayMarkerRef.current = L.marker(latLng, {
          icon: L.divIcon({ 
            html: `<div class="w-12 h-12 rounded-full bg-slate-950 border-4 border-white shadow-2xl flex items-center justify-center text-white"><i class="fas fa-truck text-lg"></i></div>`,
            className: 'custom-div-icon', iconSize: [48, 48], iconAnchor: [24, 24] 
          })
        }).addTo(mapRef.current);
      } else {
        replayMarkerRef.current.setLatLng(latLng);
      }
      if (isLocked) mapRef.current.setView(latLng, 18, { animate: true });
    }
  }, [replayIndex, selectedJobId, isLocked]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#e5e7eb]">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Map Status Toast (When Locked) */}
      {isLocked && (lockedTargetId || selectedJobId) && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[1100] bg-blue-600 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl flex items-center space-x-2 animate-bounce">
           <i className="fas fa-lock text-[8px]"></i>
           <span>Target Locked</span>
        </div>
      )}

      {/* Layer Toggle (Satellite/Street) */}
      <div className="absolute top-8 right-8 z-[1000]">
        <div className="bg-white p-1 rounded-2xl shadow-2xl flex border border-gray-100">
          <button 
            onClick={() => setMapType('m')}
            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition ${mapType === 'm' ? 'bg-slate-900 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}
          >
            Street
          </button>
          <button 
            onClick={() => setMapType('y')}
            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition ${mapType === 'y' ? 'bg-slate-900 text-white shadow-lg' : 'text-gray-400 hover:text-gray-900'}`}
          >
            Satellite
          </button>
        </div>
      </div>

      {/* Primary Toolbar */}
      <div className="absolute top-8 left-8 z-[1000] flex flex-col space-y-4">
        <button onClick={() => setShowSidebar(!showSidebar)} className="w-14 h-14 bg-slate-900 text-white rounded-[1.4rem] flex items-center justify-center shadow-2xl border border-white/10 hover:bg-blue-600 transition active:scale-95">
          <i className={`fas ${showSidebar ? 'fa-indent' : 'fa-list-ul'} text-xl`}></i>
        </button>
        <button onClick={locateUser} className="w-14 h-14 bg-white text-slate-900 rounded-[1.4rem] flex items-center justify-center shadow-2xl border border-gray-100 hover:bg-gray-50 transition active:scale-95">
          <i className="fas fa-location-crosshairs text-xl"></i>
        </button>
        <button 
          onClick={handleLockToggle} 
          className={`w-14 h-14 rounded-[1.4rem] flex items-center justify-center shadow-2xl border transition active:scale-95 ${isLocked ? 'bg-blue-600 text-white border-blue-400' : 'bg-white text-gray-400 border-gray-200 hover:text-slate-900'}`}
          title={isLocked ? "Unlock View" : "Lock on Selection"}
        >
          <i className={`fas ${isLocked ? 'fa-lock' : 'fa-lock-open'} text-xl`}></i>
        </button>
      </div>

      {/* Sidebar Panel */}
      {showSidebar && !selectedJobId && (
        <div className="absolute top-8 bottom-8 right-8 z-[1001] w-full md:w-[360px] flex flex-col pointer-events-none animate-in slide-in-from-right-10">
          <div className="bg-white/95 backdrop-blur-3xl rounded-[3rem] border border-gray-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.2)] flex flex-col h-full overflow-hidden pointer-events-auto">
            <div className="p-4 flex bg-gray-50/50 border-b border-gray-100">
              <button onClick={() => setActiveTab('DRIVERS')} className={`flex-1 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] transition-all ${activeTab === 'DRIVERS' ? 'bg-slate-900 text-white shadow-xl' : 'text-gray-400 hover:text-gray-900'}`}>Fleet</button>
              <button onClick={() => setActiveTab('MISSIONS')} className={`flex-1 py-4 rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] transition-all ${activeTab === 'MISSIONS' ? 'bg-slate-900 text-white shadow-xl' : 'text-gray-400 hover:text-gray-900'}`}>Active</button>
            </div>
            <div className="flex-grow overflow-y-auto scrollbar-hide p-6 space-y-4">
              {activeTab === 'DRIVERS' ? (
                drivers.map(d => {
                  const effectiveStatus = getEffectiveStatus(d);
                  return (
                    <button key={d.id} onClick={() => focusOnDriver(d)} className={`w-full text-left p-6 rounded-[2rem] border-2 transition-all ${lockedTargetId === d.id ? 'bg-white border-blue-500 shadow-xl' : 'bg-white border-gray-50 shadow-sm hover:border-blue-200'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-black text-slate-900 text-sm uppercase tracking-tight">{d.name}</span>
                        <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${effectiveStatus === 'ON_JOB' ? 'bg-emerald-500 animate-pulse' : effectiveStatus === 'ONLINE' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{d.vehicleNo}</span>
                        <span className="text-xs font-black text-slate-900">{Math.round(d.lastKnownLocation?.speed || 0)} KM/H</span>
                      </div>
                    </button>
                  );
                })
              ) : (
                jobs.filter(j => j.status === JobStatus.IN_PROGRESS).length === 0 ? (
                  <div className="text-center py-20 opacity-30"><i className="fas fa-truck-fast text-4xl mb-4"></i><p className="text-[10px] font-black uppercase tracking-widest">No Active Runs</p></div>
                ) : (
                  jobs.filter(j => j.status === JobStatus.IN_PROGRESS).map(m => (
                    <button key={m.id} onClick={() => { const d = drivers.find(d => d.id === m.driverId); if (d) focusOnDriver(d); }} className="w-full text-left p-6 rounded-[2rem] bg-emerald-50/50 border-2 border-emerald-100 shadow-sm hover:border-emerald-300 transition-all">
                      <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-2 block">{m.tripType}</span>
                      <p className="text-slate-900 font-black text-base leading-tight">{m.origin} → {m.destination}</p>
                    </button>
                  ))
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Replay Controller */}
      {selectedJobId && route.length > 0 && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1100] w-full max-w-lg px-6 animate-in slide-in-from-bottom-24">
          <div className="bg-slate-950/95 backdrop-blur-3xl rounded-[3.5rem] p-8 border border-white/10 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9)]">
            <div className="flex justify-between items-center mb-6">
              <div><h4 className="text-white text-xl font-black uppercase tracking-tighter">Mission Replay</h4><p className="text-blue-400 text-[9px] font-black uppercase tracking-[0.3em]">GPS Historical Data</p></div>
              <div className="flex space-x-1">
                {[1, 2, 4].map(s => <button key={s} onClick={() => setPlaybackSpeed(s)} className={`px-4 py-2 rounded-xl text-[9px] font-black transition ${playbackSpeed === s ? 'bg-blue-600 text-white shadow-xl' : 'bg-white/5 text-gray-500 hover:text-white'}`}>{s}X</button>)}
              </div>
            </div>
            <div className="relative h-1.5 bg-white/10 rounded-full mb-8 cursor-pointer" onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); setReplayIndex(Math.floor(((e.clientX - rect.left) / rect.width) * (route.length - 1))); }}>
              <div className="absolute top-0 left-0 h-full bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.7)] transition-all duration-300" style={{ width: `${(replayIndex / (route.length - 1)) * 100}%` }}></div>
            </div>
            <div className="flex justify-center items-center space-x-8">
              <button onClick={() => setReplayIndex(Math.max(0, replayIndex - 10))} className="w-12 h-12 rounded-xl bg-white/5 text-gray-400 hover:text-white border border-white/5 transition-all text-base active:scale-90 flex items-center justify-center"><i className="fas fa-backward-step"></i></button>
              <button onClick={() => setIsReplaying(!isReplaying)} className="w-16 h-16 rounded-[1.75rem] bg-white text-slate-950 text-2xl flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all"><i className={`fas ${isReplaying ? 'fa-pause' : 'fa-play'}`}></i></button>
              <button onClick={() => setReplayIndex(Math.min(route.length - 1, replayIndex + 10))} className="w-12 h-12 rounded-xl bg-white/5 text-gray-400 hover:text-white border border-white/5 transition-all text-base active:scale-90 flex items-center justify-center"><i className="fas fa-forward-step"></i></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveMap;

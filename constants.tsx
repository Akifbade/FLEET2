
import { Driver, Job, JobStatus, TripType } from './types';

export const LOGO_URL = 'https://qgocargo.com/logo.png';

// Backend Configuration - Temporarily using Firebase due to Parse SDK bundling issues
export const USE_PARSE_SERVER = false; // Set to true to use Parse Server instead of Firebase

export const MOCK_DRIVERS: Driver[] = [
  { id: 'D1', name: 'Rajesh Kumar', vehicleNo: 'DL-1RA-1234', password: '1234', status: 'ON_JOB', phone: '+91 9876543210', lastKnownLocation: { lat: 28.6139, lng: 77.2090 } },
  { id: 'D2', name: 'Amit Singh', vehicleNo: 'HR-26BZ-5678', password: '1234', status: 'ONLINE', phone: '+91 8765432109', lastKnownLocation: { lat: 19.0760, lng: 72.8777 } },
  { id: 'D3', name: 'Suresh Patil', vehicleNo: 'MH-12AB-9012', password: '1234', status: 'OFFLINE', phone: '+91 7654321098' },
];

export const MOCK_JOBS: Job[] = [
  {
    id: 'J101',
    driverId: 'D1',
    origin: 'Delhi Hub',
    destination: 'Jaipur Warehouse',
    status: JobStatus.IN_PROGRESS,
    // Fix: Added missing required tripType property
    tripType: TripType.URGENT_DELIVERY,
    assignedAt: new Date().toISOString(),
    description: 'Urgent delivery of electronics',
    startTime: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'J102',
    driverId: 'D2',
    origin: 'Mumbai Port',
    destination: 'Pune Distribution',
    status: JobStatus.PENDING,
    // Fix: Added missing required tripType property
    tripType: TripType.WAREHOUSE_SHIPMENT,
    assignedAt: new Date().toISOString(),
    description: 'Monthly FMCG refill',
  }
];

export const COLORS = {
  primary: '#2563eb', // Blue
  secondary: '#f97316', // Orange
  accent: '#10b981', // Green
  danger: '#ef4444', // Red
};

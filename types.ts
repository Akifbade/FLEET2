
export enum JobStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum TripType {
  LOCAL_MOVE = 'Local Move',
  WAREHOUSE_SHIPMENT = 'Warehouse Shipment',
  AIRPORT_CARGO = 'Airport Cargo',
  LONG_HAUL = 'Long Haul',
  URGENT_DELIVERY = 'Urgent Delivery'
}

export interface Location {
  lat: number;
  lng: number;
  timestamp?: number;
}

export type ReceiptType = 'FUEL' | 'MAINTENANCE' | 'TOLL' | 'OTHER';
export type SyncSpeed = 'FAST' | 'MEDIUM' | 'SLOW';

export interface FleetSettings {
  syncSpeed: SyncSpeed;
  updatedAt: string;
}

export interface ReceiptEntry {
  id: string;
  driverId: string;
  jobId?: string;
  type: ReceiptType;
  amount: number;
  description: string;
  invoiceUrl: string;
  date: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface Job {
  id: string;
  driverId: string;
  origin: string;
  destination: string;
  status: JobStatus;
  tripType: TripType;
  startTime?: string;
  endTime?: string;
  startLocation?: Location;
  endLocation?: Location;
  distanceKm?: number;
  avgSpeed?: number;
  assignedAt: string;
  description: string;
  attachmentUrl?: string; // Digital Manifest / Waybill
}

export interface Driver {
  id: string;
  name: string;
  vehicleNo: string;
  password?: string;
  status: 'ONLINE' | 'OFFLINE' | 'ON_JOB';
  phone: string;
  lastKnownLocation?: Location;
}

export type ViewMode = 'ADMIN' | 'DRIVER';

export interface AppNotification {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error';
  timestamp: number;
}

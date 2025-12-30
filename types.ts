
export enum JobStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface Location {
  lat: number;
  lng: number;
  timestamp?: number;
}

export type ReceiptType = 'FUEL' | 'MAINTENANCE' | 'TOLL' | 'OTHER';

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
  startTime?: string;
  endTime?: string;
  currentLocation?: Location;
  assignedAt: string;
  description: string;
}

export interface Driver {
  id: string;
  name: string;
  vehicleNo: string;
  password?: string; // Added for security
  status: 'ONLINE' | 'OFFLINE' | 'ON_JOB';
  phone: string;
  lastKnownLocation?: Location;
}

export type ViewMode = 'ADMIN' | 'DRIVER';

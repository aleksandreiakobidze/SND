export interface DriverCapacity {
  id: number;
  displayName: string;
  maxLiters: number;
  maxKg: number;
  maxOrders: number;
  vehiclePlate: string | null;
  vehicleType: string | null;
}

export interface OrderForDistribution {
  idReal1: number;
  lat: number;
  lon: number;
  liters: number;
  weightKg: number;
  amount: number;
  org: string;
  reg: string;
  orgCode: string;
  city: string;
}

export interface OrderLineItem {
  idReal2: number;
  prodCode: string;
  prod: string;
  qty: number;
  price: number;
  lineAmount: number;
  liters: number;
  kg: number;
}

export interface OrderDetail {
  idReal1: number;
  orgCode: string;
  org: string;
  city: string;
  address: string;
  amount: number;
  liters: number;
  kg: number;
  lines: OrderLineItem[];
}

export interface DriverLoadStats {
  driverId: number;
  driverName: string;
  vehiclePlate: string | null;
  vehicleType: string | null;
  orderIds: number[];
  orderCount: number;
  totalLiters: number;
  totalKg: number;
  totalAmount: number;
  maxLiters: number;
  maxKg: number;
  maxOrders: number;
  litersPct: number;
  kgPct: number;
  ordersPct: number;
  hasLitersLimit: boolean;
  hasKgLimit: boolean;
  hasOrdersLimit: boolean;
}

export interface DistributionPlan {
  driverStats: DriverLoadStats[];
  unassigned: number[];
  totalOrders: number;
  totalAssigned: number;
}

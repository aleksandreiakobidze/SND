export interface DriverCapacity {
  id: number;
  displayName: string;
  maxLiters: number;
  maxKg: number;
  maxOrders: number;
  /** When > 0, auto-distribution enforces total pallet count per vehicle. */
  maxPallets: number;
  vehiclePlate: string | null;
  vehicleType: string | null;
  allowedRegions: string[];
}

export interface OrderForDistribution {
  idReal1: number;
  lat: number;
  lon: number;
  liters: number;
  weightKg: number;
  /** Sum of line CEIL(Raod / UnitsPerPallet); 0 when unmapped or no pallet data. */
  pallets: number;
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
  /** CEIL(Raod / UnitsPerPallet); 0 if no master row or invalid units. */
  pallets: number;
  /** Units per full pallet from SndApp_ProductPalletCapacity; null if unmapped. */
  unitsPerPallet: number | null;
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
  /** Sum of line pallets (for header summary when shown with distribution). */
  pallets: number;
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
  totalPallets: number;
  totalAmount: number;
  maxLiters: number;
  maxKg: number;
  maxOrders: number;
  maxPallets: number;
  litersPct: number;
  kgPct: number;
  ordersPct: number;
  palletsPct: number;
  hasLitersLimit: boolean;
  hasKgLimit: boolean;
  hasOrdersLimit: boolean;
  hasPalletsLimit: boolean;
}

export interface DistributionPlan {
  driverStats: DriverLoadStats[];
  unassigned: number[];
  totalOrders: number;
  totalAssigned: number;
}

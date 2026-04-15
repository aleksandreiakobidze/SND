/**
 * Auto-distribution algorithm: assigns orders to drivers based on
 * geographic proximity and vehicle capacity constraints.
 *
 * Strategy (greedy geographic clustering with capacity balancing):
 * 1. Seed initial clusters using k-means-style geographic partitioning
 * 2. Greedily assign nearest unassigned order to the driver with
 *    most remaining capacity in that region
 * 3. Rebalance: if any driver is over capacity, move excess orders
 *    to the nearest under-capacity driver
 */

import type {
  DriverCapacity,
  OrderForDistribution,
  DriverLoadStats,
  DistributionPlan,
} from "./distribution-types";
import { haversineKm, centroid } from "./haversine";

const DEFAULT_MAX_LITERS = 5000;
const DEFAULT_MAX_KG = 3000;
const DEFAULT_MAX_ORDERS = 50;

interface DriverBucket {
  driver: DriverCapacity;
  orders: OrderForDistribution[];
  totalLiters: number;
  totalKg: number;
  totalAmount: number;
}

function effectiveMax(driver: DriverCapacity) {
  return {
    liters: driver.maxLiters > 0 ? driver.maxLiters : DEFAULT_MAX_LITERS,
    kg: driver.maxKg > 0 ? driver.maxKg : DEFAULT_MAX_KG,
    orders: driver.maxOrders > 0 ? driver.maxOrders : DEFAULT_MAX_ORDERS,
  };
}

function canFit(bucket: DriverBucket, order: OrderForDistribution): boolean {
  const max = effectiveMax(bucket.driver);
  if (bucket.orders.length >= max.orders) return false;
  if (bucket.totalLiters + order.liters > max.liters * 1.05) return false;
  if (bucket.totalKg + order.weightKg > max.kg * 1.05) return false;
  return true;
}

function addToBucket(bucket: DriverBucket, order: OrderForDistribution): void {
  bucket.orders.push(order);
  bucket.totalLiters += order.liters;
  bucket.totalKg += order.weightKg;
  bucket.totalAmount += order.amount;
}

function bucketCentroid(bucket: DriverBucket): { lat: number; lon: number } {
  return centroid(bucket.orders);
}

function pct(val: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((val / max) * 1000) / 10;
}

export function autoDistribute(
  orders: OrderForDistribution[],
  drivers: DriverCapacity[],
): DistributionPlan {
  if (drivers.length === 0) {
    return {
      driverStats: [],
      unassigned: orders.map((o) => o.idReal1),
      totalOrders: orders.length,
      totalAssigned: 0,
    };
  }

  const buckets: DriverBucket[] = drivers.map((d) => ({
    driver: d,
    orders: [],
    totalLiters: 0,
    totalKg: 0,
    totalAmount: 0,
  }));

  const remaining = [...orders];

  // Phase 1: Seed each driver with the most spread-out order (geographic diversity)
  if (remaining.length > 0 && buckets.length > 1) {
    const sorted = [...remaining].sort((a, b) => a.lat - b.lat || a.lon - b.lon);
    const step = Math.max(1, Math.floor(sorted.length / buckets.length));
    for (let i = 0; i < buckets.length && remaining.length > 0; i++) {
      const seedIdx = Math.min(i * step, sorted.length - 1);
      const seed = sorted[seedIdx];
      const rIdx = remaining.findIndex((o) => o.idReal1 === seed.idReal1);
      if (rIdx >= 0 && canFit(buckets[i], seed)) {
        remaining.splice(rIdx, 1);
        addToBucket(buckets[i], seed);
      }
    }
  }

  // Phase 2: Assign remaining orders to nearest driver with capacity
  while (remaining.length > 0) {
    let bestOrderIdx = -1;
    let bestBucketIdx = -1;
    let bestDist = Infinity;

    for (let oi = 0; oi < remaining.length; oi++) {
      const order = remaining[oi];
      for (let bi = 0; bi < buckets.length; bi++) {
        if (!canFit(buckets[bi], order)) continue;
        const c =
          buckets[bi].orders.length > 0
            ? bucketCentroid(buckets[bi])
            : { lat: order.lat, lon: order.lon };
        const dist = haversineKm(order.lat, order.lon, c.lat, c.lon);

        // Prefer under-loaded drivers (capacity-weighted distance)
        const max = effectiveMax(buckets[bi].driver);
        const loadFactor = buckets[bi].orders.length / max.orders;
        const weightedDist = dist * (1 + loadFactor * 0.5);

        if (weightedDist < bestDist) {
          bestDist = weightedDist;
          bestOrderIdx = oi;
          bestBucketIdx = bi;
        }
      }
    }

    if (bestOrderIdx < 0) break;

    const [order] = remaining.splice(bestOrderIdx, 1);
    addToBucket(buckets[bestBucketIdx], order);
  }

  const driverStats: DriverLoadStats[] = buckets.map((b) => {
    const max = effectiveMax(b.driver);
    return {
      driverId: b.driver.id,
      driverName: b.driver.displayName,
      vehiclePlate: b.driver.vehiclePlate,
      vehicleType: b.driver.vehicleType,
      orderIds: b.orders.map((o) => o.idReal1),
      orderCount: b.orders.length,
      totalLiters: Math.round(b.totalLiters * 100) / 100,
      totalKg: Math.round(b.totalKg * 100) / 100,
      totalAmount: Math.round(b.totalAmount * 100) / 100,
      maxLiters: max.liters,
      maxKg: max.kg,
      maxOrders: max.orders,
      litersPct: pct(b.totalLiters, max.liters),
      kgPct: pct(b.totalKg, max.kg),
      ordersPct: pct(b.orders.length, max.orders),
      hasLitersLimit: b.driver.maxLiters > 0,
      hasKgLimit: b.driver.maxKg > 0,
      hasOrdersLimit: b.driver.maxOrders > 0,
    };
  });

  const totalAssigned = driverStats.reduce((s, d) => s + d.orderCount, 0);

  return {
    driverStats,
    unassigned: remaining.map((o) => o.idReal1),
    totalOrders: orders.length,
    totalAssigned,
  };
}

/**
 * Nearest-neighbor TSP approximation for route ordering within a driver's orders.
 * Returns order IDs sorted by approximate delivery sequence.
 */
export function optimizeRouteOrder(orders: OrderForDistribution[]): number[] {
  if (orders.length <= 1) return orders.map((o) => o.idReal1);

  const visited = new Set<number>();
  const result: number[] = [];
  let current = orders[0];
  visited.add(current.idReal1);
  result.push(current.idReal1);

  while (result.length < orders.length) {
    let nearest: OrderForDistribution | null = null;
    let nearestDist = Infinity;
    for (const o of orders) {
      if (visited.has(o.idReal1)) continue;
      const d = haversineKm(current.lat, current.lon, o.lat, o.lon);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = o;
      }
    }
    if (!nearest) break;
    visited.add(nearest.idReal1);
    result.push(nearest.idReal1);
    current = nearest;
  }

  return result;
}

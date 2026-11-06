import { useState, useEffect } from 'react';

export interface DeviceData {
  batteryLevel: number | null; // percentage e.g. 85, or null if not available
  isCharging: boolean | null;
  storageUsedBytes: number | null;
  storageQuotaBytes: number | null;
  storagePercent: number | null;
  deviceMemoryGB: number | null; // e.g. 8 or null
  deviceName: string;
  isOnline: boolean;
  connectionType: string; // e.g. '4g', 'wifi', or 'Not available'
  downlinkSpeedMbps: number | null; // e.g. 10 or null
  rttMs: number | null;
}

export function useDeviceData(): DeviceData {
  const [data, setData] = useState<DeviceData>({
    batteryLevel: null,
    isCharging: null,
    storageUsedBytes: null,
    storageQuotaBytes: null,
    storagePercent: null,
    deviceMemoryGB: null,
    deviceName: 'Web browser',
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    connectionType: 'Not available',
    downlinkSpeedMbps: null,
    rttMs: null,
  });

  useEffect(() => {
    // 1. Device memory
    const memory = (navigator as any).deviceMemory;
    const memGB = typeof memory === 'number' ? memory : null;

    // 2. Network connection
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    const updateNetwork = () => {
      setData((prev) => ({
        ...prev,
        isOnline: navigator.onLine,
        connectionType: conn?.effectiveType ? String(conn.effectiveType).toUpperCase() : (navigator.onLine ? 'ONLINE' : 'OFFLINE'),
        downlinkSpeedMbps: typeof conn?.downlink === 'number' ? conn.downlink : null,
        rttMs: typeof conn?.rtt === 'number' ? conn.rtt : null,
      }));
    };

    updateNetwork();
    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);
    if (conn) {
      conn.addEventListener('change', updateNetwork);
    }

    // 3. Storage estimate
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((est) => {
        if (est.usage !== undefined && est.quota !== undefined && est.quota > 0) {
          const percent = Math.min(100, Math.round((est.usage / est.quota) * 100));
          setData((prev) => ({
            ...prev,
            storageUsedBytes: est.usage ?? null,
            storageQuotaBytes: est.quota ?? null,
            storagePercent: percent,
          }));
        }
      }).catch(() => {});
    }

    // 4. Battery
    if ((navigator as any).getBattery) {
      (navigator as any).getBattery().then((battery: any) => {
        const updateBattery = () => {
          setData((prev) => ({
            ...prev,
            batteryLevel: Math.round(battery.level * 100),
            isCharging: battery.charging,
          }));
        };
        updateBattery();
        battery.addEventListener('levelchange', updateBattery);
        battery.addEventListener('chargingchange', updateBattery);
      }).catch(() => {});
    }

    setData((prev) => ({
      ...prev,
      deviceMemoryGB: memGB,
      deviceName: 'Web browser', // Explicitly Web browser until native Android app is attached
    }));

    return () => {
      window.removeEventListener('online', updateNetwork);
      window.removeEventListener('offline', updateNetwork);
      if (conn) {
        conn.removeEventListener('change', updateNetwork);
      }
    };
  }, []);

  return data;
}

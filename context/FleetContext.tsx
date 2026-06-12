import React, { createContext, useContext, useState } from 'react';
import { mockVehicles, mockDrivers } from '../data/mockData';
import type { Vehicle, Driver } from '../types';

interface FleetContextType {
  vehicles: Vehicle[];
  drivers: Driver[];
  addVehicle: (vehicle: Omit<Vehicle, 'id'>) => void;
  addDriver:  (driver:  Omit<Driver,  'id'>) => void;
}

const FleetContext = createContext<FleetContextType | null>(null);

export function FleetProvider({ children }: { children: React.ReactNode }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(mockVehicles);
  const [drivers,  setDrivers]  = useState<Driver[]>(mockDrivers);

  const addVehicle = (v: Omit<Vehicle, 'id'>) => {
    setVehicles((prev) => [...prev, { ...v, id: `v${prev.length + 1}` }]);
  };

  const addDriver = (d: Omit<Driver, 'id'>) => {
    setDrivers((prev) => [...prev, { ...d, id: `d${prev.length + 1}` }]);
  };

  return (
    <FleetContext.Provider value={{ vehicles, drivers, addVehicle, addDriver }}>
      {children}
    </FleetContext.Provider>
  );
}

export function useFleet(): FleetContextType {
  const ctx = useContext(FleetContext);
  if (!ctx) throw new Error('useFleet must be used within FleetProvider');
  return ctx;
}

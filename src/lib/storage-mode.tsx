"use client";
import { createContext, useContext } from "react";
export type StorageMode = "local" | "cloud";
export const StorageModeContext = createContext<StorageMode>("local");
export const useStorageMode = () => useContext(StorageModeContext);
export function StorageProvider({
  mode,
  children,
}: {
  mode: StorageMode;
  children: React.ReactNode;
}) {
  return (
    <StorageModeContext.Provider value={mode}>
      {children}
    </StorageModeContext.Provider>
  );
}

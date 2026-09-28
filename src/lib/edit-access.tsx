"use client";

import { createContext, useContext } from "react";

const EditAccessContext = createContext(false);

export const useCanEdit = () => useContext(EditAccessContext);

export function EditAccessProvider({
  canEdit,
  children,
}: {
  canEdit: boolean;
  children: React.ReactNode;
}) {
  return (
    <EditAccessContext.Provider value={canEdit}>
      {children}
    </EditAccessContext.Provider>
  );
}

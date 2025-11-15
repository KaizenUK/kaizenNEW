import { useState, useEffect } from "react";

const ADMIN_PASSWORD = "10Crompton*Drive!"; // TODO: Replace with proper authentication later
const AUTH_STORAGE_KEY = "admin_authenticated";

export function useAdminAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is already authenticated on mount
  useEffect(() => {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    setIsAuthenticated(stored === "true");
    setIsLoading(false);
  }, []);

  const login = (password: string): boolean => {
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem(AUTH_STORAGE_KEY, "true");
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setIsAuthenticated(false);
  };

  return {
    isAuthenticated,
    isLoading,
    login,
    logout,
  };
}

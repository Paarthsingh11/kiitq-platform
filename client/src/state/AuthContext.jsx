import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const AuthContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

axios.defaults.baseURL = API_BASE;

function getStoredAuth() {
  try {
    const raw = localStorage.getItem("auth");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredAuth();
    if (stored?.token && stored?.user) {
      setUser(stored.user);
      setToken(stored.token);
      axios.defaults.headers.common.Authorization = `Bearer ${stored.token}`;
    }
    setLoading(false);
  }, []);

  const login = (data) => {
    setUser(data.user);
    setToken(data.token);
    axios.defaults.headers.common.Authorization = `Bearer ${data.token}`;
    localStorage.setItem("auth", JSON.stringify(data));
  };

  const updateProfile = (updatedUser) => {
    setUser(updatedUser);
    const stored = getStoredAuth();
    if (stored) {
      stored.user = updatedUser;
      localStorage.setItem("auth", JSON.stringify(stored));
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    delete axios.defaults.headers.common.Authorization;
    localStorage.removeItem("auth");
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    updateProfile,
    api: axios
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}


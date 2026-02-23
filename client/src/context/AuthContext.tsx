import { createContext, useContext, useState, type ReactNode, useEffect } from "react";

interface User {
  user_id: number;
  username: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  login: (login: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  const fetchUser = async () => {
    try {
      const res = await fetch("http://localhost:8080/auth/me", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error(err);
      setUser(null);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = async (login: string, password: string) => {
    const res = await fetch("http://localhost:8080/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ login, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      // Throw backend error so frontend can display it
      throw new Error(data.error || "Login failed");
    }

    // directly set the user from the response instead of refetching
    setUser({
      user_id: data.user_id,
      username: data.username,
      email: data.email,
    });
  };

  const register = async (username: string, email: string, password: string) => {
    const res = await fetch("http://localhost:8080/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, email, password }),
    });
    if (!res.ok) throw new Error("Registration failed");
    await fetchUser();
  };

  const logout = async () => {
    await fetch("http://localhost:8080/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
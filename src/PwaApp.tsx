import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import { Dashboard } from "./components/Dashboard";
import { LoginPage } from "./components/LoginPage";
import "./styles/globals.css";
import type { User } from "@supabase/supabase-js";

export function PwaApp() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!supabase);

  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) {
        setUser(data.user);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onSignIn={setUser} />;
  }

  return (
    <Dashboard
      readOnly
      onReset={() => {
        supabase?.auth.signOut();
        setUser(null);
      }}
    />
  );
}

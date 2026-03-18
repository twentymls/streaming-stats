import { useState } from "react";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";

interface LoginPageProps {
  onSignIn: (user: User) => void;
}

export function LoginPage({ onSignIn }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error: err } = await supabase.auth.signUp({ email, password });
        if (err) {
          setError(err.message);
        } else if (data.user) {
          onSignIn(data.user);
        }
      } else {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) {
          setError(err.message);
        } else if (data.user) {
          onSignIn(data.user);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-page">
      <div className="setup-card">
        <h1>Streaming Stats</h1>
        <p className="setup-subtitle">Sign in to view your streaming analytics</p>

        <form onSubmit={handleSubmit}>
          {error && <p className="cloud-error">{error}</p>}
          <div className="setup-field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="setup-input"
              required
            />
          </div>
          <div className="setup-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="setup-input"
              required
              minLength={6}
            />
          </div>
          <button type="submit" className="btn btn-primary setup-submit" disabled={loading}>
            {loading ? "..." : isSignUp ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="setup-toggle">
          {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
          <button className="btn-link" onClick={() => setIsSignUp(!isSignUp)}>
            {isSignUp ? "Sign in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}

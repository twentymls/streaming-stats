import { useState, useEffect } from "react";
import { loadSettings, saveSettings } from "../lib/settings";
import { getMonthlyApiCount } from "../lib/database";
import { supabase, getSupabaseUser } from "../lib/supabase";
import { syncAllHistory } from "../lib/sync";
import { AppSettings } from "../lib/types";
import { DSP_NAMES, DEFAULT_SOURCES } from "../lib/constants";
import type { User } from "@supabase/supabase-js";

interface SettingsProps {
  onBack: () => void;
  onReset: () => void;
}

export function Settings({ onBack, onReset }: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [apiCount, setApiCount] = useState(0);
  const [saved, setSaved] = useState(false);
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [cloudEmail, setCloudEmail] = useState("");
  const [cloudPassword, setCloudPassword] = useState("");
  const [cloudError, setCloudError] = useState("");
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudSynced, setCloudSynced] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      setSettings(s);
      const count = await getMonthlyApiCount();
      setApiCount(count);
      const user = await getSupabaseUser();
      if (user) setCloudUser(user);
    })();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    await saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCloudSignIn = async () => {
    if (!supabase) {
      setCloudError("Cloud sync not configured");
      return;
    }
    setCloudError("");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cloudEmail,
      password: cloudPassword,
    });
    if (error) {
      setCloudError(error.message);
    } else if (data.user) {
      setCloudUser(data.user);
      setCloudEmail("");
      setCloudPassword("");
    }
  };

  const handleCloudSignUp = async () => {
    if (!supabase) {
      setCloudError("Cloud sync not configured");
      return;
    }
    setCloudError("");
    const { data, error } = await supabase.auth.signUp({
      email: cloudEmail,
      password: cloudPassword,
    });
    if (error) {
      setCloudError(error.message);
    } else if (data.user) {
      setCloudUser(data.user);
      setCloudEmail("");
      setCloudPassword("");
    }
  };

  const handleCloudSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setCloudUser(null);
  };

  const handleSyncAll = async () => {
    setCloudSyncing(true);
    setCloudError("");
    try {
      const result = await syncAllHistory();
      if (result) {
        setCloudError(result);
      } else {
        setCloudSynced(true);
        setTimeout(() => setCloudSynced(false), 3000);
      }
    } catch (err) {
      setCloudError(String(err));
    } finally {
      setCloudSyncing(false);
    }
  };

  const toggleSource = (source: string) => {
    if (!settings) return;
    const sources = settings.enabled_sources.includes(source)
      ? settings.enabled_sources.filter((s) => s !== source)
      : [...settings.enabled_sources, source];
    setSettings({ ...settings, enabled_sources: sources });
  };

  if (!settings) return <div className="loading">Loading...</div>;

  return (
    <div className="settings-page">
      <header className="settings-header">
        <button onClick={onBack} className="btn">
          Back
        </button>
        <h2>Settings</h2>
      </header>

      <div className="settings-section">
        <h3>API Key (RapidAPI)</h3>
        <input
          type="password"
          value={settings.api_key}
          onChange={(e) => setSettings({ ...settings, api_key: e.target.value })}
          className="setup-input"
        />
      </div>

      <div className="settings-section">
        <h3>Spotify Artist ID</h3>
        <input
          type="text"
          value={settings.spotify_artist_id}
          onChange={(e) => setSettings({ ...settings, spotify_artist_id: e.target.value })}
          className="setup-input"
        />
      </div>

      <div className="settings-section">
        <h3>Active platforms</h3>
        <div className="sources-grid">
          {DEFAULT_SOURCES.map((source) => (
            <label key={source} className="source-toggle">
              <input
                type="checkbox"
                checked={settings.enabled_sources.includes(source)}
                onChange={() => toggleSource(source)}
              />
              <span>{DSP_NAMES[source]}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <h3>API usage this month</h3>
        <div className="api-usage">
          <div className="api-bar">
            <div className="api-bar-fill" style={{ width: `${(apiCount / 500) * 100}%` }} />
          </div>
          <span>
            {apiCount} / 500 requests ({Math.round((apiCount / 500) * 100)}
            %)
          </span>
        </div>
      </div>

      {supabase && (
        <div className="settings-section">
          <h3>Cloud Sync</h3>
          {cloudError && <p className="cloud-error">{cloudError}</p>}
          {cloudUser ? (
            <div className="cloud-sync-status">
              <span className="cloud-sync-email">{cloudUser.email}</span>
              <div className="cloud-sync-actions">
                <button onClick={handleSyncAll} className="btn btn-sm" disabled={cloudSyncing}>
                  {cloudSyncing ? "Syncing..." : cloudSynced ? "Synced!" : "Sync all history"}
                </button>
                <button onClick={handleCloudSignOut} className="btn btn-sm">
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <div className="cloud-sync-auth">
              <input
                type="email"
                placeholder="Email"
                value={cloudEmail}
                onChange={(e) => setCloudEmail(e.target.value)}
                className="setup-input"
              />
              <input
                type="password"
                placeholder="Password"
                value={cloudPassword}
                onChange={(e) => setCloudPassword(e.target.value)}
                className="setup-input"
              />
              <div className="cloud-sync-actions">
                <button onClick={handleCloudSignIn} className="btn btn-sm">
                  Sign in
                </button>
                <button onClick={handleCloudSignUp} className="btn btn-sm">
                  Sign up
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="settings-actions">
        <button onClick={handleSave} className="btn btn-primary">
          {saved ? "Saved!" : "Save"}
        </button>
        <button onClick={onBack} className="btn">
          Cancel
        </button>
      </div>

      <div className="settings-danger-zone">
        <h3>Danger Zone</h3>
        <p>
          This will permanently delete all your data, API keys, and settings. You will need to set
          up the app again from scratch.
        </p>
        <button onClick={onReset} className="btn btn-danger">
          Full reset
        </button>
      </div>
    </div>
  );
}

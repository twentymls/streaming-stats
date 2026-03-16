import { useState, useEffect } from "react";
import { loadSettings, saveSettings } from "../lib/settings";
import { getMonthlyApiCount } from "../lib/database";
import { AppSettings } from "../lib/types";
import { DSP_NAMES, DEFAULT_SOURCES } from "../lib/constants";

interface SettingsProps {
  onBack: () => void;
  onReset: () => void;
}

export function Settings({ onBack, onReset }: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [apiCount, setApiCount] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      setSettings(s);
      const count = await getMonthlyApiCount();
      setApiCount(count);
    })();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    await saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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

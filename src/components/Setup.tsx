import { useState } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { AppSettings } from "../lib/types";
import { saveSettings } from "../lib/settings";
import { testApiKey, getArtistInfo } from "../lib/songstats-api";
import { DEFAULT_SOURCES } from "../lib/constants";

interface SetupProps {
  onComplete: () => void;
}

export function Setup({ onComplete }: SetupProps) {
  const [step, setStep] = useState(1);
  const [apiKey, setApiKey] = useState("");
  const [spotifyId, setSpotifyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [artistName, setArtistName] = useState("");

  const handleTestKey = async () => {
    setLoading(true);
    setError("");
    try {
      const valid = await testApiKey(apiKey.trim());
      if (valid) {
        setStep(2);
      } else {
        setError("Invalid API key. Please check and try again.");
      }
    } catch {
      setError("Connection error. Check your internet connection.");
    }
    setLoading(false);
  };

  const handleVerifyArtist = async () => {
    setLoading(true);
    setError("");

    // Extract Spotify ID from URL or use directly
    let id = spotifyId.trim();
    const urlMatch = id.match(/artist\/([a-zA-Z0-9]+)/);
    if (urlMatch) {
      id = urlMatch[1];
      setSpotifyId(id);
    }

    try {
      const info = await getArtistInfo(apiKey.trim(), id);
      setArtistName(info.name);
      setStep(3);
    } catch {
      setError(
        "Artist not found. Enter a valid Spotify ID or artist profile URL."
      );
    }
    setLoading(false);
  };

  const handleFinish = async () => {
    setLoading(true);
    const settings: AppSettings = {
      api_key: apiKey.trim(),
      spotify_artist_id: spotifyId.trim(),
      artist_name: artistName,
      enabled_sources: DEFAULT_SOURCES,
      fetch_hour: 6,
    };
    await saveSettings(settings);
    setLoading(false);
    onComplete();
  };

  return (
    <div className="setup-container">
      <div className="setup-card">
        <h1>Streaming Stats</h1>
        <p className="setup-subtitle">Set up your app in 2 minutes</p>

        <div className="steps-indicator">
          <div className={`step-dot ${step >= 1 ? "active" : ""}`}>1</div>
          <div className="step-line" />
          <div className={`step-dot ${step >= 2 ? "active" : ""}`}>2</div>
          <div className="step-line" />
          <div className={`step-dot ${step >= 3 ? "active" : ""}`}>3</div>
        </div>

        {step === 1 && (
          <div className="setup-step">
            <h2>RapidAPI Key</h2>
            <p>
              <a
                href="#"
                className="link-text clickable"
                onClick={(e) => {
                  e.preventDefault();
                  open("https://rapidapi.com/songstats-app-songstats-app-default/api/songstats/pricing");
                }}
              >
                Subscribe to the free plan on RapidAPI
              </a>
              , then copy your API key and paste it below.
            </p>
            <input
              type="password"
              placeholder="Paste your RapidAPI key..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="setup-input"
              autoFocus
            />
            {error && <p className="error-text">{error}</p>}
            <button
              onClick={handleTestKey}
              disabled={!apiKey.trim() || loading}
              className="setup-button"
            >
              {loading ? "Verifying..." : "Verify API Key"}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="setup-step">
            <h2>Your Spotify Profile</h2>
            <p>
              Paste your Spotify artist profile link, or just the Artist ID.
            </p>
            <input
              type="text"
              placeholder="https://open.spotify.com/artist/... or the ID"
              value={spotifyId}
              onChange={(e) => setSpotifyId(e.target.value)}
              className="setup-input"
              autoFocus
            />
            {error && <p className="error-text">{error}</p>}
            <button
              onClick={handleVerifyArtist}
              disabled={!spotifyId.trim() || loading}
              className="setup-button"
            >
              {loading ? "Searching..." : "Verify Artist"}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="setup-step">
            <h2>All set!</h2>
            <div className="artist-confirm">
              <p className="artist-name-display">{artistName}</p>
              <p>
                Your stats will be tracked across 8 platforms: Spotify,
                Apple Music, YouTube, TikTok, Deezer, Amazon Music, Shazam,
                SoundCloud.
              </p>
            </div>
            <button
              onClick={handleFinish}
              disabled={loading}
              className="setup-button primary"
            >
              {loading ? "Saving..." : "Let's go!"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

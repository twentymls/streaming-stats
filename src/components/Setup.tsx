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
    const result = await testApiKey(apiKey.trim());
    if (result.valid) {
      setStep(2);
    } else if (result.error === "network") {
      setError("Connection error. Check your internet connection.");
    } else if (result.error === "rate_limit") {
      setError("API rate limit reached. Please wait a minute and try again.");
    } else {
      setError("Invalid API key. Please check and try again.");
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
    } catch (err) {
      console.error("Artist lookup failed:", err);
      setError("Artist not found. Enter a valid Spotify ID or artist profile URL.");
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
          <div className={`step-line ${step >= 2 ? "completed" : ""}`} />
          <div className={`step-dot ${step >= 2 ? "active" : ""}`}>2</div>
          <div className={`step-line ${step >= 3 ? "completed" : ""}`} />
          <div className={`step-dot ${step >= 3 ? "active" : ""}`}>3</div>
        </div>

        {step === 1 && (
          <div className="setup-step">
            <h2>RapidAPI Key</h2>
            <ol className="setup-guide">
              <li>
                <a
                  href="#"
                  className="link-text clickable"
                  onClick={(e) => {
                    e.preventDefault();
                    open(
                      "https://rapidapi.com/songstats-app-songstats-app-default/api/songstats/pricing"
                    );
                  }}
                >
                  Open the Songstats API page on RapidAPI
                </a>{" "}
                and subscribe to the free plan.
              </li>
              <li>
                Once subscribed, look for the <strong>X-RapidAPI-Key</strong> field on the page —
                that's your API key.
              </li>
              <li>Copy it and paste it below.</li>
            </ol>
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
            <p>Paste your Spotify artist profile link, or just the Artist ID.</p>
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
                Your stats will be tracked across 8 platforms: Spotify, Apple Music, YouTube,
                TikTok, Deezer, Amazon Music, Shazam, SoundCloud.
              </p>
            </div>
            <button onClick={handleFinish} disabled={loading} className="setup-button primary">
              {loading ? "Saving..." : "Let's go!"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

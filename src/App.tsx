import { useState, useEffect } from "react";
import { Setup } from "./components/Setup";
import { Dashboard } from "./components/Dashboard";
import { hasApiKey } from "./lib/settings";
import "./styles/globals.css";

export default function App() {
  const [isSetup, setIsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    hasApiKey().then((has) => setIsSetup(!has));
  }, []);

  const handleSetupComplete = () => {
    setIsSetup(false);
  };

  const handleReset = () => {
    setIsSetup(true);
  };

  if (isSetup === null) {
    return (
      <div className="loading-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (isSetup) {
    return <Setup onComplete={handleSetupComplete} />;
  }

  return <Dashboard onReset={handleReset} />;
}

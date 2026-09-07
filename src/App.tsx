import { useEffect, useState } from "react";
import { PropertyRecord, newProperty } from "./types";
import { getAllProperties, getProperty } from "./db";
import NewVisit from "./components/NewVisit";
import PropertyList from "./components/PropertyList";
import Settings from "./components/Settings";

type Tab = "new" | "list" | "settings";

export default function App() {
  const [tab, setTab] = useState<Tab>("list");
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [activeProperty, setActiveProperty] = useState<PropertyRecord | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function refresh() {
    const all = await getAllProperties();
    setProperties(all);
  }

  useEffect(() => {
    refresh().finally(() => setLoaded(true));
  }, []);

  function startNewVisit() {
    setActiveProperty(newProperty(`Visit ${new Date().toLocaleDateString()}`));
    setTab("new");
  }

  async function openProperty(id: string) {
    const p = await getProperty(id);
    if (p) {
      setActiveProperty(p);
      setTab("new");
    }
  }

  function backFromVisit() {
    setActiveProperty(null);
    refresh();
    setTab("list");
  }

  if (!loaded) {
    return (
      <div className="min-h-screen bg-field-bg flex items-center justify-center">
        <p className="text-field-muted text-sm">Loading saved data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-field-bg">
      {tab === "new" && activeProperty && <NewVisit initial={activeProperty} onBack={backFromVisit} />}

      {tab === "list" && <PropertyList properties={properties} onOpen={openProperty} onNew={startNewVisit} />}

      {tab === "settings" && <Settings properties={properties} onDataChanged={refresh} />}

      {tab !== "new" && (
        <nav className="fixed bottom-0 left-0 right-0 bg-field-card border-t border-field-line flex safe-bottom">
          <button
            onClick={startNewVisit}
            className="flex-1 py-3 flex flex-col items-center text-field-accent"
          >
            <span className="text-xl">📍</span>
            <span className="text-xs mt-0.5">New Visit</span>
          </button>
          <button
            onClick={() => setTab("list")}
            className={`flex-1 py-3 flex flex-col items-center ${tab === "list" ? "text-field-accent" : "text-field-muted"}`}
          >
            <span className="text-xl">📋</span>
            <span className="text-xs mt-0.5">Saved Properties</span>
          </button>
          <button
            onClick={() => setTab("settings")}
            className={`flex-1 py-3 flex flex-col items-center ${tab === "settings" ? "text-field-accent" : "text-field-muted"}`}
          >
            <span className="text-xl">⚙️</span>
            <span className="text-xs mt-0.5">Settings</span>
          </button>
        </nav>
      )}
    </div>
  );
}

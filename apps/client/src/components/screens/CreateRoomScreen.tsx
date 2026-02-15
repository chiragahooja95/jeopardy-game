import { type RoomConfig } from "@jeopardy/shared";
import { useMemo, useState } from "react";

interface CreateRoomScreenProps {
  onBack: () => void;
  onCreateRoom: (config: RoomConfig) => void;
  isSubmitting: boolean;
}

const DEFAULT_CONFIG: RoomConfig = {
  categorySelection: "random",
  questionCount: 25,
  timerSpeed: "standard",
  dailyDoubleCount: 2,
  finalJeopardyEnabled: true
};

const PACK_OPTIONS = ["general", "science", "history"] as const;

export const CreateRoomScreen = ({ onBack, onCreateRoom, isSubmitting }: CreateRoomScreenProps) => {
  const [config, setConfig] = useState<RoomConfig>(DEFAULT_CONFIG);
  const [manualCategories, setManualCategories] = useState("");

  const parsedCategories = useMemo(
    () =>
      manualCategories
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    [manualCategories]
  );

  return (
    <main className="screen menu-screen">
      <header className="row">
        <h1>Cook Up a Chaos Room</h1>
        <button className="btn-violet" disabled={isSubmitting} onClick={onBack}>
          Back
        </button>
      </header>

      <section className="panel panel-sky">
        <h2>Pick Your Flavor of Mayhem</h2>
        <div className="row">
          <label>
            Mode
            <select
              value={config.categorySelection}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  categorySelection: event.target.value as RoomConfig["categorySelection"]
                }))
              }
            >
              <option value="random">Random</option>
              <option value="true_random">True Random</option>
              <option value="pack">Question Pack</option>
              <option value="manual">Manual Categories</option>
            </select>
          </label>

          {config.categorySelection === "pack" ? (
            <label>
              Pack
              <select
                value={config.questionPack ?? "general"}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    questionPack: event.target.value
                  }))
                }
              >
                {PACK_OPTIONS.map((pack) => (
                  <option key={pack} value={pack}>
                    {pack}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {config.categorySelection === "manual" ? (
          <>
            <label htmlFor="manual-categories">Categories (comma separated)</label>
            <input
              id="manual-categories"
              value={manualCategories}
              onChange={(event) => setManualCategories(event.target.value)}
              placeholder="World Geography, Science and Nature, Modern History"
            />
            <p className="status">Detected: {parsedCategories.length} categories</p>
          </>
        ) : null}
      </section>

      <section className="panel panel-gold">
        <h2>Chaos Dials</h2>
        <div className="row">
          <label>
            Question Count
            <select
              value={String(config.questionCount)}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  questionCount: Number(event.target.value) as 25 | 15
                }))
              }
            >
              <option value="25">25 (Standard)</option>
              <option value="15">15 (Quick)</option>
            </select>
          </label>

          <label>
            Timer Speed
            <select
              value={config.timerSpeed}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  timerSpeed: event.target.value as RoomConfig["timerSpeed"]
                }))
              }
            >
              <option value="standard">Standard</option>
              <option value="fast">Fast</option>
            </select>
          </label>

          <label>
            Daily Doubles
            <select
              value={String(config.dailyDoubleCount)}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  dailyDoubleCount: Number(event.target.value) as 1 | 2 | 3
                }))
              }
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </label>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={config.finalJeopardyEnabled}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                finalJeopardyEnabled: event.target.checked
              }))
            }
          />
          Enable Final Jeopardy
        </label>
      </section>

      <section className="panel panel-indigo">
        <button
          className="btn-sunset"
          disabled={isSubmitting}
          onClick={() =>
            onCreateRoom({
              ...config,
              selectedCategories:
                config.categorySelection === "manual" ? parsedCategories : undefined
            })
          }
        >
          {isSubmitting ? "Creating..." : "Create Room"}
        </button>
        {isSubmitting ? (
          <p className="status loader-line">
            <span className="loader-dot" /> Creating lobby...
          </p>
        ) : null}
      </section>
    </main>
  );
};

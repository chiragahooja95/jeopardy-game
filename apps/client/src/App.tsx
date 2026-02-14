import { type RoomConfig } from "@jeopardy/shared";
import { useEffect, useState } from "react";
import { CreateRoomScreen } from "./components/screens/CreateRoomScreen";
import { HomeScreen } from "./components/screens/HomeScreen";
import { GameScreen } from "./components/screens/GameScreen";
import { LobbyScreen } from "./components/screens/LobbyScreen";
import { LobbyBrowserScreen } from "./components/screens/LobbyBrowserScreen";
import { StatsScreen } from "./components/screens/StatsScreen";
import { GameProvider, useGameContext } from "./contexts/GameContext";
import { UserProvider } from "./contexts/UserContext";
import { useUserContext } from "./contexts/UserContext";

type Screen = "home" | "stats" | "create_room" | "lobby_browser" | "lobby" | "game";
const ROOM_QUERY_KEY = "room";
const LAST_ROOM_CODE_KEY = "jeopardy_last_room_code";

const readRoomCodeFromUrl = (): string | null => {
  try {
    const value = new URLSearchParams(window.location.search).get(ROOM_QUERY_KEY);
    const code = value?.trim().toUpperCase() ?? "";
    return code.length === 4 ? code : null;
  } catch {
    return null;
  }
};

const writeRoomCodeToUrl = (roomCode: string | null) => {
  try {
    const url = new URL(window.location.href);
    if (roomCode) {
      url.searchParams.set(ROOM_QUERY_KEY, roomCode.toUpperCase());
    } else {
      url.searchParams.delete(ROOM_QUERY_KEY);
    }
    window.history.replaceState({}, "", url.toString());
  } catch {
    // ignore URL update failures
  }
};

const readLastRoomCode = (): string | null => {
  try {
    const value = localStorage.getItem(LAST_ROOM_CODE_KEY);
    const code = value?.trim().toUpperCase() ?? "";
    return code.length === 4 ? code : null;
  } catch {
    return null;
  }
};

const writeLastRoomCode = (roomCode: string | null) => {
  try {
    if (roomCode) {
      localStorage.setItem(LAST_ROOM_CODE_KEY, roomCode.toUpperCase());
    } else {
      localStorage.removeItem(LAST_ROOM_CODE_KEY);
    }
  } catch {
    // ignore storage errors
  }
};

const AppShell = () => {
  const [screen, setScreen] = useState<Screen>("home");
  const [autoJoinAttemptedCode, setAutoJoinAttemptedCode] = useState<string | null>(null);
  const { userId, userName, ensureUserProfile } = useUserContext();
  const {
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    room,
    playerId,
    isRoomActionPending,
    roomAction,
    clearRoomActionPending
  } = useGameContext();

  const requireUser = (): { userId: string; userName: string } | null => {
    const trimmed = userName?.trim() ?? "";
    if (!userId || !trimmed) {
      return null;
    }
    return { userId, userName: trimmed };
  };

  const ensureUser = (): { userId: string; userName: string } | null => {
    const existing = requireUser();
    if (existing) {
      return existing;
    }

    return ensureUserProfile("Player");
  };

  useEffect(() => {
    if (room?.code) {
      writeRoomCodeToUrl(room.code);
      writeLastRoomCode(room.code);
    }
  }, [room?.code]);

  useEffect(() => {
    if (!room) {
      if ((screen === "lobby" || screen === "game") && !isRoomActionPending) {
        setScreen("home");
      }
      return;
    }

    if (room.status === "lobby") {
      if (screen === "game") {
        setScreen("lobby");
      }
      return;
    }

    if (screen === "lobby") {
      setScreen("game");
    }
  }, [room, screen, isRoomActionPending]);

  useEffect(() => {
    if (room || isRoomActionPending) {
      return;
    }

    const roomCode = readRoomCodeFromUrl();
    if (!roomCode || autoJoinAttemptedCode === roomCode) {
      return;
    }

    const user = ensureUser();
    if (!user) {
      return;
    }

    setAutoJoinAttemptedCode(roomCode);
    joinRoom({
      roomCode,
      userId: user.userId,
      userName: user.userName,
      asSpectator: true
    });
    setScreen("lobby");
  }, [room, isRoomActionPending, autoJoinAttemptedCode, joinRoom, userId, userName, ensureUserProfile]);

  const roomActionLabel =
    roomAction === "joining" ? "Joining lobby..." : roomAction === "creating" ? "Creating lobby..." : null;

  if (screen === "stats") {
    return <StatsScreen onBack={() => setScreen("home")} />;
  }

  if (screen === "create_room") {
    return (
      <CreateRoomScreen
        onBack={() => setScreen("home")}
        isSubmitting={isRoomActionPending}
        onCreateRoom={(config: RoomConfig) => {
          const user = ensureUser();
          if (!user) {
            return;
          }

          createRoom({
            userId: user.userId,
            userName: user.userName,
            config
          });
          setScreen("lobby");
        }}
      />
    );
  }

  if (screen === "lobby_browser") {
    return (
      <LobbyBrowserScreen
        onBack={() => setScreen("home")}
        onJoinLobby={(roomCode) => {
          const user = ensureUser();
          if (!user) {
            return;
          }

          joinRoom({
            roomCode,
            userId: user.userId,
            userName: user.userName,
            asSpectator: true
          });
          setScreen("lobby");
        }}
      />
    );
  }

  if (screen === "lobby" && !room && isRoomActionPending) {
    return (
      <main className="screen menu-screen">
        <section className="panel panel-indigo">
          <h1>{roomActionLabel ?? "Connecting..."}</h1>
          <p className="status loader-line">
            <span className="loader-dot" /> Please wait while we sync your room.
          </p>
          <div className="row">
            <button
              className="btn-coral"
              onClick={() => {
                clearRoomActionPending();
                writeRoomCodeToUrl(null);
                writeLastRoomCode(null);
                setScreen("home");
              }}
            >
              Cancel
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "lobby" && room) {
    return (
      <LobbyScreen
        room={room}
        playerId={playerId}
        onBackHome={() => setScreen("home")}
        onLeaveRoom={() => {
          leaveRoom();
          writeRoomCodeToUrl(null);
          writeLastRoomCode(null);
          setScreen("home");
        }}
        onStartGame={startGame}
      />
    );
  }

  if (screen === "game") {
    return (
      <GameScreen
        onLeave={() => {
          writeRoomCodeToUrl(null);
          writeLastRoomCode(null);
          setScreen("home");
        }}
      />
    );
  }

  return (
    <HomeScreen
      onOpenStats={() => setScreen("stats")}
      onOpenCreateRoom={() => setScreen("create_room")}
      onJoinRoom={(roomCode) => {
        const user = ensureUser();
        if (!user || roomCode.trim().length !== 4) {
          return;
        }
        joinRoom({
          roomCode,
          userId: user.userId,
          userName: user.userName,
          asSpectator: true
        });
        setScreen("lobby");
      }}
      onOpenLobby={() => {
        setScreen("lobby_browser");
      }}
      isRoomActionPending={isRoomActionPending}
      roomActionLabel={roomActionLabel}
    />
  );
};

const App = () => (
  <UserProvider>
    <GameProvider>
      <AppShell />
    </GameProvider>
  </UserProvider>
);

export default App;

import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  createEmptyUserStats,
  type UserCreatedPayload,
  type UserStats,
  type UserStatsPayload
} from "@jeopardy/shared";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { useSocket } from "../hooks/useSocket";

const USER_ID_KEY = "jeopardy_user_id";
const USER_NAME_KEY = "jeopardy_user_name";

interface UserContextState {
  userId: string | null;
  userName: string | null;
  stats: UserStats | null;
  isConnected: boolean;
  isLoadingStats: boolean;
  saveUserName: (name: string) => void;
  ensureUserProfile: (fallbackName?: string) => { userId: string; userName: string };
  refreshStats: () => void;
}

const UserContext = createContext<UserContextState | undefined>(undefined);

const readStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage failures in private mode
  }
};

const generateUserId = (): string => {
  const cryptoObj =
    typeof globalThis !== "undefined"
      ? (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
      : undefined;

  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }

  return `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [userId, setUserId] = useState<string | null>(() => readStorage(USER_ID_KEY));
  const [userName, setUserName] = useState<string | null>(() => readStorage(USER_NAME_KEY));
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const { socket, isConnected } = useSocket();

  const refreshStats = useCallback(() => {
    if (!userId) {
      return;
    }

    setIsLoadingStats(true);
    socket.emit(CLIENT_EVENTS.GET_USER_STATS, { userId });
  }, [socket, userId]);

  const saveUserName = useCallback(
    (name: string) => {
      const nextName = name.trim();
      if (!nextName) {
        return;
      }

      const nextUserId = userId ?? generateUserId();
      setUserId(nextUserId);
      setUserName(nextName);
      writeStorage(USER_ID_KEY, nextUserId);
      writeStorage(USER_NAME_KEY, nextName);

      if (isConnected) {
        socket.emit(CLIENT_EVENTS.CREATE_USER, {
          userId: nextUserId,
          name: nextName
        });
      }
    },
    [isConnected, socket, userId]
  );

  const ensureUserProfile = useCallback(
    (fallbackName: string = "Player") => {
      const currentName = userName?.trim() ?? "";
      const nextName = currentName || fallbackName;
      const nextUserId = userId ?? generateUserId();

      if (userId !== nextUserId) {
        setUserId(nextUserId);
        writeStorage(USER_ID_KEY, nextUserId);
      }
      if (userName !== nextName) {
        setUserName(nextName);
        writeStorage(USER_NAME_KEY, nextName);
      }

      if (isConnected) {
        socket.emit(CLIENT_EVENTS.CREATE_USER, {
          userId: nextUserId,
          name: nextName
        });
      }

      return { userId: nextUserId, userName: nextName };
    },
    [isConnected, socket, userId, userName]
  );

  useEffect(() => {
    const handleUserCreated = ({ user }: UserCreatedPayload) => {
      setUserId(user.id);
      setUserName(user.name);
      writeStorage(USER_ID_KEY, user.id);
      writeStorage(USER_NAME_KEY, user.name);
    };

    const handleUserStats = ({ stats: nextStats }: UserStatsPayload) => {
      setStats(nextStats);
      setIsLoadingStats(false);
    };

    const handleError = () => {
      setIsLoadingStats(false);
    };

    socket.on(SERVER_EVENTS.USER_CREATED, handleUserCreated);
    socket.on(SERVER_EVENTS.USER_STATS, handleUserStats);
    socket.on(SERVER_EVENTS.ERROR, handleError);

    return () => {
      socket.off(SERVER_EVENTS.USER_CREATED, handleUserCreated);
      socket.off(SERVER_EVENTS.USER_STATS, handleUserStats);
      socket.off(SERVER_EVENTS.ERROR, handleError);
    };
  }, [socket]);

  useEffect(() => {
    if (!isConnected || !userId) {
      return;
    }

    socket.emit(CLIENT_EVENTS.CREATE_USER, {
      userId,
      name: userName ?? "Player"
    });
    refreshStats();
  }, [isConnected, refreshStats, socket, userId, userName]);

  const value = useMemo<UserContextState>(
    () => ({
      userId,
      userName,
      stats: stats ?? createEmptyUserStats(),
      isConnected,
      isLoadingStats,
      saveUserName,
      ensureUserProfile,
      refreshStats
    }),
    [ensureUserProfile, isConnected, isLoadingStats, refreshStats, saveUserName, stats, userId, userName]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUserContext = (): UserContextState => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUserContext must be used inside UserProvider");
  }
  return context;
};

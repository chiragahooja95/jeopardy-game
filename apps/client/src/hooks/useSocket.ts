import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@jeopardy/shared";

let socketInstance: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

const getSocket = (): Socket<ServerToClientEvents, ClientToServerEvents> => {
  if (socketInstance) {
    return socketInstance;
  }

  const runtimeDefaultUrl = (() => {
    if (typeof window === "undefined") {
      return "http://localhost:3001";
    }

    if (import.meta.env.DEV) {
      const protocol = window.location.protocol === "https:" ? "https:" : "http:";
      return `${protocol}//${window.location.hostname}:3001`;
    }

    return window.location.origin;
  })();

  const url = import.meta.env.VITE_SOCKET_URL ?? runtimeDefaultUrl;
  socketInstance = io(url, { autoConnect: true });
  return socketInstance;
};

export const useSocket = () => {
  const [socket] = useState(getSocket);
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, [socket]);

  return { socket, isConnected };
};

import Peer from "peerjs";
import { anotherCode, makeCode, peerIdFor } from "./lib/net";

export type RoomLink = {
  send: (raw: string) => void;
  /** Close the friend without closing the room. */
  dropGuest: () => void;
  close: () => void;
};

export function openHost(handlers: {
  onReady: (code: string) => void;
  onData: (raw: unknown) => void;
  onGuest: (connected: boolean) => void;
  onError: (message: string) => void;
}): RoomLink {
  let closed = false;
  let code = makeCode();
  let peer: Peer | null = null;
  let guest: { send: (data: unknown) => void; close: () => void } | null = null;

  const listen = (): void => {
    peer = new Peer(peerIdFor(code));
    peer.on("open", () => {
      if (!closed) handlers.onReady(code);
    });
    peer.on("connection", (incoming) => {
      if (guest) {
        incoming.on("open", () => {
          incoming.send(JSON.stringify({ t: "full" }));
          incoming.close();
        });
        return;
      }
      guest = incoming;
      incoming.on("data", (data) => handlers.onData(data));
      incoming.on("open", () => {
        incoming.send(JSON.stringify({ t: "welcome", slot: 2, roster: [1, 2] }));
        handlers.onGuest(true);
      });
      incoming.on("close", () => {
        if (guest === incoming) guest = null;
        handlers.onGuest(false);
      });
    });
    peer.on("error", (error) => {
      if (closed) return;
      if (error.type === "unavailable-id") {
        peer?.destroy();
        code = anotherCode(code);
        listen();
        return;
      }
      handlers.onError(error.message || "Could not open the room");
    });
  };
  listen();
  return {
    send(raw) {
      guest?.send(raw);
    },
    dropGuest() {
      const current = guest;
      if (!current) return;
      guest = null;
      current.close();
    },
    close() {
      closed = true;
      guest?.close();
      peer?.destroy();
    },
  };
}

export function openGuest(
  code: string,
  handlers: {
    onOpen: () => void;
    onData: (raw: unknown) => void;
    onClose: () => void;
    onError: (message: string) => void;
  },
): RoomLink {
  let closed = false;
  let link: { send: (data: unknown) => void; close: () => void } | null = null;
  const peer = new Peer();
  peer.on("open", () => {
    if (closed) return;
    const conn = peer.connect(peerIdFor(code), { reliable: true });
    link = conn;
    conn.on("open", () => handlers.onOpen());
    conn.on("data", (data) => handlers.onData(data));
    conn.on("close", () => handlers.onClose());
    conn.on("error", (error) => handlers.onError(error.message || "Could not join"));
  });
  peer.on("error", (error) => {
    if (!closed) handlers.onError(error.message || "Could not join");
  });
  return {
    send(raw) {
      link?.send(raw);
    },
    dropGuest() {},
    close() {
      closed = true;
      link?.close();
      peer.destroy();
    },
  };
}

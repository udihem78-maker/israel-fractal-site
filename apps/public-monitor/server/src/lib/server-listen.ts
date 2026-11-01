import { createServer } from "node:http";
import type { RequestListener } from "node:http";

export function listen(
  app: RequestListener,
  port: number,
  host: string,
  handlers: {
    onListening: () => void;
    onError: (err: Error) => void;
  },
) {
  const server = createServer(app);
  // Attach before listen so bind failures cannot become unhandled events.
  server.on("error", handlers.onError);
  server.once("listening", handlers.onListening);
  server.listen(port, host);
  return server;
}

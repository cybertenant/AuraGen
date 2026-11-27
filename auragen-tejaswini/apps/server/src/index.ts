import { createServer } from "node:http";
import { config } from "./config.js";
import { createApp, defaultGenerator } from "./app.js";
import { attachSockets } from "./socket.js";

const generator = defaultGenerator();
const app = createApp({ generator });
const server = createServer(app);

attachSockets(server, generator);

server.listen(config.port, () => {
  console.log(`AuraGen server listening on http://localhost:${config.port}`);
});

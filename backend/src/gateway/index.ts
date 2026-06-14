/**
 * Gateway entrypoint — starts all hardware communication servers.
 * Called once after the HTTP server is listening.
 *
 * Startup order matters:
 *   1. Prisma must be connected (it is, since the HTTP server already uses it)
 *   2. Socket.io must be set up (setupSocket() is called before startGateways())
 *   3. Then TCP servers and MQTT bridge can start
 *
 * Any single gateway failure is caught and logged; it does not bring down
 * the others or the main HTTP server.
 */

import { startTcpServers } from './tcpServer';
import { startMqttBridge } from './mqttBridge';

export function startGateways(): void {
  try {
    startTcpServers();
  } catch (err) {
    console.error('[gateway] TCP servers failed to start:', err);
  }

  try {
    startMqttBridge();
  } catch (err) {
    console.error('[gateway] MQTT bridge failed to start:', err);
  }
}

/**
 * TCP gateway server — three separate ports handle three distinct wire protocols.
 *
 * Port GT06_PORT  (default 5000) — GT06 binary protocol
 *   Devices: Concox, Coban, Sinotrack, JI-900, TK103B, and most budget
 *   Chinese trackers that accept a server IP + port via SMS command.
 *
 * Port TELTONIKA_PORT (default 5001) — Teltonika Codec 8 / 8E
 *   Devices: Teltonika FMB001, FMB010, FMB920, FMB130, FMB640, GH5200, etc.
 *
 * Port NMEA_PORT (default 5002) — NMEA 0183 text over TCP
 *   Devices: SIM7600/EC21 modules in passthrough mode, some Quectel loggers,
 *   any device configured to stream raw NMEA sentences.
 *
 * All three call processTelemetry() so alerts, geofence checks, and Socket.io
 * broadcasts are handled identically regardless of the source protocol.
 */

import net from 'net';
import { env } from '../config/env';
import { parseGT06Packet, buildGT06Ack } from './parsers/gt06';
import { parseTeltonikaImei, parseTeltonikaPacket } from './parsers/teltonika';
import { NmeaAccumulator } from './parsers/nmea';
import { processTelemetry, findVehicleByImei } from './telemetry';

// ── GT06 server ───────────────────────────────────────────────────────────────

function createGT06Server(): net.Server {
  return net.createServer((socket) => {
    let buffer = Buffer.alloc(0);
    let imei: string | null = null;
    let vehicleId: string | null = null;

    const addr = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[GT06] connected: ${addr}`);

    socket.on('data', async (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      while (buffer.length >= 5) {
        const packet = parseGT06Packet(buffer);
        if (!packet) break;

        buffer = buffer.slice(packet.bytesConsumed);

        try {
          if (packet.type === 'LOGIN' && packet.imei) {
            imei = packet.imei;
            vehicleId = await findVehicleByImei(imei);
            // Always ACK login, even for unregistered devices (prevents tracker retry loops)
            socket.write(buildGT06Ack(0x01, packet.serialNo));
            if (!vehicleId) {
              console.warn(`[GT06] unregistered IMEI: ${imei}`);
            }
          }

          if ((packet.type === 'LOCATION' || packet.type === 'ALARM') && vehicleId) {
            await processTelemetry(vehicleId, {
              lat: packet.lat,
              lng: packet.lng,
              speed: packet.speed,
              heading: packet.heading,
              satellites: packet.satellites,
              timestamp: packet.timestamp,
              sosAlert: packet.type === 'ALARM' && packet.alarmType === 0x01,
              harshBraking: packet.type === 'ALARM' && packet.alarmType === 0x0e,
            });
            // ACK location packets
            socket.write(buildGT06Ack(0x22, packet.serialNo));
          }

          if (packet.type === 'HEARTBEAT') {
            socket.write(buildGT06Ack(0x12, packet.serialNo));
          }
        } catch (err) {
          console.error(`[GT06] processing error for IMEI ${imei}:`, err);
        }
      }
    });

    socket.on('error', (err) => console.error(`[GT06] socket error ${addr}:`, err.message));
    socket.on('close', () => console.log(`[GT06] disconnected: ${addr}`));
  });
}

// ── Teltonika server ──────────────────────────────────────────────────────────

function createTeltonikaServer(): net.Server {
  return net.createServer((socket) => {
    let buffer = Buffer.alloc(0);
    let imei: string | null = null;
    let vehicleId: string | null = null;
    let handshakeDone = false;

    const addr = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[Teltonika] connected: ${addr}`);

    socket.on('data', async (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      // Phase 1: IMEI handshake
      if (!handshakeDone) {
        const hs = parseTeltonikaImei(buffer);
        if (!hs) return; // wait for more bytes
        imei = hs.imei;
        buffer = buffer.slice(hs.bytesConsumed);
        handshakeDone = true;

        vehicleId = await findVehicleByImei(imei);
        if (vehicleId) {
          socket.write(Buffer.from([0x01])); // accept
        } else {
          console.warn(`[Teltonika] unregistered IMEI: ${imei}`);
          socket.write(Buffer.from([0x01])); // still accept to avoid tracker retry storms
        }
        return;
      }

      // Phase 2: Codec 8 / 8E data packets
      while (buffer.length >= 12) {
        const packet = parseTeltonikaPacket(buffer);
        if (!packet) break;

        buffer = buffer.slice(packet.bytesConsumed);

        if (!packet.crcValid) {
          console.warn(`[Teltonika] CRC mismatch for IMEI ${imei}`);
          // ACK with 0 so device resends
          const ack = Buffer.alloc(4);
          ack.writeUInt32BE(0);
          socket.write(ack);
          continue;
        }

        // ACK: number of records received
        const ack = Buffer.alloc(4);
        ack.writeUInt32BE(packet.recordCount);
        socket.write(ack);

        if (!vehicleId) continue;

        try {
          for (const record of packet.records) {
            await processTelemetry(vehicleId, record);
          }
        } catch (err) {
          console.error(`[Teltonika] processing error for IMEI ${imei}:`, err);
        }
      }
    });

    socket.on('error', (err) => console.error(`[Teltonika] socket error ${addr}:`, err.message));
    socket.on('close', () => console.log(`[Teltonika] disconnected: ${addr}`));
  });
}

// ── NMEA server ───────────────────────────────────────────────────────────────

function createNmeaServer(): net.Server {
  return net.createServer((socket) => {
    // NMEA devices must send their IMEI as the very first line before sentences:
    //   IMEI:356307042441013\r\n
    // This is a common convention for NMEA-over-TCP trackers.
    let lineBuffer = '';
    let vehicleId: string | null = null;
    let imei: string | null = null;
    const accumulator = new NmeaAccumulator();

    const addr = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[NMEA] connected: ${addr}`);

    socket.on('data', async (chunk) => {
      lineBuffer += chunk.toString('ascii');
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() ?? ''; // keep incomplete last line

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        // IMEI identification line
        if (!vehicleId && line.startsWith('IMEI:')) {
          imei = line.slice(5).trim();
          vehicleId = await findVehicleByImei(imei);
          if (!vehicleId) console.warn(`[NMEA] unregistered IMEI: ${imei}`);
          continue;
        }

        if (!vehicleId) continue;

        try {
          const payload = accumulator.feed(line);
          if (payload) {
            await processTelemetry(vehicleId, payload);
          }
        } catch (err) {
          console.error(`[NMEA] processing error for IMEI ${imei}:`, err);
        }
      }
    });

    socket.on('error', (err) => console.error(`[NMEA] socket error ${addr}:`, err.message));
    socket.on('close', () => console.log(`[NMEA] disconnected: ${addr}`));
  });
}

// ── Start all three TCP servers ───────────────────────────────────────────────

export function startTcpServers(): void {
  const gt06Port = env.TCP_GT06_PORT;
  const teltonikaPort = env.TCP_TELTONIKA_PORT;
  const nmeaPort = env.TCP_NMEA_PORT;

  createGT06Server().listen(gt06Port, () =>
    console.log(`[GT06] TCP server listening on :${gt06Port}`),
  );

  createTeltonikaServer().listen(teltonikaPort, () =>
    console.log(`[Teltonika] TCP server listening on :${teltonikaPort}`),
  );

  createNmeaServer().listen(nmeaPort, () =>
    console.log(`[NMEA] TCP server listening on :${nmeaPort}`),
  );
}

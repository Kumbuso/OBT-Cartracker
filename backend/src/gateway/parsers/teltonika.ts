/**
 * Teltonika Codec 8 / Codec 8 Extended parser — used by Teltonika FMB series
 * (FMB001, FMB010, FMB920, FMB130, etc.) and compatible devices.
 *
 * TCP handshake (before data packets):
 *   Client → [2-byte BE length][IMEI as ASCII]
 *   Server → 0x01 (accept) | 0x00 (reject)
 *
 * Codec 8 packet:
 *   [4 bytes: 0x00000000 preamble]
 *   [4 bytes: data field length]
 *   [1 byte: codec ID = 0x08]
 *   [1 byte: number of records]
 *   [...AVL records...]
 *   [1 byte: number of records (duplicate)]
 *   [4 bytes: CRC-16/IBM of data field]
 *
 * Codec 8E (extended) uses 2-byte IO IDs and 2-byte element counts.
 */

import { TelemetryPayload } from '../telemetry';

// --- CRC-16/IBM (CRC-16/ARC) ---
function crc16(data: Buffer): number {
  let crc = 0;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      if (crc & 1) crc = (crc >>> 1) ^ 0xa001;
      else crc >>>= 1;
    }
  }
  return crc;
}

export interface TeltonikaHandshake {
  type: 'IMEI';
  imei: string;
  bytesConsumed: number;
}

export interface TeltonikaData {
  type: 'DATA';
  records: TelemetryPayload[];
  recordCount: number;
  crcValid: boolean;
  bytesConsumed: number;
}

export type TeltonikaPacket = TeltonikaHandshake | TeltonikaData | null;

/** Parse initial IMEI handshake from a newly-connected Teltonika device */
export function parseTeltonikaImei(buf: Buffer): TeltonikaHandshake | null {
  if (buf.length < 2) return null;
  const imeiLen = buf.readUInt16BE(0);
  if (buf.length < 2 + imeiLen) return null;
  const imei = buf.slice(2, 2 + imeiLen).toString('ascii').trim();
  return { type: 'IMEI', imei, bytesConsumed: 2 + imeiLen };
}

/** Parse a Codec 8 or Codec 8E data packet */
export function parseTeltonikaPacket(buf: Buffer): TeltonikaData | null {
  if (buf.length < 12) return null;

  // Preamble must be 4 zero bytes
  if (buf.readUInt32BE(0) !== 0) return null;

  const dataLength = buf.readUInt32BE(4);
  const totalLen = 4 + 4 + dataLength + 4; // preamble + dataLen field + data + CRC
  if (buf.length < totalLen) return null;

  const codecId = buf[8];
  if (codecId !== 0x08 && codecId !== 0x8e) return null;

  const isExtended = codecId === 0x8e;
  const numRecords = buf[9];

  // CRC covers from codec ID to end of records
  const crcData = buf.slice(8, 8 + dataLength);
  const expectedCrc = crc16(crcData);
  const actualCrc = buf.readUInt32BE(4 + 4 + dataLength);
  const crcValid = (expectedCrc & 0xffff) === (actualCrc & 0xffff);

  const records: TelemetryPayload[] = [];
  let offset = 10; // after preamble(4) + dataLen(4) + codecId(1) + numRecords(1)

  for (let r = 0; r < numRecords; r++) {
    if (offset + 24 > buf.length) break;

    // Timestamp (8 bytes, Unix ms)
    const tsMs = Number(buf.readBigUInt64BE(offset));
    const timestamp = new Date(tsMs);
    offset += 8;

    // Priority (1 byte, ignored for routing)
    offset += 1;

    // GPS element
    const lngRaw = buf.readInt32BE(offset); offset += 4;
    const latRaw = buf.readInt32BE(offset); offset += 4;
    const altitude = buf.readUInt16BE(offset); offset += 2;
    const heading = buf.readUInt16BE(offset); offset += 2;
    const satellites = buf[offset]; offset += 1;
    const speed = buf.readUInt16BE(offset); offset += 2;

    const lat = latRaw / 10_000_000;
    const lng = lngRaw / 10_000_000;

    const payload: TelemetryPayload = { lat, lng, speed, heading, altitude, satellites, timestamp };

    // IO elements
    const eventIoId = isExtended ? buf.readUInt16BE(offset) : buf[offset];
    offset += isExtended ? 2 : 1;
    const totalIoCount = isExtended ? buf.readUInt16BE(offset) : buf[offset];
    offset += isExtended ? 2 : 1;

    const ioMap: Record<number, number> = {};

    for (const byteSize of [1, 2, 4, 8] as const) {
      const count = isExtended ? buf.readUInt16BE(offset) : buf[offset];
      offset += isExtended ? 2 : 1;

      for (let i = 0; i < count; i++) {
        const ioId = isExtended ? buf.readUInt16BE(offset) : buf[offset];
        offset += isExtended ? 2 : 1;

        let value: number;
        if (byteSize === 1) { value = buf[offset]; }
        else if (byteSize === 2) { value = buf.readUInt16BE(offset); }
        else if (byteSize === 4) { value = buf.readUInt32BE(offset); }
        else { value = Number(buf.readBigUInt64BE(offset)); }
        offset += byteSize;

        ioMap[ioId] = value;
      }
    }

    // Map well-known Teltonika IO IDs to telemetry fields
    if (ioMap[239] !== undefined) payload.engineOn = ioMap[239] === 1; // ignition
    if (ioMap[16] !== undefined) payload.odometer = ioMap[16] / 1000;  // odometer in metres → km
    if (ioMap[12] !== undefined) payload.fuelLevel = ioMap[12];        // fuel level %
    if (ioMap[9] !== undefined)  payload.fuelRaw = ioMap[9];           // analog input (fuel sensor mV)
    if (ioMap[66] !== undefined) payload.batteryVoltage = ioMap[66] / 1000; // ext voltage mV → V
    if (ioMap[67] !== undefined) payload.batteryVoltage = ioMap[67] / 1000; // battery mV → V (prefer ext)

    // Harsh events (IO IDs vary by config but common assignments)
    if (ioMap[247] !== undefined) payload.harshBraking = ioMap[247] === 1;
    if (ioMap[248] !== undefined) payload.harshAcceleration = ioMap[248] === 1;

    // Temperature (IO 72–79 are temperature probe channels on some devices)
    if (ioMap[72] !== undefined) payload.temperature = ioMap[72] / 10;

    // SOS / panic button
    if (ioMap[236] !== undefined && ioMap[236] === 1) payload.sosAlert = true;

    // External power cut detection (IO 252)
    if (ioMap[252] !== undefined) payload.externalPower = ioMap[252] === 1;

    records.push(payload);
  }

  return { type: 'DATA', records, recordCount: numRecords, crcValid, bytesConsumed: totalLen };
}

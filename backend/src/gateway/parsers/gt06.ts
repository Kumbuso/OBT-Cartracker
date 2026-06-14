/**
 * GT06 binary protocol parser — used by Concox, Coban, Sinotrack, and most
 * affordable Chinese cellular GPS trackers.
 *
 * Frame format (short):
 *   [0x78][0x78][length][msg_type][...data...][serial_hi][serial_lo][crc][0x0D][0x0A]
 *   total bytes = length + 5
 *
 * Frame format (long, for extended data):
 *   [0x79][0x79][len_hi][len_lo][msg_type][...data...][serial_hi][serial_lo][crc][0x0D][0x0A]
 */

export type GT06MsgType = 'LOGIN' | 'LOCATION' | 'HEARTBEAT' | 'ALARM' | 'UNKNOWN';

export interface GT06Packet {
  type: GT06MsgType;
  imei?: string;
  lat?: number;
  lng?: number;
  speed?: number;
  heading?: number;
  satellites?: number;
  gpsValid?: boolean;
  alarmType?: number;
  voltage?: number;
  signalStrength?: number;
  serialNo: number;
  timestamp?: Date;
  bytesConsumed: number;
}

function parseBCDImei(buf: Buffer): string {
  let digits = '';
  for (const byte of buf) {
    digits += ((byte >> 4) & 0x0f).toString();
    digits += (byte & 0x0f).toString();
  }
  return digits.replace(/^0/, '');
}

function verifyChecksum(frame: Buffer, length: number): boolean {
  // XOR of all bytes from msg_type to last byte before checksum
  let xor = 0;
  for (let i = 3; i < 3 + length - 1; i++) {
    xor ^= frame[i];
  }
  return xor === frame[3 + length - 1];
}

export function parseGT06Packet(buf: Buffer): GT06Packet | null {
  if (buf.length < 5) return null;

  let isLong = false;
  let headerOffset = 0;
  let length = 0;

  if (buf[0] === 0x78 && buf[1] === 0x78) {
    // Short frame
    if (buf.length < 4) return null;
    length = buf[2];
    headerOffset = 3;
  } else if (buf[0] === 0x79 && buf[1] === 0x79) {
    // Long frame: 2-byte length
    if (buf.length < 5) return null;
    length = buf.readUInt16BE(2);
    headerOffset = 4;
    isLong = true;
  } else {
    return null;
  }

  const totalLen = headerOffset + length + 2; // +2 for stop bytes 0x0D 0x0A
  if (buf.length < totalLen) return null;

  const msgType = buf[headerOffset];
  // Serial number is 2 bytes before checksum, which is 1 byte before stop
  const serialNo = buf.readUInt16BE(totalLen - 4);

  // Data slice: bytes after msg_type, before serial number
  const dataStart = headerOffset + 1;
  const dataEnd = totalLen - 4; // exclusive
  const data = buf.slice(dataStart, dataEnd);

  const base = { serialNo, bytesConsumed: totalLen };

  switch (msgType) {
    case 0x01: {
      // Login packet — IMEI in first 8 bytes BCD
      if (data.length < 8) return { type: 'UNKNOWN', ...base };
      const imei = parseBCDImei(data.slice(0, 8));
      return { type: 'LOGIN', imei, ...base };
    }

    case 0x10:
    case 0x22: {
      // GPS location (0x22 is newer, 0x10 legacy — same structure)
      if (data.length < 18) return { type: 'UNKNOWN', ...base };

      const yy = data[0], mm = data[1], dd = data[2];
      const hh = data[3], mn = data[4], ss = data[5];
      const timestamp = new Date(Date.UTC(2000 + yy, mm - 1, dd, hh, mn, ss));

      const gpsInfo = data[6];
      const satellites = (gpsInfo >> 4) & 0x0f;
      const gpsFixed = (gpsInfo & 0x0f) > 0;

      const latRaw = data.readUInt32BE(7);
      const lngRaw = data.readUInt32BE(11);
      const speed = data[15];
      const courseStatus = data.readUInt16BE(16);

      const heading = courseStatus & 0x03ff;
      const isNorth = (courseStatus & 0x0400) !== 0;
      const isEast = (courseStatus & 0x0800) !== 0;
      const gpsValid = (courseStatus & 0x1000) !== 0;

      const lat = (latRaw / 1800000) * (isNorth ? 1 : -1);
      const lng = (lngRaw / 1800000) * (isEast ? 1 : -1);

      return { type: 'LOCATION', lat, lng, speed, heading, satellites, gpsValid, timestamp, ...base };
    }

    case 0x12:
    case 0x13: {
      // Heartbeat
      const voltage = data.length >= 1 ? data[0] : undefined;
      const signalStrength = data.length >= 2 ? data[1] : undefined;
      return { type: 'HEARTBEAT', voltage, signalStrength, ...base };
    }

    case 0x16: {
      // Alarm packet — first field is alarm type, then GPS data
      if (data.length < 19) return { type: 'ALARM', ...base };
      const alarmType = data[0];

      const yy = data[1], mm = data[2], dd = data[3];
      const hh = data[4], mn = data[5], ss = data[6];
      const timestamp = new Date(Date.UTC(2000 + yy, mm - 1, dd, hh, mn, ss));

      const latRaw = data.readUInt32BE(8);
      const lngRaw = data.readUInt32BE(12);
      const speed = data[16];
      const courseStatus = data.readUInt16BE(17);

      const heading = courseStatus & 0x03ff;
      const isNorth = (courseStatus & 0x0400) !== 0;
      const isEast = (courseStatus & 0x0800) !== 0;

      const lat = (latRaw / 1800000) * (isNorth ? 1 : -1);
      const lng = (lngRaw / 1800000) * (isEast ? 1 : -1);

      return { type: 'ALARM', alarmType, lat, lng, speed, heading, timestamp, ...base };
    }

    default:
      return { type: 'UNKNOWN', ...base };
  }
}

/** Build ACK response for a GT06 packet */
export function buildGT06Ack(msgType: number, serialNo: number): Buffer {
  const buf = Buffer.alloc(10);
  buf[0] = 0x78;
  buf[1] = 0x78;
  buf[2] = 0x05; // length: type(1) + serial(2) + crc(1) = 5... wait
  buf[3] = msgType;
  buf.writeUInt16BE(serialNo, 4);
  // CRC = XOR of msg_type + serial bytes
  buf[6] = msgType ^ (serialNo >> 8) ^ (serialNo & 0xff);
  buf[7] = 0x0d;
  buf[8] = 0x0a;
  return buf.slice(0, 9);
}

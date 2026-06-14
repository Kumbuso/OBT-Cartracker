/**
 * NMEA 0183 parser — used by bare-bones GPS modules and trackers that output
 * standard NMEA sentences over TCP/serial (e.g. some Quectel modules, SIM7600,
 * and any tracker in "NMEA passthrough" mode).
 *
 * Supported sentences:
 *   $GPRMC / $GNRMC — recommended minimum (position, speed, heading, date)
 *   $GPGGA / $GNGGA — fix data (altitude, satellite count, accuracy)
 *
 * Sentences are newline-delimited ASCII; multiple sentences per update are normal.
 * Callers should accumulate lines from a TCP stream and call parseLine() per line.
 */

import { TelemetryPayload } from '../telemetry';

function verifyNmeaChecksum(sentence: string): boolean {
  const starIdx = sentence.lastIndexOf('*');
  if (starIdx === -1) return true; // no checksum present, accept
  const body = sentence.slice(1, starIdx); // strip leading '$' and trailing '*XX'
  const expected = parseInt(sentence.slice(starIdx + 1, starIdx + 3), 16);
  let xor = 0;
  for (let i = 0; i < body.length; i++) xor ^= body.charCodeAt(i);
  return xor === expected;
}

function parseNmeaLatLng(
  raw: string,
  dir: string,
): number | undefined {
  if (!raw || !dir) return undefined;
  // Format: DDMM.MMMMM (lat) or DDDMM.MMMMM (lng)
  const dotIdx = raw.indexOf('.');
  if (dotIdx < 3) return undefined;
  const degLen = dotIdx - 2; // 2 for lat, 3 for lng
  const degrees = parseFloat(raw.slice(0, degLen));
  const minutes = parseFloat(raw.slice(degLen));
  const decimal = degrees + minutes / 60;
  return dir === 'S' || dir === 'W' ? -decimal : decimal;
}

/** Parse a single NMEA sentence. Returns a partial TelemetryPayload or null. */
export function parseNmeaSentence(line: string): Partial<TelemetryPayload> | null {
  const clean = line.trim();
  if (!clean.startsWith('$')) return null;
  if (!verifyNmeaChecksum(clean)) return null;

  // Strip checksum
  const body = clean.indexOf('*') !== -1 ? clean.slice(0, clean.lastIndexOf('*')) : clean;
  const fields = body.split(',');
  const type = fields[0].slice(1); // e.g. "GPRMC"

  if (type === 'GPRMC' || type === 'GNRMC') {
    // $GPRMC,HHMMSS.ss,A,LLLL.LL,a,YYYYY.YY,a,speed_knots,heading,DDMMYY,...
    if (fields.length < 10) return null;
    const status = fields[2]; // A=valid, V=invalid
    if (status !== 'A') return null;

    const lat = parseNmeaLatLng(fields[3], fields[4]);
    const lng = parseNmeaLatLng(fields[5], fields[6]);
    if (lat === undefined || lng === undefined) return null;

    const speedKnots = parseFloat(fields[7]);
    const speed = isNaN(speedKnots) ? 0 : speedKnots * 1.852; // knots → km/h
    const heading = parseFloat(fields[8]) || 0;

    // Parse date+time → UTC Date
    const timeStr = fields[1]; // HHMMSS.ss
    const dateStr = fields[9]; // DDMMYY
    let timestamp: Date | undefined;
    if (timeStr && dateStr && dateStr.length === 6) {
      const hh = parseInt(timeStr.slice(0, 2), 10);
      const mn = parseInt(timeStr.slice(2, 4), 10);
      const ss = parseInt(timeStr.slice(4, 6), 10);
      const dd = parseInt(dateStr.slice(0, 2), 10);
      const mo = parseInt(dateStr.slice(2, 4), 10) - 1;
      const yy = 2000 + parseInt(dateStr.slice(4, 6), 10);
      timestamp = new Date(Date.UTC(yy, mo, dd, hh, mn, ss));
    }

    return { lat, lng, speed, heading, timestamp };
  }

  if (type === 'GPGGA' || type === 'GNGGA') {
    // $GPGGA,HHMMSS.ss,LLLL.LL,a,YYYYY.YY,a,fix,sats,hdop,alt,M,...
    if (fields.length < 10) return null;
    const fixQuality = parseInt(fields[6], 10);
    if (fixQuality === 0) return null; // no fix

    const lat = parseNmeaLatLng(fields[2], fields[3]);
    const lng = parseNmeaLatLng(fields[4], fields[5]);
    if (lat === undefined || lng === undefined) return null;

    const satellites = parseInt(fields[7], 10) || undefined;
    const altitude = parseFloat(fields[9]) || undefined;

    return { lat, lng, satellites, altitude };
  }

  return null;
}

/**
 * Accumulate NMEA sentences for one position fix.
 * Pass partial payloads from parsNmeaSentence(); call flush() when
 * a $GPRMC arrives to get the merged TelemetryPayload.
 */
export class NmeaAccumulator {
  private pending: Partial<TelemetryPayload> = {};
  private hasRmc = false;

  feed(sentence: string): TelemetryPayload | null {
    const parsed = parseNmeaSentence(sentence);
    if (!parsed) return null;

    Object.assign(this.pending, parsed);

    const type = sentence.slice(1, sentence.indexOf(','));
    if (type === 'GPRMC' || type === 'GNRMC') {
      this.hasRmc = true;
    }

    // Emit a complete payload once we have RMC (mandatory minimum)
    if (this.hasRmc && this.pending.lat !== undefined) {
      const result = { ...this.pending } as TelemetryPayload;
      this.pending = {};
      this.hasRmc = false;
      return result;
    }

    return null;
  }
}

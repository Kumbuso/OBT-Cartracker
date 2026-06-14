/**
 * MQTT bridge — subscribes to an external MQTT broker and funnels IoT sensor
 * data into the shared telemetry processor.
 *
 * Supported topic patterns
 * ────────────────────────
 * fleet/{orgId}/vehicles/{imei}/telemetry
 *   Full JSON telemetry payload — GPS + fuel + temperature + OBD in one message.
 *   Published by multi-sensor telematics units (e.g. Teltonika with MQTT mode,
 *   custom ESP32/Raspberry Pi gateways, or Concox units with MQTT firmware).
 *
 * fleet/{orgId}/vehicles/{imei}/location
 *   GPS-only: { lat, lng, speed?, heading?, satellites?, timestamp? }
 *
 * fleet/{orgId}/vehicles/{imei}/fuel
 *   Fuel-sensor-only: { level?, raw?, liters?, odometer? }
 *   Used by standalone capacitive/ultrasonic fuel level sensors
 *   (BF-310, LLS-AF, Escort TD-500) connected via RS-485 → GSM bridge.
 *
 * fleet/{orgId}/vehicles/{imei}/temperature
 *   Cold-chain sensors: { value, unit? }
 *   Used by Bluetooth/wireless temp probes bridged via an on-vehicle hub.
 *
 * fleet/{orgId}/vehicles/{imei}/obd
 *   OBD-II PID data: { rpm?, coolantTemp?, throttle?, engineOn?, odometer? }
 *   Published by ELM327/STN1170 adapters connected to a Pi/ESP32 in the vehicle.
 *
 * Payload conventions
 * ───────────────────
 * All payloads are JSON. Fields are camelCase. Unknown fields are ignored.
 * fuel.raw accepts raw ADC values (0–4095) and auto-converts to percentage.
 * timestamp, if present, must be an ISO-8601 string or Unix milliseconds.
 */

import mqtt, { MqttClient } from 'mqtt';
import { env } from '../config/env';
import { processTelemetry, findVehicleByImei, TelemetryPayload } from './telemetry';

const TOPIC_PATTERNS = [
  'fleet/+/vehicles/+/telemetry',
  'fleet/+/vehicles/+/location',
  'fleet/+/vehicles/+/fuel',
  'fleet/+/vehicles/+/temperature',
  'fleet/+/vehicles/+/obd',
];

function extractImei(topic: string): string | null {
  // topic: fleet/{orgId}/vehicles/{imei}/{type}
  const parts = topic.split('/');
  return parts.length === 5 ? parts[3] : null;
}

function extractType(topic: string): string {
  return topic.split('/').pop() ?? '';
}

function parseTimestamp(raw: unknown): Date | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'number') return new Date(raw);
  if (typeof raw === 'string') {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

function buildPayload(type: string, data: Record<string, unknown>): TelemetryPayload {
  const ts = parseTimestamp(data.timestamp);

  switch (type) {
    case 'telemetry':
      return {
        lat: typeof data.lat === 'number' ? data.lat : undefined,
        lng: typeof data.lng === 'number' ? data.lng : undefined,
        speed: typeof data.speed === 'number' ? data.speed : undefined,
        heading: typeof data.heading === 'number' ? data.heading : undefined,
        altitude: typeof data.altitude === 'number' ? data.altitude : undefined,
        satellites: typeof data.satellites === 'number' ? data.satellites : undefined,
        fuelLevel: typeof data.fuelLevel === 'number' ? data.fuelLevel : undefined,
        fuelRaw: typeof data.fuelRaw === 'number' ? data.fuelRaw : undefined,
        engineOn: typeof data.engineOn === 'boolean' ? data.engineOn : undefined,
        odometer: typeof data.odometer === 'number' ? data.odometer : undefined,
        rpm: typeof data.rpm === 'number' ? data.rpm : undefined,
        coolantTemp: typeof data.coolantTemp === 'number' ? data.coolantTemp : undefined,
        batteryVoltage: typeof data.batteryVoltage === 'number' ? data.batteryVoltage : undefined,
        temperature: typeof data.temperature === 'number' ? data.temperature : undefined,
        harshBraking: typeof data.harshBraking === 'boolean' ? data.harshBraking : undefined,
        harshAcceleration: typeof data.harshAcceleration === 'boolean' ? data.harshAcceleration : undefined,
        externalPower: typeof data.externalPower === 'boolean' ? data.externalPower : undefined,
        tamperingDetected: typeof data.tamperingDetected === 'boolean' ? data.tamperingDetected : undefined,
        sosAlert: typeof data.sosAlert === 'boolean' ? data.sosAlert : undefined,
        timestamp: ts,
      };

    case 'location':
      return {
        lat: typeof data.lat === 'number' ? data.lat : undefined,
        lng: typeof data.lng === 'number' ? data.lng : undefined,
        speed: typeof data.speed === 'number' ? data.speed : undefined,
        heading: typeof data.heading === 'number' ? data.heading : undefined,
        satellites: typeof data.satellites === 'number' ? data.satellites : undefined,
        timestamp: ts,
      };

    case 'fuel':
      return {
        fuelLevel: typeof data.level === 'number' ? data.level
          : typeof data.fuelLevel === 'number' ? data.fuelLevel : undefined,
        fuelRaw: typeof data.raw === 'number' ? data.raw : undefined,
        odometer: typeof data.odometer === 'number' ? data.odometer : undefined,
        timestamp: ts,
      };

    case 'temperature':
      return {
        temperature: typeof data.value === 'number' ? data.value
          : typeof data.temperature === 'number' ? data.temperature : undefined,
        timestamp: ts,
      };

    case 'obd':
      return {
        rpm: typeof data.rpm === 'number' ? data.rpm : undefined,
        coolantTemp: typeof data.coolantTemp === 'number' ? data.coolantTemp : undefined,
        engineOn: typeof data.engineOn === 'boolean' ? data.engineOn : undefined,
        odometer: typeof data.odometer === 'number' ? data.odometer : undefined,
        speed: typeof data.speed === 'number' ? data.speed : undefined,
        timestamp: ts,
      };

    default:
      return { timestamp: ts };
  }
}

export function startMqttBridge(): void {
  const brokerUrl = env.MQTT_BROKER_URL;
  if (!brokerUrl) {
    console.log('[MQTT] MQTT_BROKER_URL not set — MQTT bridge disabled');
    return;
  }

  const client: MqttClient = mqtt.connect(brokerUrl, {
    username: env.MQTT_USER || undefined,
    password: env.MQTT_PASS || undefined,
    clientId: `obt-gateway-${Math.random().toString(16).slice(2, 8)}`,
    reconnectPeriod: 5000,
    connectTimeout: 10_000,
    clean: true,
  });

  client.on('connect', () => {
    console.log(`[MQTT] connected to ${brokerUrl}`);
    client.subscribe(TOPIC_PATTERNS, { qos: 1 }, (err) => {
      if (err) console.error('[MQTT] subscription error:', err.message);
      else console.log(`[MQTT] subscribed to ${TOPIC_PATTERNS.join(', ')}`);
    });
  });

  client.on('message', async (topic, msgBuf) => {
    const imei = extractImei(topic);
    if (!imei) return;

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(msgBuf.toString());
    } catch {
      console.warn(`[MQTT] non-JSON message on topic ${topic}`);
      return;
    }

    const vehicleId = await findVehicleByImei(imei);
    if (!vehicleId) {
      // Silently ignore — avoids log spam from unknown devices
      return;
    }

    const type = extractType(topic);
    const payload = buildPayload(type, data);

    try {
      await processTelemetry(vehicleId, payload);
    } catch (err) {
      console.error(`[MQTT] telemetry error for IMEI ${imei}:`, err);
    }
  });

  client.on('error', (err) => console.error('[MQTT] connection error:', err.message));
  client.on('reconnect', () => console.log('[MQTT] reconnecting…'));
  client.on('offline', () => console.log('[MQTT] offline'));
}

import 'dotenv/config';

const required = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET!,
  JWT_ACCESS_EXPIRES: (process.env.JWT_ACCESS_EXPIRES || '15m') as string,
  JWT_REFRESH_EXPIRES: (process.env.JWT_REFRESH_EXPIRES || '7d') as string,
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

  // Hardware gateway — TCP ports (one per protocol)
  TCP_GT06_PORT: parseInt(process.env.TCP_GT06_PORT || '5000', 10),
  TCP_TELTONIKA_PORT: parseInt(process.env.TCP_TELTONIKA_PORT || '5001', 10),
  TCP_NMEA_PORT: parseInt(process.env.TCP_NMEA_PORT || '5002', 10),

  // MQTT bridge — optional; bridge is disabled when MQTT_BROKER_URL is unset
  MQTT_BROKER_URL: process.env.MQTT_BROKER_URL || '',
  MQTT_USER: process.env.MQTT_USER || '',
  MQTT_PASS: process.env.MQTT_PASS || '',
};

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
};

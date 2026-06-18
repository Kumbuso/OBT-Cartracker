-- CreateEnum
CREATE TYPE "HwDeviceType" AS ENUM ('gps', 'fuel', 'obd', 'dashcam', 'temp');

-- CreateEnum
CREATE TYPE "HwDeviceStatus" AS ENUM ('online', 'offline', 'fault', 'low_battery');

-- CreateTable
CREATE TABLE "devices" (
  "id"        TEXT NOT NULL,
  "serial"    TEXT NOT NULL,
  "imei"      TEXT,
  "simNumber" TEXT,
  "type"      "HwDeviceType"   NOT NULL DEFAULT 'gps',
  "status"    "HwDeviceStatus" NOT NULL DEFAULT 'offline',
  "vehicleId" TEXT,
  "orgId"     TEXT NOT NULL,
  "firmware"  TEXT,
  "notes"     TEXT,
  "battery"   INTEGER,
  "signal"    INTEGER,
  "fault"     TEXT,
  "lastSeen"  TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: IMEI must be globally unique
CREATE UNIQUE INDEX "devices_imei_key" ON "devices"("imei");

-- CreateIndex: serial unique per org
CREATE UNIQUE INDEX "devices_serial_orgId_key" ON "devices"("serial", "orgId");

-- CreateIndex
CREATE INDEX "devices_orgId_idx"     ON "devices"("orgId");

-- AddForeignKey: devices → organizations
ALTER TABLE "devices"
  ADD CONSTRAINT "devices_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: devices → vehicles (nullable)
ALTER TABLE "devices"
  ADD CONSTRAINT "devices_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

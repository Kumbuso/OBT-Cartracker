-- AlterEnum: add new alert types for hardware events
ALTER TYPE "AlertType" ADD VALUE 'harsh_acceleration';
ALTER TYPE "AlertType" ADD VALUE 'sos';
ALTER TYPE "AlertType" ADD VALUE 'power_cut';
ALTER TYPE "AlertType" ADD VALUE 'tampering';

-- AlterTable: add hardware identification fields to vehicles
ALTER TABLE "vehicles"
  ADD COLUMN "imei"        TEXT,
  ADD COLUMN "deviceToken" TEXT;

-- CreateIndex: enforce uniqueness for hardware lookup fields
CREATE UNIQUE INDEX "vehicles_imei_key" ON "vehicles"("imei");
CREATE UNIQUE INDEX "vehicles_deviceToken_key" ON "vehicles"("deviceToken");

-- CreateTable: sensor_readings (extended telemetry from OBD, temp probes, etc.)
CREATE TABLE "sensor_readings" (
  "id"        TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "type"      TEXT NOT NULL,
  "value"     DOUBLE PRECISION NOT NULL,
  "unit"      TEXT,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sensor_readings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: fast lookup by vehicle + sensor type over time
CREATE INDEX "sensor_readings_vehicleId_type_timestamp_idx"
  ON "sensor_readings"("vehicleId", "type", "timestamp");

-- AddForeignKey: sensor_readings → vehicles (cascade delete)
ALTER TABLE "sensor_readings"
  ADD CONSTRAINT "sensor_readings_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

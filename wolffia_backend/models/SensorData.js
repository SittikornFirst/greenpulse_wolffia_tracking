import mongoose from "mongoose";

const sensorDataSchema = new mongoose.Schema(
  {
    device_id: {
      type: String,
      required: true,
      ref: "Device",
    },
    data_id: {
      type: String,
      required: true,
      unique: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    ph_value: {
      type: Number,
      required: true,
    },
    ec_value: {
      type: Number,
      required: true,
    },
    tds_value: {
      type: Number,
      required: true,
    },
    water_temperature_c: {
      type: Number,
      required: true,
    },
    air_temperature_c: {
      type: Number,
      required: true,
    },
    air_humidity: {
      type: Number,
      required: false,
    },
    light_intensity: {
      type: Number,
      required: true,
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

sensorDataSchema.index({ device_id: 1, timestamp: -1 });

const metricVirtuals = [
  { virtual: "ph", field: "ph_value" },
  { virtual: "ec", field: "ec_value" },
  { virtual: "tds", field: "tds_value" },
  { virtual: "temperature_water_c", field: "water_temperature_c" },
  { virtual: "temperature_air_c", field: "air_temperature_c" },
  // Note: light_intensity is already a real field, so no virtual needed
];

metricVirtuals.forEach(({ virtual, field }) => {
  sensorDataSchema.virtual(virtual).get(function () {
    const value = this[field];
    if (value === undefined) return undefined;
    return { value, status: "normal" };
  });
});

export default mongoose.model("SensorData", sensorDataSchema);

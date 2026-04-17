<template>
  <div class="add-device-form">
    <div class="form-header">
      <h3>{{ isEditing ? 'Edit Device' : 'Add New Device' }}</h3>
      <button v-if="showClose" @click="$emit('close')" class="btn-close">
        <X :size="20" />
      </button>
    </div>

    <form @submit.prevent="handleSubmit" class="device-form">
      <div class="form-group">
        <label for="deviceName">Device Name *</label>
        <input
          id="deviceName"
          v-model="form.device_name"
          type="text"
          placeholder="e.g., Greenhouse Sensor Alpha"
          :disabled="loading"
          required
        />
        <span class="error-text" v-if="errors.device_name">{{ errors.device_name }}</span>
      </div>

      <div class="form-group">
        <label for="deviceId">Device ID *</label>
        <input
          id="deviceId"
          v-model="form.device_id"
          type="text"
          placeholder="e.g., GREENPULSE-V1-XXXXX"
          :disabled="loading || isEditing"
          required
        />
        <span class="error-text" v-if="errors.device_id">{{ errors.device_id }}</span>
      </div>

      <div class="form-group">
        <label for="deviceType">Device Type</label>
        <select id="deviceType" v-model="form.device_type" :disabled="loading">
          <option value="environmental">Environmental</option>
          <option value="water_quality">Water Quality</option>
          <option value="weather">Weather Station</option>
          <option value="soil">Soil Monitoring</option>
        </select>
      </div>

      <div class="form-group">
        <label for="farmSelect">Farm</label>
        <select id="farmSelect" v-model="form.farmId" :disabled="loading">
          <option :value="null">No Farm Assigned</option>
          <option v-for="farm in farms" :key="farm._id || farm.farm_id" :value="farm._id || farm.farm_id">
            {{ farm.farm_name }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label for="location">Location</label>
        <input
          id="location"
          v-model="form.location"
          type="text"
          placeholder="e.g., Greenhouse A, Pond 1"
          :disabled="loading"
        />
      </div>

      <div class="form-section">
        <h4>Alert Thresholds</h4>
        
        <div class="form-row">
          <div class="form-group half">
            <label>pH Range</label>
            <div class="input-group">
              <input v-model.number="form.ph_min" type="number" step="0.1" placeholder="Min" :disabled="loading" />
              <span class="input-separator">-</span>
              <input v-model.number="form.ph_max" type="number" step="0.1" placeholder="Max" :disabled="loading" />
            </div>
          </div>

          <div class="form-group half">
            <label>EC (mS/cm)</label>
            <div class="input-group">
              <input v-model.number="form.ec_min" type="number" step="0.1" placeholder="Min" :disabled="loading" />
              <span class="input-separator">-</span>
              <input v-model.number="form.ec_max" type="number" step="0.1" placeholder="Max" :disabled="loading" />
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group half">
            <label>Water Temp (°C)</label>
            <div class="input-group">
              <input v-model.number="form.water_temp_min" type="number" step="1" placeholder="Min" :disabled="loading" />
              <span class="input-separator">-</span>
              <input v-model.number="form.water_temp_max" type="number" step="1" placeholder="Max" :disabled="loading" />
            </div>
          </div>

          <div class="form-group half">
            <label>Air Temp (°C)</label>
            <div class="input-group">
              <input v-model.number="form.air_temp_min" type="number" step="1" placeholder="Min" :disabled="loading" />
              <span class="input-separator">-</span>
              <input v-model.number="form.air_temp_max" type="number" step="1" placeholder="Max" :disabled="loading" />
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group half">
            <label>Light (lux)</label>
            <div class="input-group">
              <input v-model.number="form.light_min" type="number" placeholder="Min" :disabled="loading" />
              <span class="input-separator">-</span>
              <input v-model.number="form.light_max" type="number" placeholder="Max" :disabled="loading" />
            </div>
          </div>

          <div class="form-group half">
            <label>Humidity (%)</label>
            <div class="input-group">
              <input v-model.number="form.humidity_min" type="number" placeholder="Min" :disabled="loading" />
              <span class="input-separator">-</span>
              <input v-model.number="form.humidity_max" type="number" placeholder="Max" :disabled="loading" />
            </div>
          </div>
        </div>
      </div>

      <div class="form-group checkbox-group">
        <label class="checkbox-label">
          <input v-model="form.alert_enabled" type="checkbox" :disabled="loading" />
          <span>Enable Alert Notifications</span>
        </label>
      </div>

      <div class="form-actions">
        <button type="button" @click="handleCancel" class="btn btn-secondary">Cancel</button>
        <button type="submit" class="btn btn-primary" :disabled="loading">
          <span v-if="loading" class="loading-spinner"></span>
          {{ loading ? 'Saving...' : (isEditing ? 'Update Device' : 'Add Device') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script>
import { ref, reactive, onMounted, computed } from "vue";
import { X } from "lucide-vue-next";
import apiService from "@/services/api";
import { useFarmsStore } from "@/stores/module/farms";

export default {
  name: "AddDeviceForm",
  components: { X },
  props: {
    device: { type: Object, default: null },
    showClose: { type: Boolean, default: true },
    onSuccess: { type: Function, default: null },
    onCancel: { type: Function, default: null }
  },
  setup(props) {
    const farmsStore = useFarmsStore();
    const loading = ref(false);
    const errors = ref({});
    const isEditing = computed(() => !!props.device);

    const form = reactive({
      device_name: "",
      device_id: "",
      device_type: "environmental",
      farmId: null,
      location: "",
      alert_enabled: true,
      ph_min: 6.0, ph_max: 7.5,
      ec_min: 1.0, ec_max: 2.5,
      water_temp_min: 20, water_temp_max: 28,
      air_temp_min: 18, air_temp_max: 35,
      light_min: 3500, light_max: 6000,
      humidity_min: 60, humidity_max: 80
    });

    const farms = computed(() => farmsStore.farms || []);

    const initializeForm = () => {
      if (props.device) {
        form.device_name = props.device.device_name || "";
        form.device_id = props.device.device_id || "";
        form.device_type = props.device.device_type || "environmental";
        form.farmId = props.device.farmId || null;
        form.location = props.device.location || "";
        form.alert_enabled = props.device.configuration?.alert_enabled ?? true;
        
        if (props.device.configuration) {
          const c = props.device.configuration;
          form.ph_min = c.ph_min ?? 6.0; form.ph_max = c.ph_max ?? 7.5;
          form.ec_min = c.ec_value_min ?? 1.0; form.ec_max = c.ec_value_max ?? 2.5;
          form.water_temp_min = c.water_temp_min ?? 20; form.water_temp_max = c.water_temp_max ?? 28;
          form.air_temp_min = c.air_temp_min ?? 18; form.air_temp_max = c.air_temp_max ?? 35;
          form.light_min = c.light_intensity_min ?? 3500; form.light_max = c.light_intensity_max ?? 6000;
        }
      }
    };

    const validateForm = () => {
      errors.value = {};
      if (!form.device_name.trim()) errors.value.device_name = "Device name is required";
      if (!isEditing.value && !form.device_id.trim()) errors.value.device_id = "Device ID is required";
      return Object.keys(errors.value).length === 0;
    };

    const handleSubmit = async () => {
      if (!validateForm()) return;
      loading.value = true;
      
      try {
        const payload = {
          device_name: form.device_name,
          device_id: isEditing.value ? undefined : form.device_id,
          device_type: form.device_type,
          farm_id: form.farmId,
          location: form.location,
          config: {
            alert_enabled: form.alert_enabled,
            ph_min: form.ph_min, ph_max: form.ph_max,
            ec_value_min: form.ec_min, ec_value_max: form.ec_max,
            water_temp_min: form.water_temp_min, water_temp_max: form.water_temp_max,
            air_temp_min: form.air_temp_min, air_temp_max: form.air_temp_max,
            light_intensity_min: form.light_min, light_intensity_max: form.light_max
          }
        };

        if (isEditing.value) {
          await apiService.updateDevice(props.device.device_id, payload);
        } else {
          await apiService.createDevice(payload);
        }

        if (props.onSuccess) props.onSuccess();
      } catch (error) {
        console.error("Failed to save device:", error);
        errors.value.submit = error.message || "Failed to save device";
      } finally {
        loading.value = false;
      }
    };

    const handleCancel = () => {
      if (props.onCancel) props.onCancel();
    };

    onMounted(() => {
      initializeForm();
      farmsStore.fetchFarms({ page: 1, limit: 100 });
    });

    return { loading, errors, form, farms, isEditing, handleSubmit, handleCancel };
  }
};
</script>

<style scoped>
.add-device-form { background: white; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.1); max-width: 600px; margin: 0 auto; }
.form-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid #e5e7eb; }
.form-header h3 { margin: 0; font-size: 1.25rem; font-weight: 600; color: #1f2937; }
.btn-close { background: none; border: none; cursor: pointer; padding: 4px; color: #6b7280; border-radius: 4px; }
.btn-close:hover { background: #f3f4f6; color: #1f2937; }
.device-form { padding: 24px; }
.form-group { margin-bottom: 20px; }
.form-group label { display: block; font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 6px; }
.form-group input, .form-group select { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.875rem; color: #1f2937; background: white; }
.form-group input:focus, .form-group select:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
.form-group input:disabled, .form-group select:disabled { background: #f9fafb; color: #6b7280; cursor: not-allowed; }
.error-text { display: block; font-size: 0.75rem; color: #dc2626; margin-top: 4px; }
.form-section { margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
.form-section h4 { margin: 0 0 16px; font-size: 1rem; font-weight: 600; color: #1f2937; }
.form-row { display: flex; gap: 16px; margin-bottom: 16px; }
.form-group.half { flex: 1; }
.input-group { display: flex; align-items: center; gap: 8px; }
.input-group input { flex: 1; min-width: 0; }
.input-separator { color: #6b7280; font-weight: 500; }
.checkbox-group { margin-top: 16px; }
.checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.875rem; color: #374151; }
.checkbox-label input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; }
.form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 20px; font-size: 0.875rem; font-weight: 500; border-radius: 8px; cursor: pointer; transition: all 0.2s; border: none; }
.btn-primary { background: #10b981; color: white; }
.btn-primary:hover:not(:disabled) { background: #059669; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }
.btn-secondary:hover { background: #e5e7eb; }
.loading-spinner { width: 16px; height: 16px; border: 2px solid white; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 640px) { .form-row { flex-direction: column; gap: 12px; } .form-actions { flex-direction: column-reverse; } .btn { width: 100%; } }
</style>
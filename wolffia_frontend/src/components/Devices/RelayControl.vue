<template>
  <div class="relay-card">
    <div class="card-header">
      <h2>Relay Control</h2>
      <p class="subtitle">Real-time control for connected pumps, motors, and lights</p>
    </div>

    <div v-if="!relays || relays.length === 0" class="empty-state">
      <p>No relays configured for this device.</p>
    </div>

    <div v-else class="relays-grid">
      <div v-for="relay in relays" :key="relay.relay_id" class="relay-item">
        <div class="relay-info">
          <!-- Edit Name -->
          <div v-if="editingId === relay.relay_id" class="edit-name-group">
            <input 
              v-model="editNameInput" 
              class="name-input" 
              @keyup.enter="saveName(relay)"
              @keyup.esc="cancelEdit"
              ref="nameInputRef"
            />
            <button @click="saveName(relay)" class="action-btn save" :disabled="loading">
              <Check :size="16" />
            </button>
            <button @click="cancelEdit" class="action-btn cancel" :disabled="loading">
              <X :size="16" />
            </button>
          </div>
          <!-- Display Name -->
          <div v-else class="display-name-group">
            <span class="relay-name">{{ relay.name }}</span>
            <button @click="startEdit(relay)" class="action-btn edit-btn">
              <Edit2 :size="14" />
            </button>
          </div>
          <span class="relay-pin">GPIO {{ relay.pin }}</span>
        </div>

        <div class="relay-toggle">
          <label class="switch">
            <input 
              type="checkbox" 
              :checked="relay.status" 
              @change="toggleRelay(relay)"
              :disabled="loading"
            >
            <span class="slider round"></span>
          </label>
          <span :class="['status-label', relay.status ? 'status-on' : 'status-off']">
            {{ relay.status ? 'ON' : 'OFF' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, nextTick } from 'vue';
import { Edit2, Check, X, Power } from 'lucide-vue-next';
import apiService from '@/services/api';

export default {
  name: 'RelayControl',
  components: { Edit2, Check, X, Power },
  props: {
    deviceId: { type: String, required: true },
    relays: { type: Array, default: () => [] }
  },
  emits: ['config-updated'],
  setup(props, { emit }) {
    const loading = ref(false);
    const editingId = ref(null);
    const editNameInput = ref('');
    const nameInputRef = ref(null);

    const startEdit = (relay) => {
      editingId.value = relay.relay_id;
      editNameInput.value = relay.name;
      nextTick(() => {
        if (nameInputRef.value && nameInputRef.value[0]) {
          nameInputRef.value[0].focus();
        }
      });
    };

    const cancelEdit = () => {
      editingId.value = null;
      editNameInput.value = '';
    };

    const saveName = async (relay) => {
      if (!editNameInput.value.trim() || editNameInput.value === relay.name) {
        cancelEdit();
        return;
      }
      
      loading.value = true;
      try {
        await apiService.updateRelay(props.deviceId, relay.relay_id, editNameInput.value);
        emit('config-updated');
        cancelEdit();
      } catch (error) {
        alert('Failed to rename relay');
        console.error(error);
      } finally {
        loading.value = false;
      }
    };

    const toggleRelay = async (relay) => {
      loading.value = true;
      try {
        // Toggle the status
        await apiService.toggleRelay(props.deviceId, relay.relay_id, !relay.status);
        // Inform parent to reload config
        emit('config-updated');
      } catch (error) {
        alert('Failed to toggle relay');
        console.error(error);
      } finally {
        loading.value = false;
      }
    };

    return {
      loading,
      editingId,
      editNameInput,
      nameInputRef,
      startEdit,
      cancelEdit,
      saveName,
      toggleRelay
    };
  }
};
</script>

<style scoped>
.relay-card {
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  margin-bottom: 0;
}

.card-header {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.card-header h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.subtitle {
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: #6b7280;
}

.relays-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.relay-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  transition: border-color 0.2s;
}

.relay-item:hover {
  border-color: #d1d5db;
}

.relay-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.display-name-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.relay-name {
  font-weight: 600;
  color: #1f2937;
  font-size: 1rem;
}

.edit-btn {
  color: #9ca3af;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.edit-btn:hover {
  color: #3b82f6;
  background: #eff6ff;
}

.relay-pin {
  font-size: 0.75rem;
  color: #6b7280;
  font-family: monospace;
}

.edit-name-group {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.name-input {
  padding: 0.25rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  width: 120px;
}

.action-btn {
  background: none;
  border: none;
  padding: 0.25rem;
  border-radius: 0.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn.save { color: #10b981; }
.action-btn.save:hover { background: #d1fae5; }
.action-btn.cancel { color: #ef4444; }
.action-btn.cancel:hover { background: #fee2e2; }

/* Toggle Switch Styles */
.relay-toggle {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  min-width: 60px;
}

.switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 26px;
}

.switch input { 
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: #e5e7eb;
  transition: .4s;
}

.slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

input:checked + .slider {
  background-color: #10b981;
}

input:disabled + .slider {
  opacity: 0.5;
  cursor: not-allowed;
}

input:checked + .slider:before {
  transform: translateX(24px);
}

.slider.round {
  border-radius: 34px;
}

.slider.round:before {
  border-radius: 50%;
}

.status-label {
  font-size: 0.75rem;
  font-weight: 700;
}

.status-on { color: #10b981; }
.status-off { color: #6b7280; }
</style>

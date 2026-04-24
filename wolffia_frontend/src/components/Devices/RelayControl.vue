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
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  border: 1px solid #f0fdf4;
  border-left: 4px solid #10b981;
}

.card-header {
  margin-bottom: 1.25rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #f3f4f6;
}
.card-header h2 {
  font-size: 1rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.subtitle {
  color: #9ca3af;
  font-size: 0.8rem;
  margin: 0;
}

.empty-state {
  padding: 2.5rem;
  text-align: center;
  color: #9ca3af;
  font-size: 0.875rem;
  background: #f9fafb;
  border-radius: 0.75rem;
}

/* Grid of relay cards */
.relays-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}

.relay-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.125rem 1.25rem;
  background: #f9fafb;
  border: 1.5px solid #e5e7eb;
  border-radius: 0.875rem;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}
.relay-item::before {
  content: '';
  position: absolute;
  top: 0; left: 0;
  width: 3px;
  height: 100%;
  background: #e5e7eb;
  transition: background 0.2s;
}
.relay-item:has(input:checked)::before {
  background: #10b981;
}
.relay-item:has(input:checked) {
  border-color: #a7f3d0;
  background: #f0fdf4;
}
.relay-item:hover {
  border-color: #d1d5db;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

/* Info column */
.relay-info {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex: 1;
  padding-left: 0.5rem;
}

.display-name-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.relay-name {
  font-weight: 700;
  color: #111827;
  font-size: 0.95rem;
}

.edit-btn {
  color: #d1d5db;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.2rem;
  border-radius: 0.25rem;
  display: flex;
  align-items: center;
  transition: all 0.15s;
}
.edit-btn:hover { color: #10b981; background: #d1fae5; }

/* GPIO pin badge */
.relay-pin {
  display: inline-flex;
  align-items: center;
  font-size: 0.7rem;
  font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
  font-weight: 600;
  color: #6b7280;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 0.25rem;
  padding: 0.1rem 0.4rem;
  width: fit-content;
}

/* Edit mode */
.edit-name-group {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}
.name-input {
  padding: 0.3rem 0.5rem;
  border: 1.5px solid #10b981;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  width: 130px;
  outline: none;
  box-shadow: 0 0 0 3px rgba(16,185,129,0.1);
}
.action-btn {
  background: none;
  border: none;
  padding: 0.3rem;
  border-radius: 0.375rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.15s;
}
.action-btn.save   { color: #10b981; }
.action-btn.save:hover   { background: #d1fae5; }
.action-btn.cancel { color: #ef4444; }
.action-btn.cancel:hover { background: #fee2e2; }

/* Toggle column */
.relay-toggle {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  min-width: 64px;
}

/* Toggle switch — bigger and more tactile */
.switch {
  position: relative;
  display: inline-block;
  width: 54px;
  height: 28px;
}
.switch input { opacity: 0; width: 0; height: 0; }

.slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background: #d1d5db;
  transition: 0.25s cubic-bezier(0.4,0,0.2,1);
}
.slider:before {
  position: absolute;
  content: "";
  height: 22px;
  width: 22px;
  left: 3px;
  bottom: 3px;
  background: white;
  transition: 0.25s cubic-bezier(0.4,0,0.2,1);
  box-shadow: 0 1px 4px rgba(0,0,0,0.25);
}
.slider.round           { border-radius: 34px; }
.slider.round:before    { border-radius: 50%; }

input:checked + .slider        { background: #10b981; }
input:checked + .slider:before { transform: translateX(26px); }
input:disabled + .slider       { opacity: 0.45; cursor: not-allowed; }

/* Status text */
.status-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.status-on  { color: #10b981; }
.status-off { color: #9ca3af; }
</style>

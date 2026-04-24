<template>
  <div class="schedule-card">
    <div class="card-header">
      <div class="header-text">
        <h2>Timer Schedules</h2>
        <p class="subtitle">Automate relays based on time of day and week</p>
      </div>
      <button @click="openModal()" class="btn btn-primary add-btn">
        <Plus :size="16" />
        <span>Add Schedule</span>
      </button>
    </div>

    <!-- Schedules List -->
    <div v-if="!schedules || schedules.length === 0" class="empty-state">
      <Clock :size="48" />
      <p>No schedules defined. Add one to automate your farm.</p>
    </div>
    
    <div v-else class="schedules-list">
      <div v-for="sched in schedules" :key="sched.schedule_id" class="schedule-item" :class="{'disabled': !sched.enabled}">
        
        <div class="schedule-time">
          <span class="time">{{ formatTime(sched.startHour, sched.startMinute) }} - {{ formatTime(sched.stopHour, sched.stopMinute) }}</span>
          <span class="days">{{ formatDays(sched.days) }}</span>
        </div>

        <div class="schedule-details">
          <span class="detail-label">Targets:</span>
          <span class="detail-val">{{ formatRelays(sched.relays) }}</span>
        </div>

        <div class="schedule-actions">
          <label class="switch">
            <input type="checkbox" :checked="sched.enabled" @change="toggleSchedule(sched)" :disabled="loading">
            <span class="slider round"></span>
          </label>
          <button @click="openModal(sched)" class="action-btn edit" title="Edit Schedule" :disabled="loading">
            <Edit2 :size="16" />
          </button>
          <button @click="deleteSchedule(sched)" class="action-btn delete" title="Delete" :disabled="loading">
            <Trash2 :size="16" />
          </button>
        </div>
      </div>
    </div>

    <!-- Editor Modal -->
    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>{{ editingSchedule ? 'Edit Schedule' : 'New Schedule' }}</h2>
          <button @click="closeModal" class="close-btn"><X :size="20" /></button>
        </div>
        
        <form @submit.prevent="saveSchedule" class="modal-body">
          <div class="time-inputs row">
            <div class="input-group flex-1">
              <label>Start Time</label>
              <input type="time" v-model="formData.startTime" required>
            </div>
            <div class="input-group flex-1">
              <label>Stop Time</label>
              <input type="time" v-model="formData.stopTime" required>
            </div>
          </div>

          <div class="input-group">
            <label>Active Days</label>
            <div class="days-selector">
              <button 
                type="button"
                v-for="(day, index) in weekDays" 
                :key="index"
                @click="toggleDay(index)"
                :class="['day-btn', { 'selected': formData.days.includes(index) }]"
              >
                {{ day.short }}
              </button>
            </div>
          </div>

          <div class="input-group">
            <label>Target Relays</label>
            <div class="relays-selector">
              <label v-for="r in relays" :key="r.relay_id" class="relay-checkbox">
                <input type="checkbox" :value="r.relay_id" v-model="formData.relays">
                <span>{{ r.name || `Relay ${r.relay_id + 1}` }}</span>
              </label>
            </div>
          </div>

          <div class="modal-actions mt-4">
            <button type="button" @click="closeModal" class="btn btn-secondary" :disabled="loading">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="loading || formData.relays.length === 0 || formData.days.length === 0">
              {{ loading ? 'Saving...' : 'Save Schedule' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue';
import { Clock, Plus, Edit2, Trash2, X } from 'lucide-vue-next';
import apiService from '@/services/api';

export default {
  name: 'ScheduleManager',
  components: { Clock, Plus, Edit2, Trash2, X },
  props: {
    deviceId: { type: String, required: true },
    schedules: { type: Array, default: () => [] },
    relays: { type: Array, default: () => [] }
  },
  emits: ['config-updated'],
  setup(props, { emit }) {
    const loading = ref(false);
    const showModal = ref(false);
    const editingSchedule = ref(null);

    const weekDays = [
      { id: 0, short: 'Su', long: 'Sunday' },
      { id: 1, short: 'Mo', long: 'Monday' },
      { id: 2, short: 'Tu', long: 'Tuesday' },
      { id: 3, short: 'We', long: 'Wednesday' },
      { id: 4, short: 'Th', long: 'Thursday' },
      { id: 5, short: 'Fr', long: 'Friday' },
      { id: 6, short: 'Sa', long: 'Saturday' }
    ];

    const formData = ref({
      startTime: '08:00',
      stopTime: '09:00',
      days: [],
      relays: []
    });

    const formatTime = (h, m) => {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const formatDays = (daysArray) => {
      if (!daysArray || daysArray.length === 0) return 'No days selected';
      if (daysArray.length === 7) return 'Everyday';
      if (daysArray.length === 5 && !daysArray.includes(0) && !daysArray.includes(6)) return 'Weekdays';
      if (daysArray.length === 2 && daysArray.includes(0) && daysArray.includes(6)) return 'Weekends';
      
      const sorted = [...daysArray].sort((a,b) => a-b);
      return sorted.map(d => weekDays[d].short).join(', ');
    };

    const formatRelays = (relayIdsArray) => {
      if (!relayIdsArray || relayIdsArray.length === 0) return 'None';
      const names = relayIdsArray.map(id => {
        const found = props.relays.find(r => r.relay_id === id);
        return found ? found.name : `Relay ${id + 1}`;
      });
      return names.join(', ');
    };

    const openModal = (sched = null) => {
      if (sched) {
        editingSchedule.value = sched;
        formData.value = {
          startTime: formatTime(sched.startHour, sched.startMinute),
          stopTime: formatTime(sched.stopHour, sched.stopMinute),
          days: [...sched.days],
          relays: [...sched.relays]
        };
      } else {
        editingSchedule.value = null;
        formData.value = {
          startTime: '08:00',
          stopTime: '09:00',
          days: [1,2,3,4,5], // Default M-F
          relays: []
        };
      }
      showModal.value = true;
    };

    const closeModal = () => {
      showModal.value = false;
      editingSchedule.value = null;
    };

    const toggleDay = (dayIndex) => {
      const i = formData.value.days.indexOf(dayIndex);
      if (i > -1) {
        formData.value.days.splice(i, 1);
      } else {
        formData.value.days.push(dayIndex);
      }
    };

    const saveSchedule = async () => {
      loading.value = true;
      try {
        const payload = {
          startHour: parseInt(formData.value.startTime.split(':')[0]),
          startMinute: parseInt(formData.value.startTime.split(':')[1]),
          stopHour: parseInt(formData.value.stopTime.split(':')[0]),
          stopMinute: parseInt(formData.value.stopTime.split(':')[1]),
          days: formData.value.days,
          relays: formData.value.relays
        };

        if (editingSchedule.value) {
          await apiService.updateSchedule(props.deviceId, editingSchedule.value.schedule_id, payload);
        } else {
          await apiService.addSchedule(props.deviceId, payload);
        }

        emit('config-updated');
        closeModal();
      } catch (error) {
        alert('Failed to save schedule');
        console.error(error);
      } finally {
        loading.value = false;
      }
    };

    const toggleSchedule = async (sched) => {
      loading.value = true;
      try {
        await apiService.updateSchedule(props.deviceId, sched.schedule_id, { enabled: !sched.enabled });
        emit('config-updated');
      } catch (error) {
        alert('Failed to toggle schedule');
        console.error(error);
      } finally {
        loading.value = false;
      }
    };

    const deleteSchedule = async (sched) => {
      if (!confirm('Are you sure you want to delete this schedule?')) return;
      loading.value = true;
      try {
        await apiService.deleteSchedule(props.deviceId, sched.schedule_id);
        emit('config-updated');
      } catch (error) {
        alert('Failed to delete schedule');
        console.error(error);
      } finally {
        loading.value = false;
      }
    };

    return {
      loading,
      showModal,
      editingSchedule,
      formData,
      weekDays,
      formatTime,
      formatDays,
      formatRelays,
      openModal,
      closeModal,
      toggleDay,
      saveSchedule,
      toggleSchedule,
      deleteSchedule
    };
  }
};
</script>

<style scoped>
/* ── Card shell ── */
.schedule-card {
  background: #ffffff;
  border-radius: 1rem;
  padding: 1.75rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid #f3f4f6;
}

.header-text h2 {
  font-size: 1.1rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 0.2rem 0;
  letter-spacing: -0.01em;
}

.subtitle {
  color: #9ca3af;
  font-size: 0.8rem;
  margin: 0;
}

/* ── Empty state ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3.5rem 2rem;
  color: #d1d5db;
  gap: 0.75rem;
}

.empty-state p {
  color: #9ca3af;
  font-size: 0.9rem;
  margin: 0;
}

/* ── Schedule list ── */
.schedules-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.schedule-item {
  display: grid;
  grid-template-columns: 170px 1fr auto;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-left: 4px solid #10b981;
  border-radius: 0.75rem;
  transition: box-shadow 0.15s, border-color 0.15s, opacity 0.15s;
}

.schedule-item:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.07);
  border-color: #d1d5db;
  border-left-color: #10b981;
}

.schedule-item.disabled {
  opacity: 0.5;
  border-left-color: #e5e7eb;
}

/* Time block */
.schedule-time {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.schedule-time .time {
  font-size: 1.05rem;
  font-weight: 700;
  color: #111827;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}

.schedule-time .days {
  font-size: 0.75rem;
  color: #6b7280;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* Details block */
.schedule-details {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.detail-label {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #9ca3af;
  font-weight: 700;
}

.detail-val {
  font-size: 0.85rem;
  color: #374151;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Action buttons */
.schedule-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.action-btn {
  background: none;
  border: none;
  padding: 0.45rem;
  border-radius: 0.5rem;
  cursor: pointer;
  color: #9ca3af;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.action-btn:hover { background: #f3f4f6; color: #374151; }
.action-btn.delete:hover { background: #fee2e2; color: #ef4444; }
.action-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* Add button */
.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 1rem;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 0.625rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
  box-shadow: 0 2px 8px rgba(16,185,129,0.3);
}

.add-btn:hover { background: #059669; transform: translateY(-1px); }

/* ── Modal ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.modal {
  background: #ffffff;
  border-radius: 1.25rem;
  width: 92%;
  max-width: 480px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.18);
  overflow: hidden;
}

.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #f3f4f6;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fafafa;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: #111827;
}

.close-btn {
  background: #f3f4f6;
  border: none;
  cursor: pointer;
  color: #6b7280;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s;
}

.close-btn:hover { background: #e5e7eb; color: #111827; }

.modal-body { padding: 1.5rem; }

.row { display: flex; gap: 1rem; }
.flex-1 { flex: 1; }

.mt-4 {
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid #f3f4f6;
}

/* Form inputs */
.input-group { margin-bottom: 1.25rem; }

.input-group label {
  display: block;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.input-group input[type="time"] {
  width: 100%;
  padding: 0.65rem 0.9rem;
  border: 1.5px solid #e5e7eb;
  border-radius: 0.625rem;
  font-size: 1rem;
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  color: #111827;
  transition: border-color 0.15s, box-shadow 0.15s;
  outline: none;
}

.input-group input[type="time"]:focus {
  border-color: #10b981;
  box-shadow: 0 0 0 3px rgba(16,185,129,0.12);
}

/* Day selector pills */
.days-selector {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.day-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: 1.5px solid #e5e7eb;
  background: #f9fafb;
  color: #6b7280;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}

.day-btn:hover { border-color: #a7f3d0; background: #ecfdf5; color: #065f46; }

.day-btn.selected {
  background: #10b981;
  color: #ffffff;
  border-color: #10b981;
  box-shadow: 0 2px 6px rgba(16,185,129,0.35);
}

/* Relay checkboxes */
.relays-selector {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
}

.relay-checkbox {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 1rem;
  border: 1.5px solid #e5e7eb;
  border-radius: 0.625rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
}

.relay-checkbox:hover { border-color: #a7f3d0; background: #f0fdf4; }

.relay-checkbox:has(input:checked) {
  border-color: #10b981;
  background: #f0fdf4;
  color: #065f46;
}

.relay-checkbox input {
  width: 1.1rem;
  height: 1.1rem;
  accent-color: #10b981;
  flex-shrink: 0;
}

/* Modal action row */
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn {
  padding: 0.65rem 1.25rem;
  border-radius: 0.625rem;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  transition: all 0.15s;
  border: none;
}

.btn-primary { background: #10b981; color: white; box-shadow: 0 2px 6px rgba(16,185,129,0.3); }
.btn-primary:hover:not(:disabled) { background: #059669; }
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }

.btn-secondary { background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; }
.btn-secondary:hover:not(:disabled) { background: #e5e7eb; }

/* Toggle switch */
.switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
.switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; inset: 0; background: #e5e7eb; transition: .3s; }
.slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background: white; transition: .3s; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
input:checked + .slider { background: #10b981; }
input:disabled + .slider { opacity: 0.4; cursor: not-allowed; }
input:checked + .slider:before { transform: translateX(20px); }
.slider.round { border-radius: 34px; }
.slider.round:before { border-radius: 50%; }

/* Mobile */
@media (max-width: 640px) {
  .schedule-item {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  .schedule-actions {
    padding-top: 0.75rem;
    border-top: 1px solid #f3f4f6;
    justify-content: flex-end;
  }
  .relays-selector { grid-template-columns: 1fr; }
}
</style>

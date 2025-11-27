<template>
    <div class="settings-view">
        <div class="settings-header">
            <h1>Settings</h1>
            <p class="subtitle">Manage your system preferences</p>
        </div>

        <div class="settings-content">
            <div class="settings-main">
                <!-- Notifications -->
                <div class="settings-section">
                    <h2>Notification Settings</h2>
                    <div class="settings-group">
                        <div class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">Email Notifications</div>
                                <div class="setting-description">Receive alerts via email</div>
                            </div>
                            <label class="toggle">
                                <input v-model="settings.notifications.email" type="checkbox" />
                                <span class="toggle-slider"></span>
                            </label>
                        </div>

                        <label class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">Email Address</div>
                                <div class="setting-description">Primary email for notifications</div>
                            </div>
                            <input v-model="settings.notifications.emailAddress" type="email" class="setting-input"
                                placeholder="your@email.com" />
                        </label>

                        <label class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">Phone Number</div>
                                <div class="setting-description">Phone number for SMS alerts (optional)</div>
                            </div>
                            <input v-model="settings.notifications.phoneNumber" type="tel" class="setting-input"
                                placeholder="+66 123 456 789" />
                        </label>
                    </div>
                </div>

                <!-- Save Button -->
                <div class="settings-footer">
                    <button @click="saveSettings" :disabled="saving" class="btn btn-primary btn-lg">
                        <Save :size="20" />
                        {{ saving ? 'Saving...' : 'Save Changes' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { Save } from 'lucide-vue-next';
import apiService from '@/services/api';

export default {
    name: 'SettingsView',
    components: {
        Save
    },
    setup() {
        const saving = ref(false);

        const settings = ref({
            notifications: {
                email: true,
                emailAddress: '',
                phoneNumber: ''
            }
        });

        const saveSettings = async () => {
            saving.value = true;
            try {
                localStorage.setItem('app_settings', JSON.stringify(settings.value));
                alert('Settings saved successfully!');
            } catch (error) {
                alert('Failed to save settings: ' + error.message);
            } finally {
                saving.value = false;
            }
        };

        const loadSettings = () => {
            const savedSettings = localStorage.getItem('app_settings');
            if (savedSettings) {
                settings.value = JSON.parse(savedSettings);
            }
        };

        onMounted(() => {
            loadSettings();
        });

        return {
            saving,
            settings,
            saveSettings
        };
    }
};
</script>

<style scoped>
.settings-view {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
}

.settings-header {
    margin-bottom: 2rem;
}

.settings-header h1 {
    font-size: 2rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 0.5rem 0;
}

.subtitle {
    color: #6b7280;
    margin: 0;
}

.settings-content {
    max-width: 800px;
    margin: 0 auto;
}

.settings-main {
    background: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.settings-section + .settings-section {
    margin-top: 2rem;
}

.settings-section h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 1rem 0;
}

.settings-group {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
}

.setting-info {
    flex: 1;
}

.setting-label {
    font-weight: 600;
    color: #111827;
}

.setting-description {
    color: #6b7280;
    font-size: 0.875rem;
}

.setting-input,
.setting-select,
.setting-item input[type="email"],
.setting-item input[type="tel"] {
    min-width: 260px;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 1rem;
}

.toggle {
    position: relative;
    width: 48px;
    height: 26px;
}

.toggle input {
    opacity: 0;
    width: 0;
    height: 0;
}

.toggle-slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #d1d5db;
    border-radius: 9999px;
    transition: 0.2s;
}

.toggle-slider:before {
    position: absolute;
    content: "";
    height: 20px;
    width: 20px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    border-radius: 50%;
    transition: 0.2s;
}

.toggle input:checked + .toggle-slider {
    background-color: #34d399;
}

.toggle input:checked + .toggle-slider:before {
    transform: translateX(22px);
}

.settings-footer {
    margin-top: 2rem;
    text-align: right;
}

.btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-primary {
    background: #10b981;
    color: white;
}

.btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-secondary {
    background: #f3f4f6;
    color: #374151;
}

.btn-danger {
    background: #fee2e2;
    color: #dc2626;
}

.btn-lg {
    font-size: 1rem;
}

.text-danger {
    color: #dc2626;
}

@media (max-width: 768px) {
    .setting-item {
        flex-direction: column;
        align-items: flex-start;
    }

    .setting-input,
    .setting-select {
        width: 100%;
    }
}
</style>


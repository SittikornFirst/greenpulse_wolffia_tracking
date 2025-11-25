<template>
    <div class="settings-view">
        <div class="settings-header">
            <h1>Settings</h1>
            <p class="subtitle">Manage your system preferences and configurations</p>
        </div>

        <div class="settings-content">
            <!-- Sidebar -->
            <div class="settings-sidebar">
                <button v-for="section in sections" :key="section.id" @click="activeSection = section.id"
                    :class="['sidebar-item', { 'sidebar-item--active': activeSection === section.id }]">
                    <component :is="section.icon" :size="20" />
                    <span>{{ section.label }}</span>
                </button>
            </div>

            <!-- Content -->
            <div class="settings-main">
                <!-- General Settings -->
                <div v-if="activeSection === 'general'" class="settings-section">
                    <h2>General Settings</h2>
                    <div class="settings-group">
                        <label class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">System Name</div>
                                <div class="setting-description">Customize your system display name</div>
                            </div>
                            <input v-model="settings.general.systemName" type="text" class="setting-input" />
                        </label>

                        <label class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">Time Zone</div>
                                <div class="setting-description">Select your local time zone</div>
                            </div>
                            <select v-model="settings.general.timezone" class="setting-select">
                                <option value="UTC">UTC</option>
                                <option value="Asia/Bangkok">Asia/Bangkok (GMT+7)</option>
                                <option value="America/New_York">America/New_York (GMT-5)</option>
                                <option value="Europe/London">Europe/London (GMT+0)</option>
                            </select>
                        </label>

                        <label class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">Language</div>
                                <div class="setting-description">Choose your preferred language</div>
                            </div>
                            <select v-model="settings.general.language" class="setting-select">
                                <option value="en">English</option>
                                <option value="th">ไทย (Thai)</option>
                                <option value="zh">中文 (Chinese)</option>
                            </select>
                        </label>

                        <label class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">Data Retention</div>
                                <div class="setting-description">How long to keep sensor data</div>
                            </div>
                            <select v-model="settings.general.dataRetention" class="setting-select">
                                <option value="30">30 days</option>
                                <option value="90">90 days</option>
                                <option value="180">180 days</option>
                                <option value="365">1 year</option>
                            </select>
                        </label>
                    </div>
                </div>

                <!-- Notifications -->
                <div v-if="activeSection === 'notifications'" class="settings-section">
                    <h2>Notification Preferences</h2>
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

                        <div class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">SMS Notifications</div>
                                <div class="setting-description">Receive urgent alerts via SMS</div>
                            </div>
                            <label class="toggle">
                                <input v-model="settings.notifications.sms" type="checkbox" />
                                <span class="toggle-slider"></span>
                            </label>
                        </div>

                        <div class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">Push Notifications</div>
                                <div class="setting-description">Browser push notifications</div>
                            </div>
                            <label class="toggle">
                                <input v-model="settings.notifications.push" type="checkbox" />
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
                                <div class="setting-description">Phone number for SMS alerts</div>
                            </div>
                            <input v-model="settings.notifications.phoneNumber" type="tel" class="setting-input"
                                placeholder="+66 123 456 789" />
                        </label>

                        <div class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">Alert Frequency</div>
                                <div class="setting-description">Minimum time between alerts</div>
                            </div>
                            <select v-model="settings.notifications.frequency" class="setting-select">
                                <option value="immediate">Immediate</option>
                                <option value="5">Every 5 minutes</option>
                                <option value="15">Every 15 minutes</option>
                                <option value="60">Every hour</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Device Configuration -->
                <div v-if="activeSection === 'devices'" class="settings-section">
                    <h2>Device Configuration</h2>
                    <div class="settings-group">
                        <div class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">Auto-Discovery</div>
                                <div class="setting-description">Automatically detect new devices</div>
                            </div>
                            <label class="toggle">
                                <input v-model="settings.devices.autoDiscovery" type="checkbox" />
                                <span class="toggle-slider"></span>
                            </label>
                        </div>

                        <label class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">Polling Interval</div>
                                <div class="setting-description">How often to collect sensor data</div>
                            </div>
                            <select v-model="settings.devices.pollingInterval" class="setting-select">
                                <option value="30">30 seconds</option>
                                <option value="60">1 minute</option>
                                <option value="300">5 minutes</option>
                                <option value="600">10 minutes</option>
                            </select>
                        </label>

                        <div class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">Auto-Calibration</div>
                                <div class="setting-description">Automatically calibrate sensors</div>
                            </div>
                            <label class="toggle">
                                <input v-model="settings.devices.autoCalibration" type="checkbox" />
                                <span class="toggle-slider"></span>
                            </label>
                        </div>

                        <div class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">Offline Alerts</div>
                                <div class="setting-description">Alert when devices go offline</div>
                            </div>
                            <label class="toggle">
                                <input v-model="settings.devices.offlineAlerts" type="checkbox" />
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- Security -->
                <div v-if="activeSection === 'security'" class="settings-section">
                    <h2>Security & Privacy</h2>
                    <div class="settings-group">
                        <div class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">Two-Factor Authentication</div>
                                <div class="setting-description">Add an extra layer of security</div>
                            </div>
                            <button class="btn btn-secondary">
                                {{ settings.security.twoFactor ? 'Disable 2FA' : 'Enable 2FA' }}
                            </button>
                        </div>

                        <label class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">Session Timeout</div>
                                <div class="setting-description">Auto-logout after inactivity</div>
                            </div>
                            <select v-model="settings.security.sessionTimeout" class="setting-select">
                                <option value="30">30 minutes</option>
                                <option value="60">1 hour</option>
                                <option value="240">4 hours</option>
                                <option value="480">8 hours</option>
                            </select>
                        </label>

                        <div class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">API Access</div>
                                <div class="setting-description">Manage API keys and access</div>
                            </div>
                            <button class="btn btn-secondary" @click="showAPIKeys = true">
                                Manage API Keys
                            </button>
                        </div>

                        <div class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">Change Password</div>
                                <div class="setting-description">Update your account password</div>
                            </div>
                            <button class="btn btn-secondary" @click="showPasswordChange = true">
                                Change Password
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Data & Backup -->
                <div v-if="activeSection === 'data'" class="settings-section">
                    <h2>Data & Backup</h2>
                    <div class="settings-group">
                        <div class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">Auto-Backup</div>
                                <div class="setting-description">Automatically backup your data</div>
                            </div>
                            <label class="toggle">
                                <input v-model="settings.data.autoBackup" type="checkbox" />
                                <span class="toggle-slider"></span>
                            </label>
                        </div>

                        <label class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">Backup Frequency</div>
                                <div class="setting-description">How often to create backups</div>
                            </div>
                            <select v-model="settings.data.backupFrequency" class="setting-select">
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                            </select>
                        </label>

                        <div class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">Export Data</div>
                                <div class="setting-description">Download all your data</div>
                            </div>
                            <button class="btn btn-secondary" @click="exportData">
                                <Download :size="16" />
                                Export All Data
                            </button>
                        </div>

                        <div class="setting-item">
                            <div class="setting-info">
                                <div class="setting-label">Delete Account</div>
                                <div class="setting-description text-danger">Permanently delete your account and data
                                </div>
                            </div>
                            <button class="btn btn-danger" @click="confirmDelete">
                                <Trash2 :size="16" />
                                Delete Account
                            </button>
                        </div>
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
import {
    Settings as SettingsIcon, Bell, Cpu, Shield, Database, Download,
    Trash2, Save
} from 'lucide-vue-next';
import apiService from '@/services/api';

export default {
    name: 'SettingsView',
    components: {
        SettingsIcon, Bell, Cpu, Shield, Database, Download, Trash2, Save
    },
    setup() {
        const activeSection = ref('general');
        const saving = ref(false);
        const showAPIKeys = ref(false);
        const showPasswordChange = ref(false);

        const sections = [
            { id: 'general', label: 'General', icon: SettingsIcon },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'devices', label: 'Devices', icon: Cpu },
            { id: 'security', label: 'Security', icon: Shield },
            { id: 'data', label: 'Data & Backup', icon: Database }
        ];

        const settings = ref({
            general: {
                systemName: 'Wolffia Monitoring',
                timezone: 'Asia/Bangkok',
                language: 'en',
                dataRetention: '90'
            },
            notifications: {
                email: true,
                sms: false,
                push: true,
                emailAddress: 'farmer@example.com',
                phoneNumber: '',
                frequency: '15'
            },
            devices: {
                autoDiscovery: true,
                pollingInterval: '60',
                autoCalibration: false,
                offlineAlerts: true
            },
            security: {
                twoFactor: false,
                sessionTimeout: '60'
            },
            data: {
                autoBackup: true,
                backupFrequency: 'daily'
            }
        });

        const saveSettings = async () => {
            saving.value = true;
            try {
                await apiService.updateNotificationSettings(settings.value.notifications);
                // Save other settings to localStorage for now
                localStorage.setItem('app_settings', JSON.stringify(settings.value));
                alert('Settings saved successfully!');
            } catch (error) {
                alert('Failed to save settings: ' + (error.response?.data?.message || error.message));
            } finally {
                saving.value = false;
            }
        };

        const exportData = async () => {
            try {
                const response = await apiService.exportData({});
                const blob = new Blob([response.data], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `settings-export-${Date.now()}.csv`;
                a.click();
                window.URL.revokeObjectURL(url);
            } catch (error) {
                alert('Failed to export data: ' + (error.response?.data?.message || error.message));
            }
        };

        const confirmDelete = () => {
            if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                if (confirm('This will permanently delete all your data. Type DELETE to confirm.')) {
                    alert('Account deletion initiated.');
                }
            }
        };

        // Load settings on mount
        onMounted(() => {
            const saved = localStorage.getItem('app_settings');
            if (saved) {
                try {
                    const parsedSettings = JSON.parse(saved);
                    settings.value = { ...settings.value, ...parsedSettings };
                } catch (e) {
                    console.error('Failed to load settings:', e);
                }
            }

            // Load notification settings from API
            apiService.getNotificationSettings()
                .then(response => {
                    if (response.data) {
                        settings.value.notifications = {
                            ...settings.value.notifications,
                            ...response.data
                        };
                    }
                })
                .catch(error => {
                    console.error('Failed to load notification settings:', error);
                });
        });

        return {
            activeSection,
            saving,
            showAPIKeys,
            showPasswordChange,
            sections,
            settings,
            saveSettings,
            exportData,
            confirmDelete
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
    display: grid;
    grid-template-columns: 250px 1fr;
    gap: 2rem;
}

.settings-sidebar {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.sidebar-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: white;
    border: none;
    border-radius: 0.5rem;
    color: #6b7280;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
}

.sidebar-item:hover {
    background: #f3f4f6;
    color: #1f2937;
}

.sidebar-item--active {
    background: #d1fae5;
    color: #059669;
}

.settings-main {
    background: white;
    border-radius: 0.75rem;
    padding: 2rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.settings-section h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 1.5rem 0;
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
    padding: 1rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
}

.setting-info {
    flex: 1;
    margin-right: 1rem;
}

.setting-label {
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 0.25rem;
}

.setting-description {
    font-size: 0.875rem;
    color: #6b7280;
}

.text-danger {
    color: #dc2626;
}

.setting-input,
.setting-select {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    min-width: 200px;
}

.setting-input:focus,
.setting-select:focus {
    outline: none;
    border-color: #10b981;
    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
}

/* Toggle Switch */
.toggle {
    position: relative;
    display: inline-block;
    width: 48px;
    height: 24px;
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
    transition: 0.3s;
    border-radius: 24px;
}

.toggle-slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.3s;
    border-radius: 50%;
}

.toggle input:checked+.toggle-slider {
    background-color: #10b981;
}

.toggle input:checked+.toggle-slider:before {
    transform: translateX(24px);
}

.btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 0.375rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.875rem;
}

.btn-primary {
    background: #10b981;
    color: white;
}

.btn-primary:hover:not(:disabled) {
    background: #059669;
}

.btn-secondary {
    background: #f3f4f6;
    color: #374151;
}

.btn-secondary:hover {
    background: #e5e7eb;
}

.btn-danger {
    background: #fee2e2;
    color: #dc2626;
}

.btn-danger:hover {
    background: #fecaca;
}

.btn-lg {
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.settings-footer {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: flex-end;
}

@media (max-width: 768px) {
    .settings-view {
        padding: 1rem;
    }

    .settings-content {
        grid-template-columns: 1fr;
    }

    .settings-sidebar {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
    }

    .setting-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
    }

    .setting-info {
        margin-right: 0;
    }

    .setting-input,
    .setting-select {
        width: 100%;
        min-width: 0;
    }

    .settings-footer {
        justify-content: stretch;
    }

    .settings-footer .btn {
        width: 100%;
        justify-content: center;
    }
}
</style>
<template>
    <div class="layout">
        <!-- Sidebar -->
        <aside :class="['sidebar', { 'sidebar--collapsed': sidebarCollapsed }]">
            <div class="sidebar__header">
                <div class="sidebar__logo">
                    <Leaf :size="32" class="logo-icon" />
                    <span v-if="!sidebarCollapsed" class="logo-text">Wolffia</span>
                </div>
                <button @click="toggleSidebar" class="sidebar__toggle"
                    :title="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'">
                    <Menu :size="20" />
                </button>
            </div>

            <nav class="sidebar__nav">
                <router-link v-for="item in navigationItems" :key="item.path" :to="item.path" class="nav-item"
                    :title="item.label">
                    <component :is="item.icon" :size="20" />
                    <span v-if="!sidebarCollapsed" class="nav-item__label">{{ item.label }}</span>
                    <span v-if="item.badge && !sidebarCollapsed"
                        :class="['nav-item__badge', `nav-item__badge--${item.badgeType}`]">
                        {{ item.badge }}
                    </span>
                </router-link>
            </nav>

            <div class="sidebar__footer">
                <div class="connection-status">
                    <div :class="['status-dot', { 'status-dot--active': isConnected }]"></div>
                    <span v-if="!sidebarCollapsed">{{ isConnected ? 'Connected' : 'Offline' }}</span>
                </div>
            </div>
        </aside>

        <!-- Main Content -->
        <div class="main">
            <!-- Top Bar -->
            <header class="topbar">
                <div class="topbar__left">
                    <button @click="toggleSidebar" class="topbar__menu-btn">
                        <Menu :size="20" />
                    </button>
                    <h1 class="topbar__title">{{ pageTitle }}</h1>
                </div>

                <div class="topbar__right">
                    <!-- Notifications -->
                    <div class="topbar__item topbar__notifications">
                        <button @click="toggleNotifications" class="icon-btn" :class="{ 'has-badge': unreadCount > 0 }">
                            <Bell :size="20" />
                            <span v-if="unreadCount > 0" class="badge">{{ unreadCount }}</span>
                        </button>

                        <!-- Notifications Dropdown -->
                        <div v-if="showNotifications" class="dropdown notifications-dropdown">
                            <div class="dropdown__header">
                                <h3>Notifications</h3>
                                <button @click="markAllAsRead" class="text-btn">Mark all read</button>
                            </div>
                            <div class="dropdown__content">
                                <div v-if="recentAlerts.length === 0" class="empty-state">
                                    <CheckCircle :size="32" />
                                    <p>No new notifications</p>
                                </div>
                                <div v-else class="notifications-list">
                                    <div v-for="alert in recentAlerts" :key="alert.id" class="notification-item"
                                        @click="goToAlert(alert.id)">
                                        <component :is="getAlertIcon(alert.type)" :size="16" />
                                        <div class="notification-content">
                                            <p>{{ alert.message }}</p>
                                            <span class="notification-time">{{ formatTime(alert.timestamp) }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="dropdown__footer">
                                <router-link to="/alerts" class="link">View all alerts</router-link>
                            </div>
                        </div>
                    </div>

                    <!-- User Menu -->
                    <div class="topbar__item topbar__user">
                        <button @click="toggleUserMenu" class="user-btn">
                            <User :size="20" />
                            <span class="user-name">{{ userName }}</span>
                            <ChevronDown :size="16" />
                        </button>

                        <!-- User Dropdown -->
                        <div v-if="showUserMenu" class="dropdown user-dropdown">
                            <router-link to="/profile" class="dropdown-item">
                                <User :size="16" />
                                <span>Profile</span>
                            </router-link>
                            <router-link to=" /settings" class="dropdown-item">
                                <Settings :size="16" />
                                <span>Settings</span>
                            </router-link>
                            <div class="dropdown-divider"></div>
                            <button @click="handleLogout" class="dropdown-item">
                                <LogOut :size="16" />
                                <span>Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <!-- Page Content -->
            <main class="content">
                <slot />
            </main>
        </div>

        <!-- Click outside to close dropdowns -->
        <div v-if="showNotifications || showUserMenu" class="overlay" @click="closeAllDropdowns"></div>
    </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
    Leaf, Menu, LayoutDashboard, Cpu, Bell, TrendingUp,
    Settings, User, LogOut, ChevronDown, CheckCircle,
    AlertTriangle, AlertCircle, Info, MapPin
} from 'lucide-vue-next';
import { useAlertsStore } from '@/stores/module/alerts';
import { useWebSocket } from '@/composables/useWebSocket';

export default {
    name: 'DefaultLayout',
    components: {
        Leaf, Menu, LayoutDashboard, Cpu, Bell, TrendingUp,
        Settings, User, LogOut, ChevronDown, CheckCircle,
        AlertTriangle, AlertCircle, Info, MapPin
    },
    setup() {
        const route = useRoute();
        const router = useRouter();
        const alertsStore = useAlertsStore();
        const ws = useWebSocket();

        const sidebarCollapsed = ref(false);
        const showNotifications = ref(false);
        const showUserMenu = ref(false);
        const userName = ref('Farmer John');

        const navigationItems = [
            { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { path: '/devices', label: 'Devices', icon: Cpu },
            {
                path: '/alerts',
                label: 'Alerts',
                icon: Bell,
                badge: computed(() => alertsStore.totalUnresolvedCount),
                badgeType: 'danger'
            },
            { path: '/farms', label: 'Farms', icon: MapPin },
            { path: '/analytics', label: 'Analytics', icon: TrendingUp },
            { path: '/settings', label: 'Settings', icon: Settings }
        ];

        const pageTitle = computed(() => route.meta.title || 'Dashboard');
        const isConnected = computed(() => ws.connected.value);
        const unreadCount = computed(() => alertsStore.totalUnresolvedCount);
        const recentAlerts = computed(() => alertsStore.unresolvedAlerts.slice(0, 5));

        const toggleSidebar = () => {
            sidebarCollapsed.value = !sidebarCollapsed.value;
            localStorage.setItem('sidebarCollapsed', sidebarCollapsed.value.toString());
        };

        const toggleNotifications = () => {
            showNotifications.value = !showNotifications.value;
            showUserMenu.value = false;
        };

        const toggleUserMenu = () => {
            showUserMenu.value = !showUserMenu.value;
            showNotifications.value = false;
        };

        const closeAllDropdowns = () => {
            showNotifications.value = false;
            showUserMenu.value = false;
        };

        const markAllAsRead = async () => {
            const alertIds = recentAlerts.value.map(a => a.id);
            await alertsStore.resolveMultipleAlerts(alertIds);
        };

        const goToAlert = (alertId) => {
            router.push({ name: 'Alerts', query: { highlight: alertId } });
            closeAllDropdowns();
        };

        const getAlertIcon = (type) => {
            switch (type) {
                case 'high': return AlertTriangle;
                case 'medium': return AlertCircle;
                case 'low': return Info;
                default: return AlertCircle;
            }
        };

        const formatTime = (timestamp) => {
            if (!timestamp) return '';
            const now = new Date();
            const then = new Date(timestamp);
            const diffMins = Math.floor((now - then) / 60000);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
            return then.toLocaleDateString();
        };

        const handleLogout = () => {
            localStorage.removeItem('auth_token');
            ws.disconnect();
            router.push('/login');
        };

        onMounted(async () => {
            const saved = localStorage.getItem('sidebarCollapsed');
            if (saved) {
                sidebarCollapsed.value = saved === 'true';
            }

            // Try to setup WebSocket if token exists, but don't fail if it doesn't
            const token = localStorage.getItem('auth_token');
            if (token) {
                try {
                    await ws.setup({
                        autoConnect: true,
                        subscribeToDevices: true,
                        requestNotifications: true
                    });
                } catch (error) {
                    console.warn('WebSocket setup failed:', error);
                }
            }

            // Try to fetch alerts, but don't fail if not authenticated
            try {
                await alertsStore.fetchUnresolvedAlerts();
            } catch (error) {
                console.warn('Failed to fetch alerts:', error);
            }

            // Load user data
            const storedUser = localStorage.getItem('user_name');
            if (storedUser) {
                userName.value = storedUser;
            }
        });

        onUnmounted(() => {
            ws.cleanup();
        });

        return {
            sidebarCollapsed,
            showNotifications,
            showUserMenu,
            userName,
            navigationItems,
            pageTitle,
            isConnected,
            unreadCount,
            recentAlerts,
            toggleSidebar,
            toggleNotifications,
            toggleUserMenu,
            closeAllDropdowns,
            markAllAsRead,
            goToAlert,
            getAlertIcon,
            formatTime,
            handleLogout
        };
    }
};
</script>

<style scoped>
.layout {
    display: flex;
    min-height: 100vh;
}

/* Sidebar */
.sidebar {
    width: 260px;
    background: #ffffff;
    border-right: 1px solid #e5e7eb;
    display: flex;
    flex-direction: column;
    transition: width 0.3s ease;
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 40;
}

.sidebar--collapsed {
    width: 70px;
}

.sidebar__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 1rem;
    border-bottom: 1px solid #e5e7eb;
}

.sidebar__logo {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.logo-icon {
    color: #10b981;
}

.logo-text {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1f2937;
}

.sidebar__toggle {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.375rem;
    transition: all 0.2s;
}

.sidebar__toggle:hover {
    background: #f3f4f6;
    color: #1f2937;
}

.sidebar__nav {
    flex: 1;
    padding: 1rem 0.5rem;
    overflow-y: auto;
}

.nav-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    color: #6b7280;
    text-decoration: none;
    border-radius: 0.5rem;
    margin-bottom: 0.25rem;
    transition: all 0.2s;
    position: relative;
}

.nav-item:hover {
    background: #f3f4f6;
    color: #1f2937;
}

.nav-item.router-link-active {
    background: #d1fae5;
    color: #059669;
    font-weight: 500;
}

.nav-item__label {
    flex: 1;
}

.nav-item__badge {
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
}

.nav-item__badge--danger {
    background: #fee2e2;
    color: #dc2626;
}

.sidebar__footer {
    padding: 1rem;
    border-top: 1px solid #e5e7eb;
}

.connection-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #6b7280;
}

.status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #9ca3af;
}

.status-dot--active {
    background: #10b981;
    animation: pulse 2s infinite;
}

@keyframes pulse {

    0%,
    100% {
        opacity: 1;
    }

    50% {
        opacity: 0.5;
    }
}

/* Main Content */
.main {
    flex: 1;
    margin-left: 260px;
    transition: margin-left 0.3s ease;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
}

.sidebar--collapsed+.main {
    margin-left: 70px;
}

/* Top Bar */
.topbar {
    background: #ffffff;
    border-bottom: 1px solid #e5e7eb;
    padding: 1rem 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 30;
}

.topbar__left {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.topbar__menu-btn {
    display: none;
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.375rem;
}

.topbar__menu-btn:hover {
    background: #f3f4f6;
}

.topbar__title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
}

.topbar__right {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.topbar__item {
    position: relative;
}

.icon-btn {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.5rem;
    position: relative;
    transition: all 0.2s;
}

.icon-btn:hover {
    background: #f3f4f6;
    color: #1f2937;
}

.icon-btn .badge {
    position: absolute;
    top: 0;
    right: 0;
    background: #ef4444;
    color: white;
    font-size: 0.625rem;
    padding: 0.125rem 0.375rem;
    border-radius: 9999px;
    font-weight: 600;
}

.user-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: none;
    border: 1px solid #e5e7eb;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
    color: #1f2937;
}

.user-btn:hover {
    background: #f3f4f6;
    border-color: #d1d5db;
}

.user-name {
    font-size: 0.875rem;
    font-weight: 500;
}

/* Dropdowns */
.dropdown {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    z-index: 50;
    min-width: 280px;
    max-width: 320px;
}

.dropdown__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;
}

.dropdown__header h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
}

.text-btn {
    background: none;
    border: none;
    color: #3b82f6;
    font-size: 0.875rem;
    cursor: pointer;
    font-weight: 500;
}

.text-btn:hover {
    text-decoration: underline;
}

.dropdown__content {
    max-height: 400px;
    overflow-y: auto;
}

.dropdown__footer {
    padding: 0.75rem 1rem;
    border-top: 1px solid #e5e7eb;
    text-align: center;
}

.link {
    color: #3b82f6;
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 500;
}

.link:hover {
    text-decoration: underline;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    color: #6b7280;
}

.empty-state svg {
    color: #10b981;
    margin-bottom: 0.5rem;
}

.notifications-list {
    padding: 0.5rem;
}

.notification-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s;
}

.notification-item:hover {
    background: #f3f4f6;
}

.notification-content {
    flex: 1;
}

.notification-content p {
    font-size: 0.875rem;
    color: #1f2937;
    margin: 0 0 0.25rem 0;
}

.notification-time {
    font-size: 0.75rem;
    color: #6b7280;
}

.dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    color: #6b7280;
    text-decoration: none;
    border: none;
    background: none;
    width: 100%;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.875rem;
}

.dropdown-item:hover {
    background: #f3f4f6;
    color: #1f2937;
}

.dropdown-divider {
    height: 1px;
    background: #e5e7eb;
    margin: 0.5rem 0;
}

/* Content Area */
.content {
    flex: 1;
    padding: 2rem;
    background: #f9fafb;
}

/* Overlay */
.overlay {
    position: fixed;
    inset: 0;
    background: transparent;
    z-index: 25;
}

/* Responsive */
@media (max-width: 768px) {
    .sidebar {
        transform: translateX(-100%);
        width: 260px !important;
    }

    .sidebar--collapsed {
        transform: translateX(-100%);
    }

    .sidebar.open {
        transform: translateX(0);
    }

    .main {
        margin-left: 0 !important;
    }

    .topbar__menu-btn {
        display: block;
    }

    .topbar__title {
        font-size: 1.125rem;
    }

    .user-name {
        display: none;
    }

    .dropdown {
        right: auto;
        left: 50%;
        transform: translateX(-50%);
    }

    .content {
        padding: 1rem;
    }
}

@media (max-width: 480px) {
    .topbar {
        padding: 0.75rem 1rem;
    }

    .dropdown {
        min-width: calc(100vw - 2rem);
        max-width: calc(100vw - 2rem);
    }
}
</style>
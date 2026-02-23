<template>
  <div id="app" :class="{ 'theme-dark': darkMode }">
    <!-- Alert Toast Notification -->
    <AlertToast
      v-if="alertsStore.currentToast"
      :alert="alertsStore.currentToast"
      :show="true"
      @close="alertsStore.dismissToast"
    />

    <component :is="layoutComponent">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </component>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useAlertsStore } from "@/stores/module/alerts";

import DefaultLayout from "@/components/layouts/DefaultLayout.vue";
import AuthLayout from "@/components/layouts/AuthLayout.vue";
import AlertToast from "@/components/Alerts/AlertToast.vue";

export default {
  name: "App",
  components: {
    DefaultLayout,
    AuthLayout,
    AlertToast,
  },
  setup() {
    const route = useRoute();
    const darkMode = ref(false);
    const alertsStore = useAlertsStore();

    // Determine layout based on route meta
    const layoutComponent = computed(() => {
      const layoutName = route.meta.layout || "default";
      // Explicitly check if we're on auth routes
      if (route.name === "Login" || route.name === "Register") {
        return "AuthLayout";
      }
      return layoutName === "auth" ? "AuthLayout" : "DefaultLayout";
    });

    // Load dark mode preference
    const loadDarkModePreference = () => {
      const saved = localStorage.getItem("darkMode");
      if (saved !== null) {
        darkMode.value = saved === "true";
      } else {
        // Check system preference
        darkMode.value = window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches;
      }
    };

    // Save dark mode preference
    watch(darkMode, (newValue) => {
      localStorage.setItem("darkMode", newValue.toString());
    });

    // Fetch alerts on app mount
    onMounted(async () => {
      const token = localStorage.getItem("auth_token");
      if (token) {
        try {
          await alertsStore.fetchAlerts(); // Fetch all alerts globally
        } catch (error) {
          console.error("Failed to fetch alerts on startup:", error);
        }
      }
    });

    loadDarkModePreference();

    return {
      darkMode,
      layoutComponent,
      alertsStore,
    };
  },
};
</script>

<style>
/* Global Styles */
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap");

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body {
  height: 100%;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    Oxygen, Ubuntu, Cantarell, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  min-height: 100vh;
  background: #f9fafb;
  color: #1f2937;
}

/* Dark mode */
.theme-dark {
  background: #111827;
  color: #f9fafb;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* Utility Classes */
.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.text-center {
  text-align: center;
}

.mt-4 {
  margin-top: 1rem;
}

.mt-6 {
  margin-top: 1.5rem;
}

.mt-8 {
  margin-top: 2rem;
}

.mb-4 {
  margin-bottom: 1rem;
}

.mb-6 {
  margin-bottom: 1.5rem;
}

.mb-8 {
  margin-bottom: 2rem;
}

.flex {
  display: flex;
}

.flex-col {
  flex-direction: column;
}

.items-center {
  align-items: center;
}

.justify-center {
  justify-content: center;
}

.justify-between {
  justify-content: space-between;
}

.gap-4 {
  gap: 1rem;
}

.gap-6 {
  gap: 1.5rem;
}

/* Responsive */
@media (max-width: 768px) {
  .container {
    padding: 0 1rem;
  }
}
</style>

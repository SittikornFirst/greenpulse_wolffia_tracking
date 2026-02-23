// router/index.js
import { createRouter, createWebHistory } from "vue-router";

const routes = [
  {
    path: "/",
    name: "Home",
    redirect: "/dashboard",
  },
  {
    path: "/login",
    name: "Login",
    component: () => import("@/views/Auth/LoginView.vue"),
    meta: {
      requiresAuth: false,
      layout: "auth",
    },
  },
  {
    path: "/register",
    name: "Register",
    component: () => import("@/views/Auth/RegisterView.vue"),
    meta: {
      requiresAuth: false,
      layout: "auth",
    },
  },
  {
    path: "/dashboard",
    name: "Dashboard",
    component: () => import("@/views/DashboardView.vue"),
    meta: {
      requiresAuth: true,
      title: "Dashboard",
    },
  },
  {
    path: "/devices",
    name: "Devices",
    component: () => import("@/views/DevicesView.vue"),
    meta: {
      requiresAuth: true,
      title: "Device Management",
    },
  },
  {
    path: "/devices/:id",
    name: "DeviceDetails",
    component: () => import("@/views/DeviceDetailsView.vue"),
    meta: {
      requiresAuth: true,
      title: "Device Details",
    },
  },
  {
    path: "/alerts",
    name: "Alerts",
    component: () => import("@/views/AlertsView.vue"),
    meta: {
      requiresAuth: true,
      title: "Alerts & Notifications",
    },
  },
  {
    path: "/analytics",
    name: "Analytics",
    component: () => import("@/views/AnalyticsView.vue"),
    meta: {
      requiresAuth: true,
      title: "Analytics",
    },
  },
  {
    path: "/farms",
    name: "Farms",
    component: () => import("@/views/FarmsView.vue"),
    meta: {
      requiresAuth: true,
      title: "Farm Management",
    },
  },
  {
    path: "/farms/:id",
    name: "FarmDetails",
    component: () => import("@/views/FarmDetailsView.vue"),
    meta: {
      requiresAuth: true,
      title: "Farm Details",
    },
  },
  {
    path: "/settings",
    name: "Settings",
    component: () => import("@/views/SettingsView.vue"),
    meta: {
      requiresAuth: true,
      title: "Settings",
    },
  },
  {
    path: "/profile",
    name: "Profile",
    component: () => import("@/views/ProfileView.vue"),
    meta: {
      requiresAuth: true,
      title: "Profile",
    },
  },
  {
    path: "/users",
    name: "Users",
    component: () => import("@/views/UsersManagementView.vue"),
    meta: {
      requiresAuth: true,
      requiresAdmin: true,
      title: "User Management",
    },
  },
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: () => import("@/views/NotFoundView.vue"),
    meta: {
      title: "404 - Not Found",
    },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    } else {
      return { top: 0 };
    }
  },
});

// Navigation guard - no authentication required
router.beforeEach((to, from, next) => {
  // Set page title
  if (to.meta.title) {
    document.title = `${to.meta.title} | Wolffia Monitoring`;
  } else {
    document.title = "Wolffia Monitoring System";
  }

  // Auth check
  const isAuthenticated = localStorage.getItem("auth_token");
  const userRole = localStorage.getItem("user_role");

  if (to.meta.requiresAuth && !isAuthenticated) {
    next({
      path: "/login",
      query: { redirect: to.fullPath },
    });
  } else if (to.meta.requiresAdmin && userRole !== "admin") {
    // Redirect non-admin users away from admin-only pages
    next({
      path: "/dashboard",
    });
  } else if (
    (to.name === "Login" || to.name === "Register") &&
    isAuthenticated
  ) {
    // Redirect to dashboard if already logged in
    next("/dashboard");
  } else {
    next();
  }
});

// Navigation guard for error handling
router.onError((error) => {
  console.error("Router error:", error);
});

// Set router instance in API service
import { setRouter } from "@/services/api";
setRouter(router);

export default router;

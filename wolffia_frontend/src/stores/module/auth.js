import { defineStore } from "pinia";
import { ref, computed } from "vue";
import apiService from "@/services/api";

export const useAuthStore = defineStore("auth", () => {
  const token = ref(localStorage.getItem("auth_token") || null);
  const userName = ref(localStorage.getItem("user_name") || null);
  const userRole = ref(localStorage.getItem("user_role") || null);

  const isAuthenticated = computed(() => !!token.value);
  const isAdmin = computed(() => userRole.value === "admin");

  function initFromStorage() {
    token.value = localStorage.getItem("auth_token") || null;
    userName.value = localStorage.getItem("user_name") || null;
    userRole.value = localStorage.getItem("user_role") || null;
  }

  async function login(credentials) {
    const response = await apiService.login(credentials);
    if (response.data.token) {
      token.value = response.data.token;
      userName.value = response.data.user?.user_name || null;
      userRole.value = response.data.user?.role || null;
      localStorage.setItem("auth_token", token.value);
      if (userName.value) localStorage.setItem("user_name", userName.value);
      if (userRole.value) localStorage.setItem("user_role", userRole.value);
    }
    return response;
  }

  async function logout() {
    try {
      await apiService.logout();
    } finally {
      token.value = null;
      userName.value = null;
      userRole.value = null;
    }
  }

  return {
    token,
    userName,
    userRole,
    isAuthenticated,
    isAdmin,
    initFromStorage,
    login,
    logout,
  };
});

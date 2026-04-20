<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="loading" class="global-loader-overlay">
        <div class="global-loader">
          <div class="loader-spinner"></div>
          <p v-if="text" class="loader-text">{{ text }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
import { ref } from "vue";

const loading = ref(false);
const text = ref("Loading...");

export function useGlobalLoader() {
  const show = (msg = "Loading...") => {
    text.value = msg;
    loading.value = true;
  };

  const hide = () => {
    loading.value = false;
  };

  return { loading, text, show, hide };
}

export default {
  name: "GlobalLoader",
  setup() {
    return { loading, text };
  },
};
</script>

<style scoped>
.global-loader-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.global-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem 3rem;
  background: white;
  border-radius: 1rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.loader-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e5e7eb;
  border-top-color: #10b981;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loader-text {
  font-size: 1rem;
  font-weight: 500;
  color: #374151;
  margin: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
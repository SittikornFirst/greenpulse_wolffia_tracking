<template>
  <div class="loading-state" :class="{ 'loading-state--inline': inline }">
    <div v-if="!inline" class="loading-spinner-large">
      <div class="spinner-ring"></div>
    </div>
    <div v-if="text || inline" class="loading-text">
      <Loader v-if="inline" :size="16" class="loading-icon-inline" />
      <span>{{ text || "Loading..." }}</span>
    </div>
  </div>
</template>

<script>
import { Loader } from "lucide-vue-next";

export default {
  name: "LoadingState",
  components: { Loader },
  props: {
    text: { type: String, default: "" },
    inline: { type: Boolean, default: false },
    fullscreen: { type: Boolean, default: false }
  }
};
</script>

<style scoped>
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 2rem;
  gap: 1rem;
}

.loading-state--inline {
  flex-direction: row;
  padding: 0.5rem;
  gap: 0.5rem;
}

.loading-spinner-large {
  width: 48px;
  height: 48px;
}

.spinner-ring {
  width: 100%;
  height: 100%;
  border: 4px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.loading-icon-inline {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
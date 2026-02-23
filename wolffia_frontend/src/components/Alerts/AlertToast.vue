<template>
  <Transition name="slide-in">
    <div v-if="visible" class="alert-toast" :class="`alert-toast--${severity}`">
      <div class="alert-toast__icon">
        <AlertCircle :size="20" />
      </div>

      <div class="alert-toast__content">
        <h4 class="alert-toast__title">Alert: {{ parameter }}</h4>
        <p class="alert-toast__message">{{ message }}</p>
        <span class="alert-toast__device">{{ deviceName }}</span>
      </div>

      <button
        @click="closeToast"
        class="alert-toast__close"
        title="Dismiss alert"
      >
        <X :size="18" />
      </button>
    </div>
  </Transition>
</template>

<script>
import { ref, computed, onMounted } from "vue";
import { AlertCircle, X } from "lucide-vue-next";

export default {
  name: "AlertToast",
  components: {
    AlertCircle,
    X,
  },
  props: {
    alert: {
      type: Object,
      required: true,
    },
    show: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["close"],
  setup(props, { emit }) {
    const visible = ref(props.show);

    const severity = computed(() => {
      return props.alert?.severity || "caution";
    });

    const parameter = computed(() => {
      return props.alert?.parameter || "Unknown";
    });

    const message = computed(() => {
      return props.alert?.message || "Alert notification";
    });

    const deviceName = computed(() => {
      return (
        props.alert?.device_name || props.alert?.device || "Unknown Device"
      );
    });

    const closeToast = () => {
      visible.value = false;
      setTimeout(() => {
        emit("close");
      }, 300); // Wait for animation
    };

    onMounted(() => {
      visible.value = true;
    });

    return {
      visible,
      severity,
      parameter,
      message,
      deviceName,
      closeToast,
    };
  },
};
</script>

<style scoped>
.alert-toast {
  position: fixed;
  top: 20px;
  left: 20px;
  max-width: 400px;
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  border-left: 4px solid;
  z-index: 9999;
  animation: pulse 2s ease-in-out infinite;
}

.alert-toast--caution {
  border-left-color: #f59e0b;
}

.alert-toast__icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.alert-toast--caution .alert-toast__icon {
  background: #fef3c7;
  color: #d97706;
}

.alert-toast__content {
  flex: 1;
  min-width: 0;
}

.alert-toast__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.25rem 0;
}

.alert-toast__message {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0 0 0.5rem 0;
  line-height: 1.4;
}

.alert-toast__device {
  font-size: 0.75rem;
  color: #9ca3af;
  font-weight: 500;
}

.alert-toast__close {
  flex-shrink: 0;
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.375rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.alert-toast__close:hover {
  background: #f3f4f6;
  color: #374151;
}

/* Animations */
@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1);
  }
  50% {
    box-shadow: 0 10px 25px rgba(245, 158, 11, 0.3),
      0 4px 10px rgba(245, 158, 11, 0.2);
  }
}

.slide-in-enter-active {
  animation: slideIn 0.3s ease-out;
}

.slide-in-leave-active {
  animation: slideOut 0.3s ease-in;
}

@keyframes slideIn {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOut {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(-100%);
    opacity: 0;
  }
}

/* Mobile responsive */
@media (max-width: 768px) {
  .alert-toast {
    left: 10px;
    right: 10px;
    max-width: calc(100% - 20px);
  }
}
</style>

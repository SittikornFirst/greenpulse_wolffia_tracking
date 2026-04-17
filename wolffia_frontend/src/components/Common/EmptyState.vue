<template>
  <div class="empty-state" :class="{ 'empty-state--compact': compact }">
    <div class="empty-state-icon" :class="`empty-state-icon--${type}`">
      <component :is="iconComponent" :size="compact ? 32 : 48" />
    </div>
    <h3 class="empty-state-title">{{ title }}</h3>
    <p v-if="description" class="empty-state-description">{{ description }}</p>
    <div v-if="$slots.action" class="empty-state-action">
      <slot name="action" />
    </div>
  </div>
</template>

<script>
import { computed } from "vue";
import { Inbox, Cpu, Search, AlertTriangle, FileQuestion, Wifi, Database } from "lucide-vue-next";

export default {
  name: "EmptyState",
  components: { Inbox, Cpu, Search, AlertTriangle, FileQuestion, Wifi, Database },
  props: {
    type: {
      type: String,
      default: "default",
      validator: (v) => ["default", "no-data", "no-devices", "no-results", "error", "offline", "not-found"].includes(v)
    },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    compact: { type: Boolean, default: false },
    icon: { type: String, default: null }
  },
  setup(props) {
    const iconComponent = computed(() => {
      if (props.icon) {
        const icons = { Inbox, Cpu, Search, AlertTriangle, FileQuestion, Wifi, Database };
        return icons[props.icon] || Inbox;
      }
      
      const typeIcons = {
        "no-data": Inbox,
        "no-devices": Cpu,
        "no-results": Search,
        "error": AlertTriangle,
        "offline": Wifi,
        "not-found": FileQuestion,
        "default": Inbox
      };
      return typeIcons[props.type] || Inbox;
    });

    return { iconComponent };
  }
};
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  background: white;
  border-radius: 1rem;
  border: 1px dashed #e5e7eb;
}

.empty-state--compact {
  padding: 2rem 1rem;
}

.empty-state-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #f3f4f6;
  color: #9ca3af;
  margin-bottom: 1.5rem;
}

.empty-state--compact .empty-state-icon {
  width: 56px;
  height: 56px;
  margin-bottom: 1rem;
}

.empty-state-icon--error {
  background: #fef2f2;
  color: #ef4444;
}

.empty-state-icon--offline {
  background: #fef3c7;
  color: #f59e0b;
}

.empty-state-icon--no-devices {
  background: #eff6ff;
  color: #3b82f6;
}

.empty-state-title {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
}

.empty-state--compact .empty-state-title {
  font-size: 1rem;
  margin-bottom: 0.25rem;
}

.empty-state-description {
  margin: 0 0 1.5rem;
  font-size: 0.875rem;
  color: #6b7280;
  max-width: 400px;
}

.empty-state--compact .empty-state-description {
  font-size: 0.8rem;
  margin-bottom: 1rem;
}

.empty-state-action {
  margin-top: 0.5rem;
}
</style>
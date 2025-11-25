<template>
    <div :class="['alert-item', `alert-item--${alert.type}`, { 'alert-item--resolved': alert.resolved }]">
        <div class="alert-item__icon">
            <component :is="alertIcon" :size="20" />
        </div>

        <div class="alert-item__content">
            <div class="alert-item__header">
                <h4 class="alert-item__title">{{ alert.message }}</h4>
                <span :class="['alert-badge', `alert-badge--${alert.type}`]">
                    {{ priorityLabel }}
                </span>
            </div>

            <div class="alert-item__meta">
                <span class="alert-item__time">
                    <Clock :size="14" />
                    {{ formatTime(alert.time || alert.timestamp) }}
                </span>

                <span v-if="alert.device" class="alert-item__device">
                    <Cpu :size="14" />
                    Device: {{ alert.device }}
                </span>

                <span v-if="alert.resolved" class="alert-item__resolved">
                    <CheckCircle :size="14" />
                    Resolved
                </span>
            </div>

            <p v-if="alert.description" class="alert-item__description">
                {{ alert.description }}
            </p>
        </div>

        <div class="alert-item__actions">
            <button v-if="!alert.resolved" @click="handleResolve" :disabled="resolving" class="btn btn--resolve"
                title="Mark as resolved">
                <CheckCircle :size="16" />
                <span>Resolve</span>
            </button>

            <button v-if="showDetails" @click="$emit('view-details', alert)" class="btn btn--secondary"
                title="View details">
                <Eye :size="16" />
            </button>

            <button v-if="allowDelete" @click="handleDelete" :disabled="deleting" class="btn btn--danger"
                title="Delete alert">
                <Trash2 :size="16" />
            </button>
        </div>
    </div>
</template>

<script>
import { ref, computed } from 'vue';
import {
    AlertTriangle,
    AlertCircle,
    Info,
    Clock,
    Cpu,
    CheckCircle,
    Eye,
    Trash2
} from 'lucide-vue-next';

export default {
    name: 'AlertItem',
    components: {
        AlertTriangle,
        AlertCircle,
        Info,
        Clock,
        Cpu,
        CheckCircle,
        Eye,
        Trash2
    },
    props: {
        alert: {
            type: Object,
            required: true
        },
        showDetails: {
            type: Boolean,
            default: false
        },
        allowDelete: {
            type: Boolean,
            default: false
        }
    },
    emits: ['resolve', 'delete', 'view-details'],
    setup(props, { emit }) {
        const resolving = ref(false);
        const deleting = ref(false);

        const alertIcon = computed(() => {
            switch (props.alert.type) {
                case 'high':
                    return AlertTriangle;
                case 'medium':
                    return AlertCircle;
                case 'low':
                    return Info;
                default:
                    return AlertCircle;
            }
        });

        const priorityLabel = computed(() => {
            switch (props.alert.type) {
                case 'high':
                    return 'High Priority';
                case 'medium':
                    return 'Medium Priority';
                case 'low':
                    return 'Low Priority';
                default:
                    return 'Unknown';
            }
        });

        const formatTime = (timestamp) => {
            if (!timestamp) return 'Unknown time';

            const now = new Date();
            const then = new Date(timestamp);
            const diffMs = now - then;
            const diffMins = Math.floor(diffMs / 60000);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins} min ago`;
            if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
            if (diffMins < 10080) return `${Math.floor(diffMins / 1440)} days ago`;

            return then.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: then.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
            });
        };

        const handleResolve = async () => {
            if (resolving.value) return;

            resolving.value = true;
            try {
                await emit('resolve', props.alert.id);
            } catch (error) {
                console.error('Error resolving alert:', error);
            } finally {
                resolving.value = false;
            }
        };

        const handleDelete = async () => {
            if (deleting.value) return;

            if (!confirm('Are you sure you want to delete this alert?')) {
                return;
            }

            deleting.value = true;
            try {
                await emit('delete', props.alert.id);
            } catch (error) {
                console.error('Error deleting alert:', error);
            } finally {
                deleting.value = false;
            }
        };

        return {
            resolving,
            deleting,
            alertIcon,
            priorityLabel,
            formatTime,
            handleResolve,
            handleDelete
        };
    }
};
</script>

<style scoped>
.alert-item {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background: white;
    border-radius: 0.5rem;
    border-left: 4px solid;
    transition: all 0.2s;
}

.alert-item:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.alert-item--high {
    border-left-color: #ef4444;
}

.alert-item--medium {
    border-left-color: #f59e0b;
}

.alert-item--low {
    border-left-color: #3b82f6;
}

.alert-item--resolved {
    opacity: 0.6;
    background: #f9fafb;
}

.alert-item__icon {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.5rem;
}

.alert-item--high .alert-item__icon {
    background: #fee2e2;
    color: #dc2626;
}

.alert-item--medium .alert-item__icon {
    background: #fef3c7;
    color: #d97706;
}

.alert-item--low .alert-item__icon {
    background: #dbeafe;
    color: #2563eb;
}

.alert-item__content {
    flex: 1;
    min-width: 0;
}

.alert-item__header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
}

.alert-item__title {
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
}

.alert-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
}

.alert-badge--high {
    background: #fee2e2;
    color: #991b1b;
}

.alert-badge--medium {
    background: #fef3c7;
    color: #92400e;
}

.alert-badge--low {
    background: #dbeafe;
    color: #1e40af;
}

.alert-item__meta {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 0.875rem;
    color: #6b7280;
    margin-bottom: 0.5rem;
}

.alert-item__time,
.alert-item__device,
.alert-item__resolved {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.alert-item__resolved {
    color: #059669;
    font-weight: 500;
}

.alert-item__description {
    font-size: 0.875rem;
    color: #4b5563;
    margin: 0;
    line-height: 1.5;
}

.alert-item__actions {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
}

.btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn--resolve {
    background: #10b981;
    color: white;
}

.btn--resolve:hover:not(:disabled) {
    background: #059669;
}

.btn--secondary {
    background: #f3f4f6;
    color: #374151;
    padding: 0.5rem;
}

.btn--secondary:hover:not(:disabled) {
    background: #e5e7eb;
}

.btn--danger {
    background: #fee2e2;
    color: #dc2626;
    padding: 0.5rem;
}

.btn--danger:hover:not(:disabled) {
    background: #fecaca;
}

@media (max-width: 768px) {
    .alert-item {
        flex-direction: column;
    }

    .alert-item__actions {
        width: 100%;
    }

    .btn {
        flex: 1;
        justify-content: center;
    }

    .alert-item__meta {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
    }
}
</style>
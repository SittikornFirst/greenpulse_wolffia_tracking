<template>
    <div class="metric-card" :class="[`metric-card--${status}`, { 'metric-card--loading': loading }]">
        <div class="metric-card__content">
            <div class="metric-card__icon-wrapper">
                <div class="metric-card__icon" :class="`metric-card__icon--${status}`">
                    <component :is="iconComponent" :size="24" />
                </div>
                <div class="metric-card__info">
                    <p class="metric-card__title">{{ title }}</p>
                    <div class="metric-card__value">
                        {{ formattedValue }}
                        <span class="metric-card__unit">{{ unit }}</span>
                    </div>
                </div>
            </div>

            <div v-if="trend !== null" class="metric-card__trend" :class="trendClass">
                <component :is="trendIcon" :size="16" />
                <span class="metric-card__trend-value">{{ Math.abs(trend) }}%</span>
            </div>
        </div>

        <div v-if="showRange" class="metric-card__range">
            <span class="metric-card__range-label">Optimal:</span>
            <span class="metric-card__range-value">{{ rangeMin }} - {{ rangeMax }} {{ unit }}</span>
        </div>

        <div v-if="lastUpdate" class="metric-card__footer">
            <span class="metric-card__last-update">
                Updated {{ formatTimestamp(lastUpdate) }}
            </span>
        </div>
    </div>
</template>

<script>
import { computed } from 'vue';
import { Droplet, Thermometer, Sun, Activity, TrendingUp, TrendingDown, Minus } from 'lucide-vue-next';

export default {
    name: 'MetricCard',
    components: {
        Droplet,
        Thermometer,
        Sun,
        Activity,
        TrendingUp,
        TrendingDown,
        Minus
    },
    props: {
        title: {
            type: String,
            required: true
        },
        value: {
            type: [Number, String],
            required: true
        },
        unit: {
            type: String,
            default: ''
        },
        icon: {
            type: String,
            default: 'Activity',
            validator: (value) => ['Droplet', 'Thermometer', 'Sun', 'Activity'].includes(value)
        },
        status: {
            type: String,
            default: 'normal',
            validator: (value) => ['normal', 'warning', 'critical'].includes(value)
        },
        trend: {
            type: Number,
            default: null
        },
        rangeMin: {
            type: Number,
            default: null
        },
        rangeMax: {
            type: Number,
            default: null
        },
        showRange: {
            type: Boolean,
            default: true
        },
        lastUpdate: {
            type: [String, Date, Number],
            default: null
        },
        loading: {
            type: Boolean,
            default: false
        },
        decimals: {
            type: Number,
            default: 1
        }
    },
    setup(props) {
        const iconComponent = computed(() => {
            const icons = { Droplet, Thermometer, Sun, Activity };
            return icons[props.icon] || Activity;
        });

        const trendIcon = computed(() => {
            if (props.trend === 0) return Minus;
            return props.trend > 0 ? TrendingUp : TrendingDown;
        });

        const trendClass = computed(() => {
            if (props.trend === 0) return 'metric-card__trend--neutral';
            return props.trend > 0 ? 'metric-card__trend--up' : 'metric-card__trend--down';
        });

        const formattedValue = computed(() => {
            if (typeof props.value === 'number') {
                return props.value.toFixed(props.decimals);
            }
            return props.value;
        });

        const formatTimestamp = (timestamp) => {
            const now = new Date();
            const then = new Date(timestamp);
            const diffMs = now - then;
            const diffMins = Math.floor(diffMs / 60000);

            if (diffMins < 1) return 'just now';
            if (diffMins < 60) return `${diffMins} min ago`;
            if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
            return then.toLocaleDateString();
        };

        return {
            iconComponent,
            trendIcon,
            trendClass,
            formattedValue,
            formatTimestamp
        };
    }
};
</script>

<style scoped>
.metric-card {
    background: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    border-left: 4px solid;
    transition: all 0.3s ease;
}

.metric-card--normal {
    border-left-color: #10b981;
}

.metric-card--warning {
    border-left-color: #f59e0b;
}

.metric-card--critical {
    border-left-color: #ef4444;
}

.metric-card:hover {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
}

.metric-card--loading {
    opacity: 0.6;
    pointer-events: none;
}

.metric-card__content {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 1rem;
}

.metric-card__icon-wrapper {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.metric-card__icon {
    padding: 0.75rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
}

.metric-card__icon--normal {
    background-color: #d1fae5;
    color: #059669;
}

.metric-card__icon--warning {
    background-color: #fef3c7;
    color: #d97706;
}

.metric-card__icon--critical {
    background-color: #fee2e2;
    color: #dc2626;
}

.metric-card__info {
    display: flex;
    flex-direction: column;
}

.metric-card__title {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0 0 0.25rem 0;
}

.metric-card__value {
    font-size: 1.875rem;
    font-weight: 700;
    color: #1f2937;
    line-height: 1;
}

.metric-card__unit {
    font-size: 0.875rem;
    font-weight: 400;
    color: #6b7280;
    margin-left: 0.25rem;
}

.metric-card__trend {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.875rem;
    font-weight: 600;
}

.metric-card__trend--up {
    color: #059669;
}

.metric-card__trend--down {
    color: #dc2626;
}

.metric-card__trend--neutral {
    color: #6b7280;
}

.metric-card__range {
    padding-top: 0.75rem;
    border-top: 1px solid #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.875rem;
}

.metric-card__range-label {
    color: #6b7280;
}

.metric-card__range-value {
    color: #1f2937;
    font-weight: 500;
}

.metric-card__footer {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid #e5e7eb;
}

.metric-card__last-update {
    font-size: 0.75rem;
    color: #9ca3af;
}

/* Responsive Design */
@media (max-width: 768px) {
    .metric-card {
        padding: 1rem;
    }

    .metric-card__value {
        font-size: 1.5rem;
    }

    .metric-card__icon {
        padding: 0.5rem;
    }
}
</style>
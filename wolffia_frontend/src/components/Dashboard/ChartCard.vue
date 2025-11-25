<template>
    <div class="chart-card">
        <div class="chart-card__header">
            <h3 class="chart-card__title">{{ title }}</h3>
            <div class="chart-card__actions">
                <button v-for="range in timeRanges" :key="range.value" @click="selectTimeRange(range.value)"
                    :class="['time-range-btn', { 'active': selectedRange === range.value }]">
                    {{ range.label }}
                </button>
            </div>
        </div>

        <div v-if="loading" class="chart-card__loading">
            <div class="spinner"></div>
            <p>Loading data...</p>
        </div>

        <div v-else-if="!hasData" class="chart-card__empty">
            <AlertCircle :size="32" />
            <p>No data available</p>
        </div>

        <div v-else class="chart-card__content">
            <div class="chart-container">
                <canvas ref="chartCanvas"></canvas>
            </div>

            <div v-if="optimalRange" class="chart-card__footer">
                <div class="optimal-range">
                    <span class="optimal-range__label">Optimal Range:</span>
                    <span class="optimal-range__value">
                        {{ optimalRange.min }} - {{ optimalRange.max }} {{ unit }}
                    </span>
                </div>
                <div :class="['status-badge', `status-badge--${currentStatus}`]">
                    <component :is="statusIcon" :size="16" />
                    <span>{{ statusText }}</span>
                </div>
            </div>

            <div v-if="showStatistics" class="chart-card__stats">
                <div class="stat-item">
                    <span class="stat-label">Average</span>
                    <span class="stat-value">{{ statistics.avg.toFixed(decimals) }} {{ unit }}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Min</span>
                    <span class="stat-value">{{ statistics.min.toFixed(decimals) }} {{ unit }}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Max</span>
                    <span class="stat-value">{{ statistics.max.toFixed(decimals) }} {{ unit }}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Readings</span>
                    <span class="stat-value">{{ statistics.count }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { AlertCircle, CheckCircle, AlertTriangle, XCircle } from 'lucide-vue-next';
import Chart from 'chart.js/auto';

export default {
    name: 'ChartCard',
    components: {
        AlertCircle,
        CheckCircle,
        AlertTriangle,
        XCircle
    },
    props: {
        title: {
            type: String,
            required: true
        },
        data: {
            type: Array,
            default: () => []
        },
        chartType: {
            type: String,
            default: 'line',
            validator: (value) => ['line', 'area', 'bar'].includes(value)
        },
        color: {
            type: String,
            default: '#3b82f6'
        },
        optimalRange: {
            type: Object,
            default: null
        },
        unit: {
            type: String,
            default: ''
        },
        loading: {
            type: Boolean,
            default: false
        },
        showStatistics: {
            type: Boolean,
            default: true
        },
        decimals: {
            type: Number,
            default: 1
        }
    },
    emits: ['range-change'],
    setup(props, { emit }) {
        const chartCanvas = ref(null);
        const chartInstance = ref(null);
        const selectedRange = ref('24h');

        const timeRanges = [
            { label: '24H', value: '24h' },
            { label: '7D', value: '7d' },
            { label: '30D', value: '30d' }
        ];

        const hasData = computed(() => props.data && props.data.length > 0);

        const statistics = computed(() => {
            if (!hasData.value) {
                return { min: 0, max: 0, avg: 0, count: 0 };
            }

            const values = props.data.map(d => d.value);
            const sum = values.reduce((acc, val) => acc + val, 0);

            return {
                min: Math.min(...values),
                max: Math.max(...values),
                avg: sum / values.length,
                count: values.length
            };
        });

        const currentStatus = computed(() => {
            if (!hasData.value || !props.optimalRange) return 'unknown';

            const latestValue = props.data[props.data.length - 1]?.value;
            if (!latestValue) return 'unknown';

            if (latestValue < props.optimalRange.min || latestValue > props.optimalRange.max) {
                return 'critical';
            }

            const optimal = (props.optimalRange.min + props.optimalRange.max) / 2;
            const deviation = Math.abs(latestValue - optimal) / optimal;

            if (deviation > 0.1) return 'warning';
            return 'normal';
        });

        const statusIcon = computed(() => {
            switch (currentStatus.value) {
                case 'normal': return CheckCircle;
                case 'warning': return AlertTriangle;
                case 'critical': return XCircle;
                default: return AlertCircle;
            }
        });

        const statusText = computed(() => {
            switch (currentStatus.value) {
                case 'normal': return 'Normal';
                case 'warning': return 'Warning';
                case 'critical': return 'Critical';
                default: return 'Unknown';
            }
        });

        const selectTimeRange = (range) => {
            selectedRange.value = range;
            emit('range-change', range);
        };

        const createChart = async () => {
            await nextTick();

            if (!chartCanvas.value || !hasData.value) return;

            const ctx = chartCanvas.value.getContext('2d');

            // Destroy existing chart
            if (chartInstance.value) {
                chartInstance.value.destroy();
            }

            // Prepare data
            const labels = props.data.map(d => {
                const date = new Date(d.timestamp);
                return date.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
            });

            const values = props.data.map(d => d.value);

            // Chart configuration
            const config = {
                type: props.chartType === 'area' ? 'line' : props.chartType,
                data: {
                    labels,
                    datasets: [{
                        label: props.title,
                        data: values,
                        borderColor: props.color,
                        backgroundColor: props.chartType === 'area'
                            ? `${props.color}33`
                            : props.color,
                        fill: props.chartType === 'area',
                        tension: 0.4,
                        pointRadius: 2,
                        pointHoverRadius: 5,
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 12,
                            titleFont: { size: 14 },
                            bodyFont: { size: 13 },
                            callbacks: {
                                label: (context) => {
                                    return `${context.parsed.y.toFixed(props.decimals)} ${props.unit}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            },
                            ticks: {
                                maxTicksLimit: 8,
                                font: { size: 11 }
                            }
                        },
                        y: {
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            },
                            ticks: {
                                font: { size: 11 },
                                callback: (value) => {
                                    return `${value.toFixed(props.decimals)}`;
                                }
                            }
                        }
                    }
                }
            };

            // Add optimal range visualization
            if (props.optimalRange) {
                config.options.plugins.annotation = {
                    annotations: {
                        box: {
                            type: 'box',
                            yMin: props.optimalRange.min,
                            yMax: props.optimalRange.max,
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            borderWidth: 0
                        }
                    }
                };
            }

            chartInstance.value = new Chart(ctx, config);
        };

        // Watchers
        watch(() => props.data, () => {
            if (hasData.value) {
                createChart();
            }
        }, { deep: true });

        watch(() => props.loading, (newVal) => {
            if (!newVal && hasData.value) {
                createChart();
            }
        });

        // Lifecycle
        onMounted(() => {
            if (hasData.value && !props.loading) {
                createChart();
            }
        });

        onUnmounted(() => {
            if (chartInstance.value) {
                chartInstance.value.destroy();
            }
        });

        return {
            chartCanvas,
            selectedRange,
            timeRanges,
            hasData,
            statistics,
            currentStatus,
            statusIcon,
            statusText,
            selectTimeRange
        };
    }
};
</script>

<style scoped>
.chart-card {
    background: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
}

.chart-card__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
}

.chart-card__title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
}

.chart-card__actions {
    display: flex;
    gap: 0.5rem;
}

.time-range-btn {
    padding: 0.375rem 0.75rem;
    border: 1px solid #e5e7eb;
    background: white;
    color: #6b7280;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.time-range-btn:hover {
    border-color: #3b82f6;
    color: #3b82f6;
}

.time-range-btn.active {
    background: #3b82f6;
    color: white;
    border-color: #3b82f6;
}

.chart-card__loading,
.chart-card__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: #6b7280;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.chart-card__content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.chart-container {
    height: 250px;
    position: relative;
}

.chart-card__footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
    font-size: 0.875rem;
}

.optimal-range__label {
    color: #6b7280;
    margin-right: 0.5rem;
}

.optimal-range__value {
    color: #1f2937;
    font-weight: 500;
}

.status-badge {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border-radius: 0.375rem;
    font-weight: 600;
}

.status-badge--normal {
    background: #d1fae5;
    color: #059669;
}

.status-badge--warning {
    background: #fef3c7;
    color: #d97706;
}

.status-badge--critical {
    background: #fee2e2;
    color: #dc2626;
}

.status-badge--unknown {
    background: #f3f4f6;
    color: #6b7280;
}

.chart-card__stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
}

.stat-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.stat-label {
    font-size: 0.75rem;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.stat-value {
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
}

@media (max-width: 768px) {
    .chart-card__header {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
    }

    .chart-card__stats {
        grid-template-columns: repeat(2, 1fr);
    }

    .chart-container {
        height: 200px;
    }
}
</style>
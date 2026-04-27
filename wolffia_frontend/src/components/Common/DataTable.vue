<template>
  <div class="data-table-wrapper">
    <div class="table-header" v-if="title || $slots.header">
      <div class="header-left">
        <h3 v-if="title" class="table-title">{{ title }}</h3>
        <span v-if="subtitle" class="table-subtitle">{{ subtitle }}</span>
      </div>
      <div class="header-right">
        <slot name="header" />
      </div>
    </div>

    <div v-if="loading && !data.length" class="loading-overlay">
      <LoadingState text="Loading data..." />
    </div>

    <div v-else-if="!data.length" class="empty-overlay">
      <EmptyState 
        type="no-data"
        :title="emptyTitle || 'No data available'"
        :description="emptyDescription || 'There are no records to display.'"
      >
        <template #action>
          <slot name="empty-action" />
        </template>
      </EmptyState>
    </div>

    <div v-else class="table-container" :class="{ 'table-scroll': scrollable }">
      <table class="data-table">
        <thead>
          <tr>
            <th 
              v-for="column in columns" 
              :key="column.key"
              :class="[column.class, { 'sortable': column.sortable }]"
              :style="column.width ? { width: column.width } : {}"
              @click="column.sortable && handleSort(column.key)"
            >
              <div class="th-content">
                <span>{{ column.label }}</span>
                <span v-if="column.sortable" class="sort-icon">
                  <ChevronUp v-if="sortKey === column.key && sortOrder === 'asc'" :size="14" />
                  <ChevronDown v-else-if="sortKey === column.key && sortOrder === 'desc'" :size="14" />
                  <ChevronsUpDown v-else :size="14" class="sort-icon-inactive" />
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in paginatedData" :key="getRowKey(row, index)">
            <td 
              v-for="column in columns" 
              :key="column.key"
              :class="column.cellClass"
            >
              <slot :name="`cell-${column.key}`" :row="row" :value="getCellValue(row, column)">
                {{ formatCell(row, column) }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="data.length > pageSize && pagination" class="table-footer">
      <div class="pagination-info">
        Showing {{ (currentPage - 1) * pageSize + 1 }} to {{ Math.min(currentPage * pageSize, data.length) }} of {{ data.length }} entries
      </div>
      <div class="pagination-controls">
        <button 
          @click="currentPage--" 
          :disabled="currentPage === 1"
          class="btn-pagination"
        >
          Previous
        </button>
        <span class="page-indicator">Page {{ currentPage }} of {{ totalPages }}</span>
        <button 
          @click="currentPage++" 
          :disabled="currentPage >= totalPages"
          class="btn-pagination"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from "vue";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-vue-next";
import LoadingState from "./LoadingState.vue";
import EmptyState from "./EmptyState.vue";

export default {
  name: "DataTable",
  components: { LoadingState, EmptyState, ChevronUp, ChevronDown, ChevronsUpDown },
  props: {
    columns: { type: Array, required: true },
    data: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    emptyTitle: { type: String, default: "" },
    emptyDescription: { type: String, default: "" },
    pagination: { type: Boolean, default: true },
    pageSize: { type: Number, default: 10 },
    scrollable: { type: Boolean, default: true },
    rowKey: { type: String, default: "id" }
  },
  emits: ["sort", "page-change"],
  setup(props, { emit }) {
    const currentPage = ref(1);
    const sortKey = ref("");
    const sortOrder = ref("asc");

    const totalPages = computed(() => Math.ceil(props.data.length / props.pageSize));

    const unwrap = (val) => {
      if (val !== null && typeof val === "object" && "value" in val) return val.value;
      return val;
    };

    const sortedData = computed(() => {
      if (!sortKey.value) return props.data;

      return [...props.data].sort((a, b) => {
        const aVal = unwrap(getNestedValue(a, sortKey.value));
        const bVal = unwrap(getNestedValue(b, sortKey.value));

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        if (aVal < bVal) return sortOrder.value === "asc" ? -1 : 1;
        if (aVal > bVal) return sortOrder.value === "asc" ? 1 : -1;
        return 0;
      });
    });

    const paginatedData = computed(() => {
      if (!props.pagination) return sortedData.value;
      const start = (currentPage.value - 1) * props.pageSize;
      return sortedData.value.slice(start, start + props.pageSize);
    });

    const getRowKey = (row, index) => {
      return row[props.rowKey] || index;
    };

    const getCellValue = (row, column) => {
      return getNestedValue(row, column.key);
    };

    const getNestedValue = (obj, path) => {
      return path.split(".").reduce((acc, part) => acc && acc[part], obj);
    };

    const formatCell = (row, column) => {
      const value = getCellValue(row, column);
      if (value === null || value === undefined) return column.defaultValue || "--";
      if (column.format) return column.format(value, row);
      return value;
    };

    const handleSort = (key) => {
      if (sortKey.value === key) {
        sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
      } else {
        sortKey.value = key;
        sortOrder.value = "asc";
      }
      emit("sort", { key: sortKey.value, order: sortOrder.value });
    };

    return {
      currentPage,
      sortKey,
      sortOrder,
      totalPages,
      paginatedData,
      getRowKey,
      getCellValue,
      formatCell,
      handleSort
    };
  }
};
</script>

<style scoped>
.data-table-wrapper {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.table-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
}

.table-subtitle {
  font-size: 0.875rem;
  color: #6b7280;
  margin-left: 8px;
}

.loading-overlay,
.empty-overlay {
  padding: 2rem;
}

.table-container {
  overflow-x: auto;
}

.table-container.table-scroll {
  max-height: 600px;
  overflow-y: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  padding: 12px 16px;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: #6b7280;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
}

.data-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.data-table th.sortable:hover {
  background: #f3f4f6;
}

.th-content {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sort-icon {
  display: flex;
  color: #3b82f6;
}

.sort-icon-inactive {
  color: #d1d5db;
}

.data-table td {
  padding: 12px 16px;
  font-size: 0.875rem;
  color: #374151;
  border-bottom: 1px solid #f3f4f6;
}

.data-table tbody tr:hover {
  background: #f9fafb;
}

.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

.pagination-info {
  font-size: 0.875rem;
  color: #6b7280;
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.btn-pagination {
  padding: 6px 12px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-pagination:hover:not(:disabled) {
  background: #f3f4f6;
}

.btn-pagination:disabled {
  color: #9ca3af;
  cursor: not-allowed;
}

.page-indicator {
  font-size: 0.875rem;
  color: #6b7280;
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .data-table-wrapper {
    border-radius: 0.625rem;
  }

  .table-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 12px 14px;
  }

  .table-subtitle {
    margin-left: 0;
    font-size: 0.8rem;
  }

  .data-table th,
  .data-table td {
    padding: 10px 12px;
    font-size: 0.8125rem;
  }

  .data-table th {
    font-size: 0.7rem;
  }

  .table-footer {
    flex-direction: column;
    gap: 0.625rem;
    align-items: stretch;
    padding: 12px 14px;
  }

  .pagination-info {
    text-align: center;
    font-size: 0.8rem;
  }

  .pagination-controls {
    justify-content: space-between;
    gap: 0.5rem;
  }

  .btn-pagination {
    flex: 1;
    text-align: center;
  }
}

@media (max-width: 480px) {
  .data-table th,
  .data-table td {
    padding: 8px 10px;
    font-size: 0.75rem;
  }

  .table-title {
    font-size: 1rem;
  }

  .pagination-controls {
    flex-wrap: wrap;
    justify-content: center;
  }

  .page-indicator {
    width: 100%;
    text-align: center;
    order: -1;
  }
}
</style>
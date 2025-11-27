import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import apiService from '@/services/api';

export const useFarmsStore = defineStore('farms', () => {
    const farms = ref([]);
    const loading = ref(false);
    const error = ref(null);
    const selectedFarmId = ref(null);

    const selectedFarm = computed(() =>
        farms.value.find(farm => (farm._id || farm.id) === selectedFarmId.value) || null
    );

    async function fetchFarms() {
        loading.value = true;
        error.value = null;
        try {
            const response = await apiService.getFarms();
            farms.value = response.data || [];

            if (!selectedFarmId.value && farms.value.length > 0) {
                selectedFarmId.value = farms.value[0]._id || farms.value[0].id;
            }

            return farms.value;
        } catch (err) {
            error.value = err.message || 'Failed to load farms';
            farms.value = [];
            throw err;
        } finally {
            loading.value = false;
        }
    }

    function selectFarm(farmId) {
        selectedFarmId.value = farmId;
    }

    function upsertFarm(farm) {
        const id = farm._id || farm.id;
        const index = farms.value.findIndex(existing => (existing._id || existing.id) === id);
        if (index !== -1) {
            farms.value[index] = { ...farms.value[index], ...farm };
        } else {
            farms.value.push(farm);
        }

        if (!selectedFarmId.value) {
            selectedFarmId.value = id;
        }
    }

    function removeFarm(farmId) {
        farms.value = farms.value.filter(farm => (farm._id || farm.id) !== farmId);
        if (selectedFarmId.value === farmId) {
            selectedFarmId.value = farms.value[0]?._id || farms.value[0]?.id || null;
        }
    }

    function $reset() {
        farms.value = [];
        loading.value = false;
        error.value = null;
        selectedFarmId.value = null;
    }

    return {
        farms,
        loading,
        error,
        selectedFarmId,
        selectedFarm,
        fetchFarms,
        selectFarm,
        upsertFarm,
        removeFarm,
        $reset
    };
});


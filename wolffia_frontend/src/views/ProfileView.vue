<template>
    <div class="profile-view">
        <h1>Profile</h1>
        <div v-if="user" class="profile-card">
            <div class="profile-info">
                <div class="info-item">
                    <span class="label">Name:</span>
                    <span class="value">{{ user.user_name }}</span>
                </div>
                <div class="info-item">
                    <span class="label">Email:</span>
                    <span class="value">{{ user.email }}</span>
                </div>
                <div class="info-item">
                    <span class="label">Role:</span>
                    <span class="value">{{ user.role }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import apiService from '@/services/api';

export default {
    name: 'ProfileView',
    setup() {
        const user = ref(null);

        const fetchUser = async () => {
            try {
                const response = await apiService.getCurrentUser();
                user.value = response.data.user;
            } catch (error) {
                console.error('Failed to fetch user:', error);
            }
        };

        onMounted(() => {
            fetchUser();
        });

        return {
            user
        };
    }
};
</script>
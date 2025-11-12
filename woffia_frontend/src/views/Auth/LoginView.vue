<template>
    <div class="login-view">
        <form @submit.prevent="handleLogin" class="login-form">
            <h2>Sign In</h2>

            <div class="form-group">
                <label for="email">Email</label>
                <input id="email" v-model="form.email" type="email" required placeholder="Enter your email" />
            </div>

            <div class="form-group">
                <label for="password">Password</label>
                <input id="password" v-model="form.password" type="password" required
                    placeholder="Enter your password" />
            </div>

            <button type="submit" :disabled="loading" class="btn-primary">
                <span v-if="loading">Signing in...</span>
                <span v-else>Sign In</span>
            </button>

            <p class="form-footer">
                Don't have an account?
                <router-link to="/register">Sign up</router-link>
            </p>
        </form>
    </div>
</template>

<script>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import apiService from '@/services/api';

export default {
    name: 'LoginView',
    setup() {
        const router = useRouter();
        const form = ref({
            email: '',
            password: ''
        });
        const loading = ref(false);

        const handleLogin = async () => {
            loading.value = true;
            try {
                const response = await apiService.login(form.value);
                if (response.data.token) {
                    localStorage.setItem('auth_token', response.data.token);
                    localStorage.setItem('user_name', response.data.user?.user_name || 'User');
                    router.push('/dashboard');
                }
            } catch (error) {
                alert(error.response?.data?.message || 'Login failed. Please check your credentials.');
            } finally {
                loading.value = false;
            }
        };

        return { form, loading, handleLogin };
    }
};
</script>

<style scoped>
.login-view {
    display: flex;
    justify-content: center;
    align-items: center;
    /*
    min-height: 100vh;
    background: #f5f5f5;
    */
}

.login-form {
    background: white;
    padding: 2rem;
    border-radius: 1rem;
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 400px;
}

h2 {
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
    text-align: center;
}

.form-group {
    margin-bottom: 1.5rem;
}

label {
    display: block;
    font-weight: bold;
    margin-bottom: 0.5rem;
}

input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 0.5rem;
}

button {
    width: 100%;
    padding: 0.75rem;
    background-color: #10b981;
    color: white;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background-color 0.3s;
}

button:disabled {
    background-color: #e0e0e0;
}

button:hover:not(:disabled) {
    background-color: #059669;
}

.form-footer {
    text-align: center;
    margin-top: 1rem;
}

.form-footer a {
    color: #10b981;
}
</style>

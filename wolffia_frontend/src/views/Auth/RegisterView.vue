<template>
    <div class="register-view">
        <form @submit.prevent="handleRegister" class="register-form">
            <h2>Sign Up</h2>

            <div class="form-group">
                <label for="email">Email</label>
                <input id="email" v-model="form.email" type="email" required placeholder="Enter your email" />
            </div>

            <div class="form-group">
                <label for="password">Password</label>
                <input id="password" v-model="form.password" type="password" required
                    placeholder="Enter your password" />
            </div>

            <div class="form-group">
                <label for="confirmPassword">Confirm Password</label>
                <input id="confirmPassword" v-model="form.confirmPassword" type="password" required
                    placeholder="Confirm your password" />
            </div>

            <button type="submit" :disabled="loading" class="btn-primary">
                <span v-if="loading">Registering...</span>
                <span v-else>Sign Up</span>
            </button>

            <p class="form-footer">
                Already have an account?
                <router-link to="/login">Sign in</router-link>
            </p>
        </form>
    </div>
</template>

<script>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import apiService from '@/services/api';

export default {
    name: 'RegisterView',
    setup() {
        const router = useRouter();
        const form = ref({
            email: '',
            password: '',
            confirmPassword: ''
        });
        const loading = ref(false);

        const handleRegister = async () => {
            if (form.value.password !== form.value.confirmPassword) {
                alert('Passwords do not match');
                return;
            }

            if (form.value.password.length < 6) {
                alert('Password must be at least 6 characters');
                return;
            }

            loading.value = true;
            try {
                await apiService.register({
                    email: form.value.email,
                    password: form.value.password,
                    user_name: form.value.email.split('@')[0] // Use email prefix as default name
                });
                alert('Registration successful! Please login.');
                router.push('/login');
            } catch (error) {
                alert(error.response?.data?.message || 'Registration failed. Please try again.');
            } finally {
                loading.value = false;
            }
        };

        return { form, loading, handleRegister };
    }
};
</script>

<style scoped>
.register-view {
    display: flex;
    justify-content: center;
    align-items: center;
    /*
    min-height: 100vh;
    background: #f5f5f5;
    */
}

.register-form {
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

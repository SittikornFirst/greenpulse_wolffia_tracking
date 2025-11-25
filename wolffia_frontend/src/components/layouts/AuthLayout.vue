<template>
    <div class="auth-layout">
        <div class="auth-container">
            <div class="auth-brand">
                <Leaf :size="48" class="brand-icon" />
                <h1>Wolffia Monitoring</h1>
                <p>IoT Water Quality Management System</p>
            </div>
            <slot />
        </div>
    </div>
</template>

<script>
import { Leaf } from 'lucide-vue-next';

export default {
    name: 'AuthLayout',
    components: { Leaf }
};
</script>

<style scoped>
.auth-layout {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 2rem;
}

.auth-container {
    background: white;
    border-radius: 1rem;
    padding: 3rem;
    max-width: 450px;
    width: 100%;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.auth-brand {
    text-align: center;
    margin-bottom: 2rem;
}

.brand-icon {
    color: #10b981;
    margin-bottom: 1rem;
}

.auth-brand h1 {
    font-size: 1.875rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 0.5rem 0;
}

.auth-brand p {
    color: #6b7280;
    font-size: 0.875rem;
    margin: 0;
}
</style>
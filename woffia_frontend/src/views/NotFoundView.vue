<template>
    <div class="not-found-view">
        <div class="not-found-content">
            <div class="not-found-icon">
                <AlertCircle :size="80" />
            </div>
            <h1>404</h1>
            <h2>Page Not Found</h2>
            <p>The page you're looking for doesn't exist or has been moved.</p>
            <div class="not-found-actions">
                <button @click="$router.push('/dashboard')" class="btn btn-primary">
                    <Home :size="20" />
                    <span>Go to Dashboard</span>
                </button>
                <button @click="$router.back()" class="btn btn-secondary">
                    <ArrowLeft :size="20" />
                    <span>Go Back</span>
                </button>
            </div>
        </div>
    </div>
</template>

<script>
import { Home, ArrowLeft, AlertCircle } from 'lucide-vue-next';

export default {
    name: 'NotFoundView',
    components: {
        Home,
        ArrowLeft,
        AlertCircle
    }
};
</script>

<style scoped>
.not-found-view {
    min-height: calc(100vh - 200px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: #f9fafb;
}

.not-found-content {
    text-align: center;
    max-width: 500px;
    background: white;
    padding: 3rem;
    border-radius: 0.75rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.not-found-icon {
    color: #ef4444;
    margin-bottom: 1.5rem;
    display: flex;
    justify-content: center;
}

.not-found-content h1 {
    font-size: 4rem;
    font-weight: 700;
    color: #1f2937;
    margin: 0 0 0.5rem 0;
    line-height: 1;
}

.not-found-content h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #374151;
    margin: 0 0 1rem 0;
}

.not-found-content p {
    font-size: 1rem;
    color: #6b7280;
    margin: 0 0 2rem 0;
    line-height: 1.6;
}

.not-found-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
}

.btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
}

.btn-primary {
    background: #10b981;
    color: white;
}

.btn-primary:hover {
    background: #059669;
}

.btn-secondary {
    background: #f3f4f6;
    color: #374151;
}

.btn-secondary:hover {
    background: #e5e7eb;
}

@media (max-width: 768px) {
    .not-found-content {
        padding: 2rem 1.5rem;
    }

    .not-found-content h1 {
        font-size: 3rem;
    }

    .not-found-actions {
        flex-direction: column;
    }

    .btn {
        width: 100%;
        justify-content: center;
    }
}
</style>

// main.js
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';

// Import global styles
import './assets/styles/main.css';

// Create Vue app
const app = createApp(App);

// Create Pinia store
const pinia = createPinia();

// Use plugins
app.use(pinia);
app.use(router);

// Global error handler
app.config.errorHandler = (err, instance, info) => {
    console.error('Global error:', err);
    console.error('Error info:', info);

    // You can send errors to a logging service here
    // logErrorToService(err, info);
};

// Mount app
app.mount('#app');

// Service Worker for PWA (optional)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered:', registration);
            })
            .catch(error => {
                console.log('SW registration failed:', error);
            });
    });
}
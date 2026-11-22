import '@fontsource-variable/inter'
import '@fontsource-variable/fredoka'
import './styles/tokens.css'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'

createApp(App).use(createPinia()).mount('#app')

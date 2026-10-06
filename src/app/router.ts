import { createRouter, createWebHistory } from '@ionic/vue-router'
import HomePage from '@/views/HomePage.vue'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: HomePage },
    { path: '/data', component: () => import('@/views/DataPage.vue') },
    { path: '/lists/:id', component: () => import('@/views/ListPage.vue'), props: true },
    { path: '/lists/:id/fields', component: () => import('@/views/ListFieldsPage.vue'), props: true },
  ],
})

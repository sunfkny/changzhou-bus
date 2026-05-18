import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('../views/HomePage.vue') },
    {
      path: '/map/:lineId/:lineType',
      name: 'map',
      component: () => import('../views/MapPage.vue'),
      props: true
    }
  ]
})

export default router

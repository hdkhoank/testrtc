import Vue from 'vue'
import VueRouter, { RouteConfig } from 'vue-router'
import Home from '../views/Home.vue'

Vue.use(VueRouter)

const routes: Array<RouteConfig> = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/about',
    name: 'About',
    component: () => import(/* webpackChunkName: "about" */ '../views/About.vue')
  },
  {
    path: '/teacher',
    name: 'Host',
    component: () => import(/* webpackChunkName: "about" */ '../components/Host.vue')
  },
  {
    path: '/student',
    name: 'Viewer',
    component: () => import(/* webpackChunkName: "about" */ '../components/Viewer.vue')
  },
  {
    path: '/relay',
    name: 'Relay',
    component: () => import(/* webpackChunkName: "about" */ '../components/Relay.vue')
  },
  {
    path: '/relays',
    name: 'Relays',
    component: () => import(/* webpackChunkName: "about" */ '../components/Relays.vue')
  },
  {
    path: '/mrelays',
    name: 'Relays',
    component: () => import(/* webpackChunkName: "about" */ '../components/MRelays.vue')
  },
]

const router = new VueRouter({
  routes
})

export default router

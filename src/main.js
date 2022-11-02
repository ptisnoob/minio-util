import Vue from 'vue'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import App from './App.vue'
import store from './store'

import '@/icons'
import minio from '@/plugins/minio'
import Contextmenu from 'vue-contextmenujs'
Vue.use(Contextmenu)

Vue.use(ElementUI)

Vue.config.productionTip = false
Vue.prototype.$minio = minio

new Vue({
  el: '#app',
  store,
  render: (h) => h(App)
})

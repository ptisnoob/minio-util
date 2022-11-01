
import Vue from 'vue'
//引入svg组件 
import SvgIcon from '@/components/svg-icon' 
//全局注册
Vue.component('svg-icon', SvgIcon) 


const requireAll = requireContext => requireContext.keys().map(requireContext)
const req = require.context('./svg',false,/(\.svg$|\.js$)/)
requireAll(req)

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { IonicVue } from '@ionic/vue'

import '@ionic/vue/css/core.css'
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'
import '@ionic/vue/css/typography.css'
import '@ionic/vue/css/palettes/dark.system.css'
import './theme/variables.css'
import './theme/global.css'

import App from './App.vue'
import { router } from './app/router'
import { bootstrap } from './app/bootstrap'

const app = createApp(App).use(IonicVue).use(createPinia()).use(router)

bootstrap()
  .then(() => router.isReady())
  .then(() => app.mount('#app'))
  .catch((e) => {
    console.error(e)
    document.body.innerHTML = '<p style="padding:24px;font-family:system-ui">No pudimos abrir tus datos 😕</p>'
  })

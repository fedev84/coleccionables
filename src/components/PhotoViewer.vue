<script setup lang="ts">
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonTitle, IonToolbar } from '@ionic/vue'
import { chevronBack, chevronForward, close } from 'ionicons/icons'
import { nextTick, ref } from 'vue'
import { t } from '@/copy/es'

/** Fotos a pantalla completa; con varias, se pasan deslizando, con las flechas o con ← →. */
const props = defineProps<{ open: boolean; photos: string[]; start?: number; title?: string }>()
const emit = defineEmits<{ close: [] }>()

const strip = ref<HTMLElement>()
const current = ref(0)

async function onPresent() {
  current.value = props.start ?? 0
  await nextTick()
  strip.value?.scrollTo({ left: current.value * strip.value.clientWidth })
}

/** Flechas además del deslizar: con el mouse no se puede deslizar, y en el teléfono avisan que hay más. */
function go(step: number) {
  const el = strip.value
  if (!el) return
  const to = Math.max(0, Math.min(props.photos.length - 1, current.value + step))
  el.scrollTo({ left: to * el.clientWidth, behavior: 'smooth' })
}

function onScroll() {
  const el = strip.value
  if (el?.clientWidth) current.value = Math.round(el.scrollLeft / el.clientWidth)
}
</script>

<template>
  <ion-modal :is-open="open" @will-present="onPresent" @did-dismiss="emit('close')" @keydown.left="go(-1)" @keydown.right="go(1)">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ title }}</ion-title>
        <ion-buttons slot="end">
          <ion-button :aria-label="t.common.close" @click="emit('close')"><ion-icon slot="icon-only" :icon="close" /></ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="viewer" :scroll-y="false">
      <div ref="strip" class="strip" @scroll.passive="onScroll">
        <img v-for="(src, n) in photos" :key="n" :src="src" alt="" />
      </div>
      <template v-if="photos.length > 1">
        <button v-if="current > 0" type="button" class="nav prev" :aria-label="t.photo.prev" @click="go(-1)"><ion-icon :icon="chevronBack" /></button>
        <button v-if="current < photos.length - 1" type="button" class="nav next" :aria-label="t.photo.next" @click="go(1)"><ion-icon :icon="chevronForward" /></button>
      </template>
      <span v-if="photos.length > 1" class="count">{{ t.photo.count(current + 1, photos.length) }}</span>
    </ion-content>
  </ion-modal>
</template>

<style scoped>
.viewer { --background: #000; }
.strip {
  display: flex;
  height: 100%;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
}
.strip::-webkit-scrollbar { display: none; }
img { flex: 0 0 100%; width: 100%; height: 100%; object-fit: contain; display: block; scroll-snap-align: center; }
.nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgb(0 0 0 / 50%);
  color: #fff;
  font-size: 24px;
}
.prev { left: 8px; }
.next { right: 8px; }
.count {
  position: absolute;
  bottom: calc(16px + var(--ion-safe-area-bottom, 0px));
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 12px;
  border-radius: 999px;
  background: rgb(0 0 0 / 60%);
  color: #fff;
  font-size: 14px;
}
</style>

<script setup lang="ts">
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonTitle, IonToolbar } from '@ionic/vue'
import { close } from 'ionicons/icons'
import { t } from '@/copy/es'

defineProps<{ open: boolean; src: string | null; title?: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <ion-modal :is-open="open" @did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ title }}</ion-title>
        <ion-buttons slot="end">
          <ion-button :aria-label="t.common.close" @click="emit('close')"><ion-icon slot="icon-only" :icon="close" /></ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="viewer">
      <img v-if="src" :src="src" alt="" />
    </ion-content>
  </ion-modal>
</template>

<style scoped>
.viewer { --background: #000; }
img { width: 100%; height: 100%; object-fit: contain; display: block; }
</style>

<script setup lang="ts">
import {
  IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonPage,
  IonSpinner, IonTitle, IonToolbar, alertController,
} from '@ionic/vue'
import { cloudDownloadOutline, cloudUploadOutline, documentTextOutline, imagesOutline } from 'ionicons/icons'
import { ref } from 'vue'
import { services } from '@/app/container'
import { BackupError } from '@/domain/backup'
import { pickTextFile, shareTextFile } from '@/platform/files'
import { toast } from '@/platform/toast'
import { useItemsStore } from '@/stores/items'
import { useListsStore } from '@/stores/lists'
import { t } from '@/copy/es'

type Action = 'full' | 'light' | 'csv' | 'import'
const busy = ref<Action | null>(null)

async function run(kind: Action, fn: () => Promise<void>) {
  if (busy.value) return
  busy.value = kind
  try {
    await fn()
  } catch (e) {
    console.error(e)
    toast(e instanceof BackupError ? e.message : t.data.error)
  } finally {
    busy.value = null
  }
}

const today = () => new Date().toISOString().slice(0, 10)

const exportJson = (withPhotos: boolean) =>
  run(withPhotos ? 'full' : 'light', async () => {
    const name = `coleccion-${withPhotos ? '' : 'sin-fotos-'}${today()}.json`
    await shareTextFile(name, await services().backup.exportJson(withPhotos), 'application/json', t.data.shareDialog)
  })

const exportCsv = () =>
  run('csv', async () => {
    await shareTextFile(`coleccion-${today()}.csv`, await services().backup.exportCsv(), 'text/csv', t.data.shareDialog)
  })

const importBackup = () =>
  run('import', async () => {
    const text = await pickTextFile()
    if (text === null) return
    const plan = await services().backup.previewImport(text)
    if (!plan.lists.length && !plan.items.length) return toast(t.data.nothing)

    const alert = await alertController.create({
      header: t.data.confirmTitle,
      message: t.data.summary(plan.summary),
      cssClass: 'pre-line',
      buttons: [{ text: t.common.cancel, role: 'cancel' }, { text: t.data.confirm, role: 'confirm' }],
    })
    await alert.present()
    if ((await alert.onDidDismiss()).role !== 'confirm') return

    await services().backup.applyImport(plan)
    useItemsStore().reset()
    await useListsStore().load()
    toast(t.data.imported)
  })
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button default-href="/" text="" /></ion-buttons>
        <ion-title>{{ t.data.title }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-list>
        <ion-list-header>{{ t.data.exportTitle }}</ion-list-header>
        <ion-item button :detail="false" :disabled="!!busy" @click="exportJson(true)">
          <ion-icon slot="start" :icon="imagesOutline" />
          <ion-label><h2>{{ t.data.full.title }}</h2><p>{{ t.data.full.body }}</p></ion-label>
          <ion-spinner v-if="busy === 'full'" slot="end" />
        </ion-item>
        <ion-item button :detail="false" :disabled="!!busy" @click="exportJson(false)">
          <ion-icon slot="start" :icon="cloudDownloadOutline" />
          <ion-label><h2>{{ t.data.light.title }}</h2><p>{{ t.data.light.body }}</p></ion-label>
          <ion-spinner v-if="busy === 'light'" slot="end" />
        </ion-item>
        <ion-item button :detail="false" :disabled="!!busy" @click="exportCsv">
          <ion-icon slot="start" :icon="documentTextOutline" />
          <ion-label><h2>{{ t.data.csv.title }}</h2><p>{{ t.data.csv.body }}</p></ion-label>
          <ion-spinner v-if="busy === 'csv'" slot="end" />
        </ion-item>

        <ion-list-header>{{ t.data.importTitle }}</ion-list-header>
        <ion-item button :detail="false" :disabled="!!busy" @click="importBackup">
          <ion-icon slot="start" :icon="cloudUploadOutline" />
          <ion-label><h2>{{ t.data.import.title }}</h2><p>{{ t.data.import.body }}</p></ion-label>
          <ion-spinner v-if="busy === 'import'" slot="end" />
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<style scoped>
ion-label h2 { font-weight: 600; }
ion-label p { white-space: normal; }
</style>

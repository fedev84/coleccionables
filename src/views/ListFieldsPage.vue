<script setup lang="ts">
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonListHeader,
  IonNote, IonPage, IonReorder, IonReorderGroup, IonTitle, IonToggle, IonToolbar, actionSheetController, alertController,
  type ReorderEndCustomEvent,
} from '@ionic/vue'
import { add } from 'ionicons/icons'
import { computed } from 'vue'
import {
  BUILTIN_FIELDS, DEFAULT_LABELS, isShown, labelOf, moveCustom, newCustomField,
  type BuiltinField, type CustomField, type CustomFieldType, type FieldConfig,
} from '@/domain/fields'
import { useListsStore } from '@/stores/lists'
import { t } from '@/copy/es'

const props = defineProps<{ id: string }>()
const lists = useListsStore()
const list = computed(() => lists.byId(props.id))
const cfg = computed(() => list.value!.fields)

const save = (patch: Partial<FieldConfig>) => lists.update(props.id, { fields: { ...cfg.value, ...patch } })

function toggle(f: BuiltinField, on: boolean) {
  const hidden = cfg.value.hidden.filter((h) => h !== f)
  save({ hidden: on ? hidden : [...hidden, f] })
}

/** Pide un nombre. Devuelve null si cancela; '' si lo dejó vacío. */
async function askLabel(header: string, value: string, placeholder = ''): Promise<string | null> {
  const alert = await alertController.create({
    header,
    inputs: [{ name: 'label', value, placeholder, attributes: { autocapitalize: 'sentences', maxlength: 30 } }],
    buttons: [{ text: t.common.cancel, role: 'cancel' }, { text: t.common.save, role: 'confirm' }],
  })
  await alert.present()
  const { role, data } = await alert.onDidDismiss()
  return role === 'confirm' ? String(data?.values?.label ?? '').trim() : null
}

async function rename(f: BuiltinField) {
  const label = await askLabel(t.fields.rename, cfg.value.labels[f] ?? '', DEFAULT_LABELS[f])
  if (label === null) return
  // Vacío o igual al original = volver al nombre de fábrica.
  const { [f]: _old, ...labels } = cfg.value.labels
  save({ labels: label && label !== DEFAULT_LABELS[f] ? { ...labels, [f]: label } : labels })
}

async function addCustom() {
  const label = await askLabel(t.fields.addTitle, '', t.fields.labelPh)
  if (!label) return
  const sheet = await actionSheetController.create({
    header: label,
    buttons: [
      ...(['text', 'number'] as CustomFieldType[]).map((type) => ({
        text: t.fields.type[type],
        handler: () => { save({ custom: [...cfg.value.custom, newCustomField(label, type)] }) },
      })),
      { text: t.common.cancel, role: 'cancel' },
    ],
  })
  await sheet.present()
}

function onReorder(e: ReorderEndCustomEvent) {
  const custom = moveCustom(cfg.value.custom, e.detail.from, e.detail.to)
  e.detail.complete(false) // el orden lo dibuja Vue desde el store
  save({ custom })
}

async function customMenu(f: CustomField) {
  const sheet = await actionSheetController.create({
    header: f.label,
    buttons: [
      { text: t.fields.rename, handler: () => { renameCustom(f) } },
      { text: t.fields.remove, role: 'destructive', handler: () => { removeCustom(f) } },
      { text: t.common.cancel, role: 'cancel' },
    ],
  })
  await sheet.present()
}

async function renameCustom(f: CustomField) {
  const label = await askLabel(t.fields.rename, f.label)
  if (!label) return
  save({ custom: cfg.value.custom.map((c) => (c.id === f.id ? { ...c, label } : c)) })
}

async function removeCustom(f: CustomField) {
  const sheet = await actionSheetController.create({
    header: t.fields.confirmRemove(f.label),
    buttons: [
      { text: t.fields.remove, role: 'destructive', handler: () => { save({ custom: cfg.value.custom.filter((c) => c.id !== f.id) }) } },
      { text: t.common.cancel, role: 'cancel' },
    ],
  })
  await sheet.present()
}
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button :default-href="`/lists/${id}`" text="" /></ion-buttons>
        <ion-title>{{ t.fields.title }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content v-if="list">
      <p class="intro muted">{{ t.fields.intro }}</p>
      <ion-list>
        <ion-list-header>{{ t.fields.builtin }}</ion-list-header>
        <ion-item v-for="f in BUILTIN_FIELDS" :key="f">
          <ion-label class="pressable" @click="rename(f)">
            <h2>{{ labelOf(cfg, f) }}</h2>
            <p>{{ cfg.labels[f] ? t.fields.renameHint(DEFAULT_LABELS[f]) : t.fields.rename }}</p>
          </ion-label>
          <ion-toggle
            slot="end"
            :checked="isShown(cfg, f)"
            :aria-label="labelOf(cfg, f)"
            @ion-change="toggle(f, $event.detail.checked)"
          />
        </ion-item>

        <ion-list-header>{{ t.fields.custom }}</ion-list-header>
        <ion-reorder-group :disabled="cfg.custom.length < 2" @ion-reorder-end="onReorder">
          <ion-item v-for="f in cfg.custom" :key="f.id" button :detail="false" @click="customMenu(f)">
            <ion-label>{{ f.label }}</ion-label>
            <ion-note slot="end">{{ t.fields.type[f.type] }}</ion-note>
            <ion-reorder v-if="cfg.custom.length > 1" slot="end" />
          </ion-item>
        </ion-reorder-group>
        <ion-item v-if="cfg.custom.length > 1" lines="none">
          <ion-label class="muted ion-text-wrap hint">{{ t.fields.reorderHint }}</ion-label>
        </ion-item>
        <ion-item v-if="!cfg.custom.length" lines="none">
          <ion-label class="muted ion-text-wrap">{{ t.fields.customEmpty }}</ion-label>
        </ion-item>
      </ion-list>
      <div class="add">
        <ion-button fill="outline" expand="block" @click="addCustom">
          <ion-icon slot="start" :icon="add" />{{ t.fields.add }}
        </ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<style scoped>
.intro { margin: 16px 16px 4px; font-size: 14px; line-height: 1.4; }
ion-label h2 { font-weight: 600; }
.pressable { cursor: pointer; }
ion-label.hint { font-size: 13px; }
.add { padding: 8px 16px 32px; }
</style>

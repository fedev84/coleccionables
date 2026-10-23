<script setup lang="ts">
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonLabel, IonList,
  IonPage, IonSearchbar, IonSegment, IonSegmentButton, IonTitle, IonToolbar, actionSheetController, alertController,
  useBackButton, useIonRouter,
} from '@ionic/vue'
import { add, close, ellipsisVertical, swapVerticalOutline } from 'ionicons/icons'
import { computed, reactive, ref, watchEffect } from 'vue'
import { services } from '@/app/container'
import type { Collection, Id, Item, ItemStatus } from '@/domain/models'
import { applyView, defaultDir, resolveView, sortFields, type SortField, type StatusFilter } from '@/domain/query'
import { shareText as buildShareText } from '@/domain/shareText'
import { defaultFields } from '@/domain/fields'
import { dirName, sortName } from '@/composables/fieldLabels'
import { shareText } from '@/platform/share'
import { shareImages } from '@/platform/files'
import { renderListImages } from '@/platform/listImage'
import { toast } from '@/platform/toast'
import { useItemActions } from '@/composables/itemActions'
import { useItemsStore } from '@/stores/items'
import { useListsStore } from '@/stores/lists'
import { useViewsStore } from '@/stores/views'
import { t } from '@/copy/es'
import EmptyState from '@/components/EmptyState.vue'
import ItemFormSheet from '@/components/ItemFormSheet.vue'
import ItemRow from '@/components/ItemRow.vue'
import ListFormSheet from '@/components/ListFormSheet.vue'
import PhotoViewer from '@/components/PhotoViewer.vue'

const props = defineProps<{ id: string }>()
const lists = useListsStore()
const items = useItemsStore()
const views = useViewsStore()
const router = useIonRouter()
const { toggle, remove } = useItemActions()

const list = computed(() => lists.byId(props.id))
const all = computed(() => items.byList[props.id] ?? [])
const fields = computed(() => list.value?.fields ?? defaultFields())
// Si el orden guardado era por un campo que ya no está, se ordena por nombre.
const view = computed(() => resolveView(views.get(props.id), fields.value))
const search = ref('')
const rows = computed(() => applyView(all.value, view.value, search.value, fields.value))
const filtered = computed(() => rows.value.length !== all.value.length)
const sortLabel = computed(() => `${sortName(view.value.sort, fields.value)} (${dirName(view.value.sort, fields.value, view.value.dir)})`)

const itemSheet = reactive({ open: false, item: null as Item | null })
const listSheet = ref(false)
const viewer = reactive({ open: false, src: null as string | null, title: '' })

// ---------- Elegir varios y moverlos a otra lista ----------
const selecting = ref(false)
const selected = ref(new Set<Id>())
const allShownSelected = computed(() => rows.value.length > 0 && rows.value.every((i) => selected.value.has(i.id)))

function startSelecting(item?: Item) {
  selecting.value = true
  selected.value = new Set(item ? [item.id] : [])
  if (!item) toast(t.select.hint)
}

function stopSelecting() {
  selecting.value = false
  selected.value = new Set()
}

function toggleSelected(item: Item) {
  if (!selecting.value) return startSelecting(item)
  const next = new Set(selected.value)
  if (!next.delete(item.id)) next.add(item.id)
  selected.value = next
}

const toggleAll = () => { selected.value = allShownSelected.value ? new Set() : new Set(rows.value.map((i) => i.id)) }

// El botón "atrás" de Android sale del modo elegir en vez de salir de la lista.
useBackButton(10, (next) => (selecting.value ? stopSelecting() : next()))

async function moveMenu() {
  const from = list.value
  const moving = all.value.filter((i) => selected.value.has(i.id))
  if (!from || !moving.length) return
  const sheet = await actionSheetController.create({
    header: t.select.moveTo(moving.length),
    buttons: [
      ...lists.lists.filter((l) => l.id !== from.id).map((l) => ({
        text: `${l.emoji} ${l.name}`,
        handler: () => { moveTo(moving, from, l) },
      })),
      { text: t.select.newList, handler: () => { moveToNewList(moving, from) } },
      { text: t.common.cancel, role: 'cancel' },
    ],
  })
  await sheet.present()
}

/** Lista nueva con el mismo ícono y los mismos campos que esta: lo típico es partir una lista en dos. */
async function moveToNewList(moving: Item[], from: Collection) {
  const alert = await alertController.create({
    header: t.select.newListTitle,
    inputs: [{ name: 'name', placeholder: t.listForm.namePh, attributes: { autocapitalize: 'sentences', maxlength: 40 } }],
    buttons: [{ text: t.common.cancel, role: 'cancel' }, { text: t.select.move, role: 'confirm' }],
  })
  await alert.present()
  const { role, data } = await alert.onDidDismiss()
  const name = String(data?.values?.name ?? '').trim()
  if (role !== 'confirm' || !name) return
  try {
    const created = await lists.create({ name, emoji: from.emoji })
    await lists.update(created.id, { fields: from.fields })
    await moveTo(moving, from, { ...created, fields: from.fields })
  } catch (e) {
    console.error(e)
    toast(t.select.error)
  }
}

async function moveTo(moving: Item[], from: Collection, to: Collection) {
  try {
    const snapshot = await items.move(moving, from, to)
    stopSelecting()
    toast(t.select.moved(snapshot.items.length, `${to.emoji} ${to.name}`), () => items.undoMove(snapshot))
  } catch (e) {
    console.error(e)
    toast(t.select.error)
  }
}

watchEffect(() => {
  items.load(props.id)
  views.load(props.id)
})

function openItem(item: Item | null) {
  itemSheet.item = item
  itemSheet.open = true
}

async function showPhoto(item: Item) {
  viewer.src = await services().items.photo(item.id)
  viewer.title = item.name
  viewer.open = !!viewer.src
}

const setStatus = (status: StatusFilter) => views.set(props.id, { status })

/** Elegir el orden actual lo invierte; uno nuevo arranca en su sentido natural. */
async function sortMenu() {
  const current = view.value
  const pick = (sort: SortField) => views.set(props.id, { sort, dir: sort === current.sort ? (current.dir === 'asc' ? 'desc' : 'asc') : defaultDir(sort) })
  const sheet = await actionSheetController.create({
    header: t.list.sortTitle,
    buttons: [
      ...sortFields(fields.value).map((f) => ({
        text: f === current.sort ? `✓ ${sortName(f, fields.value)} (${dirName(f, fields.value, current.dir)})` : sortName(f, fields.value),
        handler: () => { pick(f) },
      })),
      { text: t.list.flip, handler: () => { views.set(props.id, { dir: current.dir === 'asc' ? 'desc' : 'asc' }) } },
      { text: t.common.cancel, role: 'cancel' },
    ],
  })
  await sheet.present()
}

async function listMenu() {
  const l = list.value
  if (!l) return
  const sheet = await actionSheetController.create({
    header: `${l.emoji} ${l.name}`,
    buttons: [
      { text: t.list.shareWant, handler: () => { share('want') } },
      { text: t.list.shareHave, handler: () => { share('have') } },
      ...(all.value.length ? [{ text: t.select.menu, handler: () => { startSelecting() } }] : []),
      { text: t.list.edit, handler: () => { listSheet.value = true } },
      { text: t.list.fields, handler: () => { router.push(`/lists/${l.id}/fields`) } },
      { text: t.list.delete, role: 'destructive', handler: () => { confirmDelete() } },
      { text: t.common.cancel, role: 'cancel' },
    ],
  })
  await sheet.present()
}

/** Texto o imagen, siempre en el orden en que se ve la lista. */
async function share(status: 'want' | 'have') {
  const l = list.value
  if (!l) return
  const ordered = applyView(all.value, { ...view.value, status: 'all' }, '', fields.value)
  if (!ordered.some((i) => i.status === status)) return toast(t.list.shareEmpty)
  const sheet = await actionSheetController.create({
    header: status === 'want' ? t.list.shareWant : t.list.shareHave,
    buttons: [
      { text: t.list.asText, handler: () => { run(() => shareAsText(l, ordered, status)) } },
      { text: t.list.asImage, handler: () => { run(() => shareAsImage(l, ordered, status)) } },
      { text: t.common.cancel, role: 'cancel' },
    ],
  })
  await sheet.present()
}

async function run(task: () => Promise<void>) {
  try {
    await task()
  } catch (e) {
    console.error(e)
    toast(t.list.shareError)
  }
}

async function shareAsText(l: Collection, ordered: Item[], status: ItemStatus) {
  if ((await shareText(buildShareText(l, ordered, status), t.list.shareDialog)) === 'copied') toast(t.list.copied)
}

async function shareAsImage(l: Collection, ordered: Item[], status: ItemStatus) {
  const images = await renderListImages(l, ordered, status)
  const base = `${slug(l.name)}-${status === 'want' ? 'me-falta' : 'tengo'}`
  await shareImages(images.map((_, n) => (images.length > 1 ? `${base}-${n + 1}.jpg` : `${base}.jpg`)), images, t.list.shareDialog)
}

const slug = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lista'

async function confirmDelete() {
  const l = list.value
  if (!l) return
  const sheet = await actionSheetController.create({
    header: t.list.confirmDelete(l.name),
    buttons: [
      { text: t.common.delete, role: 'destructive', handler: async () => { await lists.remove(l.id); router.back() } },
      { text: t.common.cancel, role: 'cancel' },
    ],
  })
  await sheet.present()
}
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar v-if="selecting">
        <ion-buttons slot="start">
          <ion-button :aria-label="t.common.close" @click="stopSelecting"><ion-icon slot="icon-only" :icon="close" /></ion-button>
        </ion-buttons>
        <ion-title>{{ t.select.title(selected.size) }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="toggleAll">{{ allShownSelected ? t.select.none : t.select.all }}</ion-button>
          <ion-button strong :disabled="!selected.size" @click="moveMenu">{{ t.select.move }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar v-else>
        <ion-buttons slot="start"><ion-back-button default-href="/" text="" /></ion-buttons>
        <ion-title v-if="list">{{ list.emoji }} {{ list.name }}</ion-title>
        <ion-buttons slot="end">
          <ion-button aria-label="Opciones" @click="listMenu"><ion-icon slot="icon-only" :icon="ellipsisVertical" /></ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar v-if="all.length">
        <ion-searchbar v-model="search" :placeholder="t.list.search" :debounce="150" />
      </ion-toolbar>
    </ion-header>

    <ion-content v-if="list">
      <template v-if="all.length">
        <ion-segment :value="view.status" class="filter" @ion-change="setStatus($event.detail.value as StatusFilter)">
          <ion-segment-button value="all"><ion-label>{{ t.list.filter.all }} · {{ list.have + list.want }}</ion-label></ion-segment-button>
          <ion-segment-button value="have"><ion-label>{{ t.list.filter.have }} · {{ list.have }}</ion-label></ion-segment-button>
          <ion-segment-button value="want"><ion-label>{{ t.list.filter.want }} · {{ list.want }}</ion-label></ion-segment-button>
        </ion-segment>
        <div class="bar">
          <button class="sort" @click="sortMenu"><ion-icon :icon="swapVerticalOutline" />{{ sortLabel }}</button>
          <span v-if="filtered" class="muted">{{ t.list.shown(rows.length, all.length) }}</span>
        </div>
      </template>

      <template v-if="rows.length">
        <ion-list class="items">
          <ItemRow
            v-for="i in rows"
            :key="i.id"
            :item="i"
            :fallback="list.emoji"
            :fields="list.fields"
            :selecting="selecting"
            :selected="selected.has(i.id)"
            @select="toggleSelected(i)"
            @open="openItem(i)"
            @photo="showPhoto(i)"
            @toggle="toggle(i)"
            @remove="remove(i)"
          />
        </ion-list>
        <div class="fab-space" />
      </template>
      <EmptyState v-else-if="all.length" emoji="🔍" v-bind="t.list.noResults" />
      <EmptyState v-else :emoji="list.emoji" v-bind="t.list.empty" />

      <ion-fab v-if="!selecting" slot="fixed" vertical="bottom" horizontal="end">
        <ion-fab-button aria-label="Agregar" @click="openItem(null)"><ion-icon :icon="add" /></ion-fab-button>
      </ion-fab>

      <ItemFormSheet :open="itemSheet.open" :list="list" :item="itemSheet.item" @close="itemSheet.open = false" />
      <ListFormSheet :open="listSheet" :list="list" @close="listSheet = false" />
      <PhotoViewer :open="viewer.open" :src="viewer.src" :title="viewer.title" @close="viewer.open = false" />
    </ion-content>
  </ion-page>
</template>

<style scoped>
.filter { margin: 12px 16px 4px; width: auto; }
.bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 16px 8px; font-size: 14px; }
.sort {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: none;
  padding: 6px 0;
  color: var(--ion-color-primary);
  font-size: 14px;
  font-weight: 600;
}
.items { padding: 0; }
.fab-space { height: 96px; }
ion-fab { margin-bottom: var(--ion-safe-area-bottom, 0px); }
</style>

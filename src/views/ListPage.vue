<script setup lang="ts">
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonList,
  IonPage, IonSearchbar, IonTitle, IonToolbar, actionSheetController, alertController,
  useBackButton, useIonRouter,
} from '@ionic/vue'
import { add, close, closeCircle, ellipsisVertical, optionsOutline } from 'ionicons/icons'
import { computed, reactive, ref, watchEffect } from 'vue'
import { services } from '@/app/container'
import type { Collection, Id, Item, ItemStatus } from '@/domain/models'
import {
  applyView, defaultDir, filterFields, filterOptions, resolveView, sortFields,
  type FilterField, type Filters, type SortField, type StatusFilter,
} from '@/domain/query'
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
import { tintsOf } from '@/theme/tints'
import EmptyState from '@/components/EmptyState.vue'
import ItemFormSheet from '@/components/ItemFormSheet.vue'
import ItemRow from '@/components/ItemRow.vue'
import ItemTile from '@/components/ItemTile.vue'
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

// ---------- Filtros por campo (talle, año…): duran mientras estás en la lista, como la búsqueda ----------
const chosen = ref<Partial<Record<FilterField, { key: string; label: string }>>>({})
/** Si el campo se ocultó o se borró, su filtro deja de contar. */
const filters = computed<Filters>(() => {
  const ok = filterFields(fields.value)
  return Object.fromEntries(Object.entries(chosen.value).filter(([f]) => ok.includes(f as FilterField)).map(([f, c]) => [f, c!.key]))
})
/** Las opciones de cada campo salen de lo que muestran los demás filtros: ninguna da cero. */
const facets = computed(() =>
  filterFields(fields.value)
    .map((f) => {
      const { [f]: _, ...others } = filters.value
      const options = filterOptions(applyView(all.value, view.value, search.value, fields.value, others), f)
      return { f, name: sortName(f, fields.value), options, active: f in filters.value ? chosen.value[f] : undefined }
    })
    // Un campo con un solo valor (o vacío en todos) no sirve para filtrar.
    .filter((x) => x.active || x.options.length > 1)
    // Los aplicados primero, para que se vean sin deslizar.
    .sort((a, b) => Number(!!b.active) - Number(!!a.active)),
)

function clearFilter(f: FilterField) {
  const { [f]: _, ...rest } = chosen.value
  chosen.value = rest
}

async function filterMenu(facet: (typeof facets.value)[number]) {
  const label = (o: { label: string }) => o.label || t.list.noValue
  const sheet = await actionSheetController.create({
    header: facet.name,
    buttons: [
      ...facet.options.map((o) => ({
        text: `${o.key === facet.active?.key ? '✓ ' : ''}${label(o)} · ${o.count}`,
        handler: () => { chosen.value = { ...chosen.value, [facet.f]: { key: o.key, label: label(o) } } },
      })),
      ...(facet.active ? [{ text: t.list.clearFilter, handler: () => { clearFilter(facet.f) } }] : []),
      { text: t.common.cancel, role: 'cancel' },
    ],
  })
  await sheet.present()
}

const rows = computed(() => applyView(all.value, view.value, search.value, fields.value, filters.value))
/** Cuántos hay en el estado elegido (Todos / Tengo / …): "x de y" aparece solo si la búsqueda o un filtro esconde algo. */
const inStatus = computed(() => applyView(all.value, view.value, '', fields.value).length)
const filtered = computed(() => rows.value.length !== inStatus.value)
const sortLabel = computed(() => `${sortName(view.value.sort, fields.value)} (${dirName(view.value.sort, fields.value, view.value.dir)})`)

const itemSheet = reactive({ open: false, item: null as Item | null })
const listSheet = ref(false)
const viewer = reactive({ open: false, photos: [] as string[], title: '' })

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
    toast(t.select.moved(snapshot.items.length, `${to.emoji} ${to.name}`, snapshot.renamed), () => items.undoMove(snapshot))
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
  viewer.photos = await services().items.photos(item.id)
  viewer.title = item.name
  viewer.open = viewer.photos.length > 0
}

const setStatus = (status: StatusFilter) => views.set(props.id, { status })
/** Estados como chips; "Tuve" solo aparece si hay alguna: en la mayoría de las listas sería un chip vacío. */
type StatusChip = { value: StatusFilter; label: string; n: number }
const statuses = computed((): StatusChip[] => {
  const l = list.value
  if (!l) return []
  const all: StatusChip[] = [
    { value: 'all', label: t.list.filter.all, n: l.have + l.want },
    { value: 'have', label: t.list.filter.have, n: l.have },
    { value: 'want', label: t.list.filter.want, n: l.want },
  ]
  return l.gone || view.value.status === 'gone' ? [...all, { value: 'gone', label: t.list.filter.gone, n: l.gone }] : all
})

// ---------- Cabecera con el color de la lista (el mismo de su tarjeta en el inicio) ----------
const tint = computed(() => tintsOf(lists.lists)[props.id] ?? 'tint-0')
const progress = computed(() => {
  const l = list.value
  return l && l.have + l.want ? Math.round((l.have / (l.have + l.want)) * 100) : 0
})
/** El título chico de la barra aparece cuando el grande ya se fue de pantalla. */
const scrolled = ref(false)
const onScroll = (e: CustomEvent<{ scrollTop: number }>) => { scrolled.value = e.detail.scrollTop > 56 }
const activeFilters = computed(() => facets.value.filter((x) => x.active))

/** Orden, filtros por campo y grilla/filas: todo en un botón, para que arriba quede lugar para las fotos. */
async function adjustMenu() {
  const sheet = await actionSheetController.create({
    header: t.list.adjust,
    buttons: [
      { text: `${t.list.sortTitle}: ${sortLabel.value}`, handler: () => { sortMenu() } },
      ...facets.value.map((x) => ({
        text: x.active ? `${t.list.filterBy} ${x.name}: ${x.active.label}` : `${t.list.filterBy} ${x.name}`,
        handler: () => { filterMenu(x) },
      })),
      { text: grid.value ? t.list.asList : t.list.asGrid, handler: () => { toggleLayout() } },
      { text: t.common.cancel, role: 'cancel' },
    ],
  })
  await sheet.present()
}
const grid = computed(() => view.value.layout === 'grid')
const toggleLayout = () => views.set(props.id, { layout: grid.value ? 'list' : 'grid' })

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
  <ion-page :class="tint">
    <ion-header class="ion-no-border">
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
      <ion-toolbar v-else class="tinted">
        <ion-buttons slot="start"><ion-back-button default-href="/" text="" /></ion-buttons>
        <ion-title v-if="list" class="small-title" :class="{ shown: scrolled }">{{ list.emoji }} {{ list.name }}</ion-title>
        <ion-buttons slot="end">
          <ion-button aria-label="Opciones" @click="listMenu"><ion-icon slot="icon-only" :icon="ellipsisVertical" /></ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content v-if="list" :scroll-events="true" @ion-scroll="onScroll">
      <div class="hero">
        <h1 class="display">{{ list.emoji }} {{ list.name }}</h1>
        <p v-if="list.have + list.want + list.gone">{{ t.list.progress(list.have, list.want, list.gone) }}</p>
        <!-- Avance: cuánto de la lista ya tenés ("Tuve" no cuenta, es historial). -->
        <div v-if="list.have + list.want" class="bar" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100">
          <span :style="{ width: `${progress}%` }" />
        </div>
        <!-- Buscar y, al lado, orden + filtros + grilla/filas: todo lo que achica lo que ves, junto. -->
        <div v-if="all.length" class="find">
          <ion-searchbar v-model="search" class="search" :placeholder="t.list.search" :debounce="150" />
            <button type="button" class="adjust" :aria-label="t.list.adjust" @click="adjustMenu">
              <ion-icon :icon="optionsOutline" />
              <span v-if="activeFilters.length" class="badge">{{ activeFilters.length }}</span>
            </button>
        </div>
      </div>

      <template v-if="all.length">
        <div class="tools">
          <div class="chips" role="radiogroup" :aria-label="t.list.adjust">
            <button
              v-for="st in statuses"
              :key="st.value"
              type="button"
              class="chip"
              role="radio"
              :aria-checked="view.status === st.value"
              :class="{ on: view.status === st.value }"
              @click="setStatus(st.value)"
            >{{ st.label }} {{ st.n }}</button>
          </div>
        </div>
        <!-- Filtros aplicados, en su propia fila para que nunca queden tapados; se sacan con la cruz. -->
        <div v-if="activeFilters.length || filtered" class="active">
          <button v-for="x in activeFilters" :key="x.f" type="button" class="chip filter" @click="filterMenu(x)">
            {{ x.name }}: {{ x.active!.label }}
            <ion-icon :icon="closeCircle" :aria-label="t.list.clearFilter" @click.stop="clearFilter(x.f)" />
          </button>
          <span v-if="filtered" class="shown muted">{{ t.list.shown(rows.length, inStatus) }}</span>
        </div>
      </template>

      <template v-if="rows.length">
        <div v-if="grid" class="grid">
          <ItemTile
            v-for="i in rows"
            :key="i.id"
            :item="i"
            :fallback="list.emoji"
            :selecting="selecting"
            :selected="selected.has(i.id)"
            @select="toggleSelected(i)"
            @open="selecting ? toggleSelected(i) : openItem(i)"
          />
        </div>
        <ion-list v-else class="items">
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
      <PhotoViewer :open="viewer.open" :photos="viewer.photos" :title="viewer.title" @close="viewer.open = false" />
    </ion-content>
  </ion-page>
</template>

<style scoped>
/* La barra y el bloque de arriba llevan el pastel de la lista; el bloque se va con el scroll. */
.tinted { --background: var(--tint-bg); --color: var(--tint-ink); --border-width: 0; }
.tinted ion-back-button, .tinted ion-button { --color: var(--tint-ink); }
.small-title { opacity: 0; transition: opacity 0.15s; }
.small-title.shown { opacity: 1; }
.hero { background: var(--tint-bg); padding: 0 16px 14px; border-radius: 0 0 24px 24px; }
.hero h1 { margin: 0; font-size: 26px; line-height: 1.15; }
.hero p { margin: 4px 0 0; font-size: 14px; color: var(--tint-ink); }
.bar { height: 6px; margin: 10px 0 2px; border-radius: 999px; overflow: hidden; background: color-mix(in srgb, var(--app-surface) 70%, transparent); }
.bar span { display: block; height: 100%; border-radius: 999px; background: var(--tint-bar); transition: width 0.3s; }
.find { display: flex; align-items: center; gap: 8px; padding-top: 12px; }
.search { flex: 1; padding: 0; --background: var(--app-surface); --box-shadow: none; --border-radius: 14px; }
.tools { padding: 12px 16px 4px; }
.chips { flex: 1; min-width: 0; display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
.chips::-webkit-scrollbar { display: none; }
.chip {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 0;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  color: var(--tint-ink);
  background: color-mix(in srgb, var(--tint-bg) 55%, transparent);
}
.chip.on { color: var(--app-surface); background: var(--tint-ink); }
/* Filtro aplicado: con borde, para no confundirlo con los estados. */
.chip.filter { background: none; box-shadow: inset 0 0 0 1.5px var(--tint-bar); }
.chip.filter ion-icon { font-size: 16px; margin-right: -4px; }
.adjust {
  position: relative;
  flex: none;
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px; /* el alto del buscador */
  border: 0;
  border-radius: 14px;
  font-size: 22px;
  color: var(--tint-ink);
  background: var(--app-surface);
}
.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  color: var(--app-surface);
  background: var(--tint-ink);
}
.active { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 6px 16px 0; }
.shown { margin-left: auto; font-size: 13px; }
/* El + toma el color de la lista en vez del naranja general. */
ion-fab-button { --background: var(--tint-ink); --background-activated: var(--tint-ink); --color: var(--tint-bg); }
.items { padding: 0; }
.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px 10px; padding: 10px 16px 0; }
.fab-space { height: 96px; }
ion-fab { margin-bottom: var(--ion-safe-area-bottom, 0px); }
</style>

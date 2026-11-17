<script setup lang="ts">
import {
  IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonItem, IonList,
  IonPage, IonReorder, IonReorderGroup, IonSearchbar, IonTitle, IonToolbar, actionSheetController, useIonRouter,
  type ReorderEndCustomEvent,
} from '@ionic/vue'
import { add, folderOpenOutline } from 'ionicons/icons'
import { computed, reactive, ref, watch } from 'vue'
import { services } from '@/app/container'
import type { CollectionWithCounts, Item } from '@/domain/models'
import { DEFAULT_VIEW, applyView } from '@/domain/query'
import { defaultFields } from '@/domain/fields'
import { useItemActions } from '@/composables/itemActions'
import { useLongPress } from '@/composables/longPress'
import { useItemsStore } from '@/stores/items'
import { useListsStore } from '@/stores/lists'
import { t } from '@/copy/es'
import { tintsOf } from '@/theme/tints'
import EmptyState from '@/components/EmptyState.vue'
import ItemFormSheet from '@/components/ItemFormSheet.vue'
import ItemRow from '@/components/ItemRow.vue'
import ListFormSheet from '@/components/ListFormSheet.vue'
import PhotoViewer from '@/components/PhotoViewer.vue'

const lists = useListsStore()
const items = useItemsStore()
const router = useIonRouter()
const { toggle, remove } = useItemActions()
const creating = ref(false)
/** La lista que se edita desde el menú de mantener apretado. */
const editingList = ref<CollectionWithCounts | null>(null)
const reordering = ref(false)

// Búsqueda global: carga todos los ítems la primera vez que se escribe algo.
const search = ref('')
const searching = computed(() => search.value.trim().length > 0)
watch(searching, (on) => { if (on && !items.all) items.loadAll() })
const results = computed(() => (searching.value ? applyView(items.all ?? [], { ...DEFAULT_VIEW, status: 'any' }, search.value) : []))
const listOf = (i: Item) => lists.byId(i.listId)
const emptyFields = defaultFields()

const itemSheet = reactive({ open: false, item: null as Item | null })
const viewer = reactive({ open: false, photos: [] as string[], title: '' })

const openList = (id: string) => router.push(`/lists/${id}`)

// ---------- Mantener apretada una lista: sus opciones, sin tener que entrar ----------
const press = useLongPress((l: CollectionWithCounts) => { if (!reordering.value) listMenu(l) })
const tapList = (l: CollectionWithCounts) => { if (press.tapped() && !reordering.value) openList(l.id) }

async function listMenu(l: CollectionWithCounts) {
  const sheet = await actionSheetController.create({
    header: `${l.emoji} ${l.name}`,
    buttons: [
      { text: t.list.edit, handler: () => { editingList.value = l } },
      { text: t.list.fields, handler: () => { router.push(`/lists/${l.id}/fields`) } },
      ...(lists.lists.length > 1 ? [{ text: t.home.reorderLists, handler: () => { reordering.value = true } }] : []),
      { text: t.list.delete, role: 'destructive', handler: () => { confirmDelete(l) } },
      { text: t.common.cancel, role: 'cancel' },
    ],
  })
  await sheet.present()
}

async function confirmDelete(l: CollectionWithCounts) {
  const sheet = await actionSheetController.create({
    header: t.list.confirmDelete(l.name),
    buttons: [
      { text: t.common.delete, role: 'destructive', handler: () => { lists.remove(l.id) } },
      { text: t.common.cancel, role: 'cancel' },
    ],
  })
  await sheet.present()
}
const tints = computed(() => tintsOf(lists.lists))
const progress = (l: CollectionWithCounts) => (l.have + l.want ? Math.round((l.have / (l.have + l.want)) * 100) : 0)

function openItem(item: Item) {
  itemSheet.item = item
  itemSheet.open = true
}

async function showPhoto(item: Item) {
  viewer.photos = await services().items.photos(item.id)
  viewer.title = item.name
  viewer.open = viewer.photos.length > 0
}

function onReorder(e: ReorderEndCustomEvent) {
  const ids = lists.lists.map((l) => l.id)
  const [moved] = ids.splice(e.detail.from, 1)
  ids.splice(e.detail.to, 0, moved)
  e.detail.complete(false) // el orden lo dibuja Vue desde el store
  lists.reorder(ids).catch((err) => { console.error(err); lists.load() })
}
</script>

<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ t.home.title }}</ion-title>
        <ion-buttons slot="end">
          <ion-button v-if="lists.lists.length > 1 && !searching" @click="reordering = !reordering">
            {{ reordering ? t.common.done : t.home.reorder }}
          </ion-button>
          <ion-button :aria-label="t.home.data" @click="router.push('/data')"><ion-icon slot="icon-only" :icon="folderOpenOutline" /></ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar v-if="lists.lists.length && !reordering">
        <ion-searchbar v-model="search" :placeholder="t.home.search" :debounce="150" />
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <template v-if="searching">
        <p class="count muted">{{ t.home.results(results.length) }}</p>
        <ion-list v-if="results.length" class="results">
          <ItemRow
            v-for="i in results"
            :key="i.id"
            :item="i"
            :fallback="listOf(i)?.emoji ?? '👕'"
            :context="listOf(i) && `${listOf(i)!.emoji} ${listOf(i)!.name}`"
            :fields="listOf(i)?.fields ?? emptyFields"
            @open="openItem(i)"
            @photo="showPhoto(i)"
            @toggle="toggle(i)"
            @remove="remove(i)"
          />
        </ion-list>
        <div class="end-space" />
      </template>

      <template v-else>
        <ion-list v-if="lists.lists.length" class="cards">
          <ion-reorder-group :disabled="!reordering" @ion-reorder-end="onReorder">
            <ion-item
              v-for="l in lists.lists"
              :key="l.id"
              class="card"
              :class="tints[l.id]"
              lines="none"
              :button="!reordering"
              :detail="false"
              v-bind="press.on(l)"
              @click="tapList(l)"
            >
              <div class="card-body">
                <div class="card-top">
                  <span class="emoji">{{ l.emoji }}</span>
                  <h2>{{ l.name }}</h2>
                  <span class="total">{{ l.have + l.want }}</span>
                </div>
                <!-- Avance: cuánto de la lista ya tenés ("Tuve" no cuenta, es historial). -->
                <div class="bar" role="progressbar" :aria-valuenow="progress(l)" aria-valuemin="0" aria-valuemax="100">
                  <span :style="{ width: `${progress(l)}%` }" />
                </div>
                <p>{{ t.counts(l.have, l.want, l.gone) }}</p>
              </div>
              <ion-reorder slot="end" />
            </ion-item>
          </ion-reorder-group>
        </ion-list>
        <EmptyState v-else emoji="👕" v-bind="t.home.empty" />

        <ion-fab slot="fixed" vertical="bottom" horizontal="end">
          <ion-fab-button :aria-label="t.home.newList" @click="creating = true">
            <ion-icon :icon="add" />
          </ion-fab-button>
        </ion-fab>
      </template>

      <ListFormSheet :open="creating" @close="creating = false" @created="(l) => openList(l.id)" />
      <ListFormSheet :open="!!editingList" :list="editingList" @close="editingList = null" />
      <ItemFormSheet
        v-if="itemSheet.item && listOf(itemSheet.item)"
        :open="itemSheet.open"
        :list="listOf(itemSheet.item)!"
        :item="itemSheet.item"
        @close="itemSheet.open = false"
      />
      <PhotoViewer :open="viewer.open" :photos="viewer.photos" :title="viewer.title" @close="viewer.open = false" />
    </ion-content>
  </ion-page>
</template>

<style scoped>
.cards { padding: 8px 16px; background: transparent; }
.card {
  --background: var(--tint-bg);
  --color: var(--ion-text-color);
  --border-radius: 20px;
  --padding-start: 16px;
  --inner-padding-end: 12px;
  border-radius: 20px;
  margin-bottom: 10px;
}
.card-body { flex: 1; min-width: 0; padding: 14px 0; }
.card-top { display: flex; align-items: center; gap: 10px; }
.emoji { font-size: 24px; line-height: 1; }
h2 {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-family: var(--app-font-display);
  font-size: 19px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.total {
  flex: none;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 999px;
  color: var(--tint-ink);
  background: color-mix(in srgb, var(--app-surface) 70%, transparent);
}
.bar { height: 6px; margin: 12px 0 6px; border-radius: 999px; overflow: hidden; background: color-mix(in srgb, var(--app-surface) 70%, transparent); }
.bar span { display: block; height: 100%; border-radius: 999px; background: var(--tint-bar); transition: width 0.3s; }
.card-body p { margin: 0; font-size: 13px; color: var(--tint-ink); }
.count { margin: 12px 16px 4px; font-size: 14px; }
.results { padding: 0; }
.end-space { height: 32px; }
ion-fab { margin-bottom: var(--ion-safe-area-bottom, 0px); }
</style>

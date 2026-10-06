<script setup lang="ts">
import {
  IonButton, IonButtons, IonContent, IonFab, IonFabButton, IonHeader, IonIcon, IonItem, IonLabel, IonList,
  IonPage, IonReorder, IonReorderGroup, IonSearchbar, IonTitle, IonToolbar, useIonRouter, type ReorderEndCustomEvent,
} from '@ionic/vue'
import { add, folderOpenOutline } from 'ionicons/icons'
import { computed, reactive, ref, watch } from 'vue'
import { services } from '@/app/container'
import type { Item } from '@/domain/models'
import { DEFAULT_VIEW, applyView } from '@/domain/query'
import { defaultFields } from '@/domain/fields'
import { useItemActions } from '@/composables/itemActions'
import { useItemsStore } from '@/stores/items'
import { useListsStore } from '@/stores/lists'
import { t } from '@/copy/es'
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
const reordering = ref(false)

// Búsqueda global: carga todos los ítems la primera vez que se escribe algo.
const search = ref('')
const searching = computed(() => search.value.trim().length > 0)
watch(searching, (on) => { if (on && !items.all) items.loadAll() })
const results = computed(() => (searching.value ? applyView(items.all ?? [], DEFAULT_VIEW, search.value) : []))
const listOf = (i: Item) => lists.byId(i.listId)
const emptyFields = defaultFields()

const itemSheet = reactive({ open: false, item: null as Item | null })
const viewer = reactive({ open: false, src: null as string | null, title: '' })

const openList = (id: string) => router.push(`/lists/${id}`)

function openItem(item: Item) {
  itemSheet.item = item
  itemSheet.open = true
}

async function showPhoto(item: Item) {
  viewer.src = await services().items.photo(item.id)
  viewer.title = item.name
  viewer.open = !!viewer.src
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
        <ion-list v-if="lists.lists.length">
          <ion-reorder-group :disabled="!reordering" @ion-reorder-end="onReorder">
            <ion-item v-for="l in lists.lists" :key="l.id" :button="!reordering" :detail="!reordering" @click="!reordering && openList(l.id)">
              <span slot="start" class="emoji">{{ l.emoji }}</span>
              <ion-label>
                <h2>{{ l.name }}</h2>
                <p>{{ t.counts(l.have, l.want) }}</p>
              </ion-label>
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
      <ItemFormSheet
        v-if="itemSheet.item && listOf(itemSheet.item)"
        :open="itemSheet.open"
        :list="listOf(itemSheet.item)!"
        :item="itemSheet.item"
        @close="itemSheet.open = false"
      />
      <PhotoViewer :open="viewer.open" :src="viewer.src" :title="viewer.title" @close="viewer.open = false" />
    </ion-content>
  </ion-page>
</template>

<style scoped>
.emoji {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  font-size: 24px;
  border-radius: 10px;
  background: var(--app-surface-2);
  margin-inline-end: 12px;
}
ion-label h2 { font-weight: 600; }
.count { margin: 12px 16px 4px; font-size: 14px; }
.results { padding: 0; }
.end-space { height: 32px; }
ion-fab { margin-bottom: var(--ion-safe-area-bottom, 0px); }
</style>

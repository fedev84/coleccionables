<script setup lang="ts">
import { IonIcon, IonItem, IonItemOption, IonItemOptions, IonItemSliding } from '@ionic/vue'
import { checkmarkCircle, checkmarkCircleOutline, ellipseOutline, linkOutline, searchOutline, trashOutline } from 'ionicons/icons'
import { computed, ref } from 'vue'
import type { Item } from '@/domain/models'
import { itemLine } from '@/domain/itemLine'
import { isShown, type FieldConfig } from '@/domain/fields'
import { t } from '@/copy/es'
import Thumb from './Thumb.vue'

/**
 * `context`: va antes de la línea de info (en la búsqueda global, la lista del ítem).
 * `selecting`: modo elegir varios; tocar la fila (o la foto) la elige, sin swipes.
 */
const props = defineProps<{ item: Item; fallback: string; fields: FieldConfig; context?: string; selecting?: boolean; selected?: boolean }>()
const emit = defineEmits<{ open: []; photo: []; toggle: []; remove: []; select: [] }>()
const sliding = ref<InstanceType<typeof IonItemSliding>>()
const line = computed(() => [props.context, itemLine(props.item, props.fields)].filter(Boolean).join(' · '))
const want = computed(() => props.item.status === 'want')
const hasUrl = computed(() => !!props.item.url && isShown(props.fields, 'url'))

/** Mantener apretado = empezar a elegir. Si el dedo se mueve (scroll o swipe), no cuenta. */
const LONG_PRESS_MS = 450
let timer: ReturnType<typeof setTimeout> | undefined
let start = { x: 0, y: 0 }
let longPressed = false

function down(e: PointerEvent) {
  longPressed = false
  start = { x: e.clientX, y: e.clientY }
  clearTimeout(timer)
  timer = setTimeout(() => {
    longPressed = true
    emit('select')
  }, LONG_PRESS_MS)
}
function move(e: PointerEvent) {
  if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) clearTimeout(timer)
}
const cancel = () => clearTimeout(timer)

/** El click que sigue a mantener apretado no abre el ítem ni la foto. */
function tap(action: 'open' | 'photo') {
  if (longPressed) longPressed = false
  else if (props.selecting) emit('select')
  else if (action === 'open') emit('open')
  else emit('photo')
}

async function act(fn: () => void) {
  await (sliding.value?.$el as HTMLIonItemSlidingElement | undefined)?.close()
  fn()
}
</script>

<template>
  <ion-item-sliding ref="sliding" :disabled="selecting">
    <ion-item-options side="start" @ion-swipe="act(() => emit('toggle'))">
      <ion-item-option :color="want ? 'success' : 'medium'" expandable @click="act(() => emit('toggle'))">
        <ion-icon slot="start" :icon="want ? checkmarkCircleOutline : searchOutline" />
        {{ want ? t.list.markHave : t.list.markWant }}
      </ion-item-option>
    </ion-item-options>

    <ion-item
      class="row"
      :class="{ want, selected }"
      :detail="false"
      button
      @click="tap('open')"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="cancel"
      @pointercancel="cancel"
      @pointerleave="cancel"
      @contextmenu.prevent
    >
      <button slot="start" class="photo-btn" :disabled="!item.thumb && !selecting" :aria-label="t.photo.view" @click.stop="tap('photo')">
        <Thumb :src="item.thumb" :fallback="fallback" />
      </button>
      <div class="body">
        <div class="top">
          <span class="name">{{ item.name }}</span>
          <span v-if="want" class="tag">{{ t.list.want }}</span>
        </div>
        <div v-if="line || hasUrl" class="line muted">
          <ion-icon v-if="hasUrl" :icon="linkOutline" class="link" />{{ line }}
        </div>
      </div>
      <ion-icon
        v-if="selecting"
        slot="end"
        class="check"
        :class="{ on: selected }"
        :icon="selected ? checkmarkCircle : ellipseOutline"
        :aria-label="selected ? t.select.selected : t.select.notSelected"
      />
    </ion-item>

    <ion-item-options side="end" @ion-swipe="act(() => emit('remove'))">
      <ion-item-option color="danger" expandable @click="act(() => emit('remove'))">
        <ion-icon slot="icon-only" :icon="trashOutline" />
      </ion-item-option>
    </ion-item-options>
  </ion-item-sliding>
</template>

<style scoped>
.row { --padding-start: 12px; --inner-padding-end: 12px; --min-height: 72px; }
.photo-btn { border: 0; padding: 0; background: none; margin: 8px 12px 8px 0; display: block; }
.photo-btn:disabled { pointer-events: none; }
.body { min-width: 0; flex: 1; padding: 8px 0; }
.top { display: flex; align-items: center; gap: 8px; }
.name { font-weight: 600; font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.want .name { color: var(--app-muted); }
.want :deep(.thumb img) { opacity: 0.55; }
.tag {
  flex: none;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  color: var(--ion-color-warning-shade, #b45309);
  background: rgba(var(--ion-color-warning-rgb, 245, 158, 11), 0.18);
}
.line { font-size: 14px; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.link { vertical-align: -2px; margin-right: 4px; }
.check { font-size: 26px; color: var(--app-muted); margin-left: 8px; }
.check.on { color: var(--ion-color-primary); }
.selected { --background: rgba(var(--ion-color-primary-rgb), 0.1); }
</style>

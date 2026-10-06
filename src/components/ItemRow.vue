<script setup lang="ts">
import { IonIcon, IonItem, IonItemOption, IonItemOptions, IonItemSliding } from '@ionic/vue'
import { checkmarkCircleOutline, linkOutline, searchOutline, trashOutline } from 'ionicons/icons'
import { computed, ref } from 'vue'
import type { Item } from '@/domain/models'
import { itemLine } from '@/domain/itemLine'
import { isShown, type FieldConfig } from '@/domain/fields'
import { t } from '@/copy/es'
import Thumb from './Thumb.vue'

/** `context`: va antes de la línea de info (en la búsqueda global, la lista del ítem). */
const props = defineProps<{ item: Item; fallback: string; fields: FieldConfig; context?: string }>()
const emit = defineEmits<{ open: []; photo: []; toggle: []; remove: [] }>()
const sliding = ref<InstanceType<typeof IonItemSliding>>()
const line = computed(() => [props.context, itemLine(props.item, props.fields)].filter(Boolean).join(' · '))
const want = computed(() => props.item.status === 'want')
const hasUrl = computed(() => !!props.item.url && isShown(props.fields, 'url'))

async function act(fn: () => void) {
  await (sliding.value?.$el as HTMLIonItemSlidingElement | undefined)?.close()
  fn()
}
</script>

<template>
  <ion-item-sliding ref="sliding">
    <ion-item-options side="start" @ion-swipe="act(() => emit('toggle'))">
      <ion-item-option :color="want ? 'success' : 'medium'" expandable @click="act(() => emit('toggle'))">
        <ion-icon slot="start" :icon="want ? checkmarkCircleOutline : searchOutline" />
        {{ want ? t.list.markHave : t.list.markWant }}
      </ion-item-option>
    </ion-item-options>

    <ion-item class="row" :class="{ want }" :detail="false" button @click="emit('open')">
      <button slot="start" class="photo-btn" :disabled="!item.thumb" :aria-label="t.photo.view" @click.stop="emit('photo')">
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
</style>

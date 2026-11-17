<script setup lang="ts">
import { IonIcon } from '@ionic/vue'
import { checkmarkCircle, ellipseOutline } from 'ionicons/icons'
import type { Item } from '@/domain/models'
import { t } from '@/copy/es'

/**
 * La pieza en la vista de grilla: la foto manda. Tocarla abre la ficha (o la elige, en modo elegir).
 * Sin swipes: en una grilla se confunden con el scroll; Tengo ⇄ Me falta se cambia desde la ficha.
 */
const props = defineProps<{ item: Item; fallback: string; selecting?: boolean; selected?: boolean }>()
const emit = defineEmits<{ open: []; select: [] }>()
const tap = () => (props.selecting ? emit('select') : emit('open'))
</script>

<template>
  <button type="button" class="tile" :class="[item.status, { selected }]" @click="tap" @contextmenu.prevent="emit('select')">
    <span class="pic">
      <img v-if="item.thumb" :src="item.thumb" alt="" loading="lazy" />
      <span v-else class="emoji">{{ fallback }}</span>
      <span v-if="item.status === 'want'" class="tag">{{ t.list.want }}</span>
      <span v-else-if="item.status === 'gone'" class="tag">{{ t.list.filter.gone }}</span>
      <ion-icon
        v-if="selecting"
        class="check"
        :icon="selected ? checkmarkCircle : ellipseOutline"
        :aria-label="selected ? t.select.selected : t.select.notSelected"
      />
    </span>
    <span class="name">{{ item.name }}</span>
    <span v-if="item.year || item.version" class="sub">{{ [item.year, item.version].filter(Boolean).join(' · ') }}</span>
  </button>
</template>

<style scoped>
.tile { display: flex; flex-direction: column; min-width: 0; padding: 0; border: 0; background: none; color: inherit; text-align: left; font: inherit; }
.pic {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  border-radius: 14px;
  overflow: hidden;
  background: var(--app-surface-2);
}
img { width: 100%; height: 100%; object-fit: cover; display: block; }
.emoji { font-size: 32px; opacity: 0.5; }
/* "Me falta": un hueco punteado, como la figurita que falta en el álbum. */
.want .pic { background: transparent; outline: 1.5px dashed var(--app-muted); outline-offset: -1.5px; }
.want img { opacity: 0.5; }
.gone img { opacity: 0.45; filter: grayscale(1); }
.tag {
  position: absolute;
  left: 6px;
  bottom: 6px;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
  color: var(--ion-text-color);
  background: color-mix(in srgb, var(--app-surface) 85%, transparent);
}
.check { position: absolute; top: 6px; right: 6px; font-size: 24px; color: #fff; filter: drop-shadow(0 0 2px rgb(0 0 0 / 60%)); }
.selected .pic { outline: 3px solid var(--ion-color-primary); outline-offset: -3px; }
.selected .check { color: var(--ion-color-primary); filter: none; background: #fff; border-radius: 50%; }
.name { margin-top: 6px; font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.want .name, .gone .name { color: var(--app-muted); }
.sub { font-size: 12px; color: var(--app-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>

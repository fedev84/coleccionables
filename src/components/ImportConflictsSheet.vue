<script setup lang="ts">
/**
 * Al importar: las piezas que están en el teléfono y en el backup con datos distintos.
 * Por cada una se elige con cuál quedarse; de entrada, la editada más recientemente.
 * Se abre con modalController y devuelve las elecciones con role "confirm".
 */
import { IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar, modalController } from '@ionic/vue'
import { ref } from 'vue'
import type { ImportPlan } from '@/domain/backup'
import { diffItems } from '@/domain/diff'
import { identityLabel } from '@/domain/identity'
import { formatDate } from '@/domain/dates'
import { t } from '@/copy/es'
import Thumb from './Thumb.vue'

type Choice = 'phone' | 'backup'
const props = defineProps<{ plan: ImportPlan }>()

const choices = ref<Choice[]>(props.plan.conflicts.map((c) => c.suggested))
const cards = props.plan.conflicts.map((c) => ({
  title: identityLabel(c.phone),
  list: `${c.list.emoji} ${c.list.name}`,
  diffs: diffItems(c.phone, c.backup.item, c.list.fields),
  photoChanged: !!c.backup.photos && c.backup.item.thumb !== c.phone.thumb,
  phone: { thumb: c.phone.thumb, date: formatDate(c.phone.updatedAt) },
  backup: { thumb: c.backup.item.thumb, date: formatDate(c.backup.item.updatedAt) },
  emoji: c.list.emoji,
}))

const setAll = (pick: Choice | 'suggested') => {
  choices.value = props.plan.conflicts.map((c) => (pick === 'suggested' ? c.suggested : pick))
}
const choose = (n: number, pick: Choice) => { choices.value = choices.value.map((c, k) => (k === n ? pick : c)) }

const cancel = () => modalController.dismiss(null, 'cancel')
const confirm = () => modalController.dismiss([...choices.value], 'confirm')
</script>

<template>
  <ion-header>
    <ion-toolbar>
      <ion-buttons slot="start"><ion-button @click="cancel">{{ t.common.cancel }}</ion-button></ion-buttons>
      <ion-title>{{ t.data.conflicts.title }}</ion-title>
      <ion-buttons slot="end"><ion-button strong @click="confirm">{{ t.data.confirm }}</ion-button></ion-buttons>
    </ion-toolbar>
  </ion-header>
  <ion-content class="ion-padding">
    <p class="summary">{{ t.data.summary(plan.summary) }}</p>
    <p class="intro">{{ t.data.conflicts.intro(plan.conflicts.length) }}</p>
    <div class="bulk">
      <button type="button" class="chip" @click="setAll('phone')">{{ t.data.conflicts.allPhone }}</button>
      <button type="button" class="chip" @click="setAll('backup')">{{ t.data.conflicts.allBackup }}</button>
      <button type="button" class="chip" @click="setAll('suggested')">{{ t.data.conflicts.newest }}</button>
    </div>

    <section v-for="(c, n) in cards" :key="n" class="card">
      <h3>{{ c.title }}</h3>
      <p class="muted list">{{ c.list }}</p>
      <table v-if="c.diffs.length">
        <thead>
          <tr><th /><th>{{ t.data.conflicts.phone }}</th><th>{{ t.data.conflicts.backup }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="d in c.diffs" :key="d.label">
            <th>{{ d.label }}</th>
            <td :class="{ on: choices[n] === 'phone' }">{{ d.phone }}</td>
            <td :class="{ on: choices[n] === 'backup' }">{{ d.backup }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="c.photoChanged" class="muted">{{ t.data.conflicts.photo }}</p>
      <div class="options" role="radiogroup" :aria-label="c.title">
        <button
          v-for="side in (['phone', 'backup'] as const)"
          :key="side"
          type="button"
          class="option"
          role="radio"
          :aria-checked="choices[n] === side"
          :class="{ on: choices[n] === side }"
          @click="choose(n, side)"
        >
          <Thumb :src="c[side].thumb" :fallback="c.emoji" :size="40" />
          <span>
            <strong>{{ side === 'phone' ? t.data.conflicts.phone : t.data.conflicts.backup }}</strong>
            <small>{{ t.data.conflicts.edited(c[side].date) }}</small>
          </span>
        </button>
      </div>
    </section>
  </ion-content>
</template>

<style scoped>
.summary { margin: 0 0 8px; white-space: pre-line; font-size: 14px; color: var(--app-muted); }
.intro { margin: 0 0 12px; }
.bulk { display: flex; gap: 6px; overflow-x: auto; margin: 0 0 16px; scrollbar-width: none; }
.chip {
  flex: none;
  border: 1px solid var(--app-border);
  background: var(--app-surface-2);
  color: var(--ion-text-color);
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 14px;
}
.card { border: 1px solid var(--app-border); border-radius: 12px; padding: 12px; margin: 0 0 12px; }
h3 { margin: 0; font-size: 16px; }
.list { margin: 2px 0 8px; font-size: 13px; }
table { width: 100%; border-collapse: collapse; font-size: 14px; margin: 0 0 8px; table-layout: fixed; }
th, td { text-align: left; padding: 4px 6px 4px 0; vertical-align: top; overflow-wrap: anywhere; }
thead th { font-size: 12px; color: var(--app-muted); font-weight: 600; }
tbody th { font-weight: 400; color: var(--app-muted); width: 32%; }
td { color: var(--app-muted); }
td.on { color: var(--ion-text-color); font-weight: 600; }
.options { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  background: none;
  color: var(--ion-text-color);
  text-align: left;
}
.option.on { border-color: var(--ion-color-primary); box-shadow: inset 0 0 0 1px var(--ion-color-primary); }
.option span { display: flex; flex-direction: column; min-width: 0; }
.option small { color: var(--app-muted); font-size: 12px; }
</style>

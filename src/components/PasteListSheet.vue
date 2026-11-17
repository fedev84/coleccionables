<script setup lang="ts">
/**
 * "Pegar una lista": un texto con una pieza por renglón → vista previa → se agregan todas juntas.
 * La lectura de cada renglón está en domain/paste.ts.
 */
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonModal, IonTextarea, IonTitle, IonToolbar } from '@ionic/vue'
import { checkmarkCircle, ellipseOutline } from 'ionicons/icons'
import { computed, ref, watch } from 'vue'
import type { Collection } from '@/domain/models'
import { isDefaultLabel, isShown } from '@/domain/fields'
import { planPaste } from '@/domain/paste'
import { BASE_VERSIONS } from '@/domain/suggestions'
import { toast } from '@/platform/toast'
import { useItemsStore } from '@/stores/items'
import { useListsStore } from '@/stores/lists'
import { tintsOf } from '@/theme/tints'
import { t } from '@/copy/es'

const props = defineProps<{ open: boolean; list: Collection }>()
const emit = defineEmits<{ close: [] }>()

const items = useItemsStore()
const lists = useListsStore()
const tint = computed(() => tintsOf(lists.lists)[props.list.id] ?? 'tint-0')

const text = ref('')
/** De entrada "Me falta": lo típico es pegar la lista de lo que estás buscando. */
const status = ref<'want' | 'have'>('want')
/** Las que destildaste en la vista previa (por su identidad). */
const skipped = ref(new Set<string>())
const saving = ref(false)

watch(() => props.open, (open) => {
  if (!open) return
  text.value = ''
  status.value = 'want'
  skipped.value = new Set()
  items.loadUsed(props.list.id)
})

const plan = computed(() => {
  const cfg = props.list.fields
  return planPaste(text.value, {
    year: isShown(cfg, 'year'),
    // Las versiones de camisetas solo si el campo conserva su nombre de fábrica (como las sugerencias del formulario).
    versions: isShown(cfg, 'version') ? [...items.used.version, ...(isDefaultLabel(cfg, 'version') ? BASE_VERSIONS : [])] : null,
  }, items.byList[props.list.id] ?? [])
})
const toAdd = computed(() => plan.value.rows.filter((r) => !r.exists && !skipped.value.has(r.key)))
const already = computed(() => plan.value.rows.filter((r) => r.exists).length)

function toggle(key: string) {
  const next = new Set(skipped.value)
  if (!next.delete(key)) next.add(key)
  skipped.value = next
}

async function add() {
  if (!toAdd.value.length || saving.value) return
  saving.value = true
  try {
    const created = await items.createMany(props.list, toAdd.value.map((r) => ({
      name: r.name, year: r.year, version: r.version, status: status.value, size: null, url: null, description: null,
    })))
    toast(t.paste.added(created.length, `${props.list.emoji} ${props.list.name}`))
    emit('close')
  } catch (e) {
    console.error(e)
    toast(t.paste.error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <ion-modal :is-open="open" :class="tint" @did-dismiss="emit('close')">
    <ion-header class="ion-no-border">
      <ion-toolbar class="tinted">
        <ion-buttons slot="start"><ion-button @click="emit('close')">{{ t.common.cancel }}</ion-button></ion-buttons>
        <ion-title>{{ t.paste.title }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="hero">
        <p>{{ t.paste.intro }}</p>
        <div class="pills" role="radiogroup" :aria-label="t.item.statusLabel">
          <button
            v-for="st in (['want', 'have'] as const)"
            :key="st"
            type="button"
            class="pill"
            role="radio"
            :aria-checked="status === st"
            :class="{ on: status === st }"
            @click="status = st"
          >{{ t.paste.allAs(t.item.status[st]) }}</button>
        </div>
        <ion-textarea
          v-model="text"
          class="text"
          :aria-label="t.paste.title"
          :placeholder="t.paste.placeholder"
          :auto-grow="true"
          :rows="6"
          autocapitalize="sentences"
        />
      </div>

      <div v-if="plan.rows.length" class="preview">
        <p class="summary">{{ t.paste.summary(toAdd.length, already, plan.repeated) }}</p>
        <ul>
          <li v-for="r in plan.rows" :key="r.key">
            <button
              type="button"
              class="row"
              :class="{ off: r.exists || skipped.has(r.key) }"
              :disabled="r.exists"
              :aria-pressed="!r.exists && !skipped.has(r.key)"
              @click="toggle(r.key)"
            >
              <ion-icon v-if="!r.exists" :icon="skipped.has(r.key) ? ellipseOutline : checkmarkCircle" />
              <span class="what">
                <strong>{{ r.name }}</strong>
                <small v-if="r.year || r.version">{{ [r.year, r.version].filter(Boolean).join(' · ') }}</small>
              </span>
              <span v-if="r.exists" class="tag">{{ t.paste.exists }}</span>
            </button>
          </li>
        </ul>
        <ion-button expand="block" class="add" :disabled="!toAdd.length || saving" @click="add">{{ t.paste.add(toAdd.length) }}</ion-button>
      </div>
    </ion-content>
  </ion-modal>
</template>

<style scoped>
.tinted { --background: var(--tint-bg); --color: var(--tint-ink); --border-width: 0; }
.tinted ion-button { --color: var(--tint-ink); }
.hero { background: var(--tint-bg); padding: 0 16px 16px; border-radius: 0 0 24px 24px; }
.hero p { margin: 0 0 12px; font-size: 14px; color: var(--tint-ink); }
.pills { display: flex; gap: 6px; margin-bottom: 12px; }
.pill {
  padding: 7px 14px;
  border: 0;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  color: var(--tint-ink);
  background: color-mix(in srgb, var(--app-surface) 75%, transparent);
}
.pill.on { color: var(--app-surface); background: var(--tint-ink); }
.text {
  --background: var(--app-surface);
  --border-radius: 14px;
  --padding-start: 14px;
  --padding-end: 14px;
  --padding-top: 12px;
  --padding-bottom: 12px;
  --highlight-color-focused: var(--tint-bar);
  border-radius: 14px;
}
.preview { padding: 16px; }
.summary { margin: 0 0 8px; font-size: 14px; color: var(--app-muted); }
ul { list-style: none; margin: 0 0 16px; padding: 0; }
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 4px;
  border: 0;
  border-bottom: 1px solid var(--app-border);
  background: none;
  color: var(--ion-text-color);
  text-align: left;
  font: inherit;
}
.row ion-icon { flex: none; font-size: 22px; color: var(--tint-ink); }
.row.off .what { opacity: 0.45; }
.row.off ion-icon { color: var(--app-muted); }
.row:disabled { padding-left: 38px; }
.what { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.what strong { font-size: 15px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.what small { font-size: 13px; color: var(--app-muted); }
.tag { flex: none; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 999px; color: var(--app-muted); background: var(--app-surface-2); }
.add { --background: var(--tint-ink); --color: var(--tint-bg); --border-radius: 14px; margin: 0 0 24px; }
</style>

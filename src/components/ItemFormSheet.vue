<script setup lang="ts">
import {
  IonButton, IonButtons, IonContent, IonHeader, IonInput, IonLabel, IonModal, IonSegment, IonSegmentButton,
  IonTextarea, IonTitle, IonToolbar, actionSheetController,
} from '@ionic/vue'
import { computed, reactive, ref, watch } from 'vue'
import { services } from '@/app/container'
import type { Authenticity, Collection, Item, ItemStatus, Photo } from '@/domain/models'
import { AUTHENTICITY_LABELS, isDefaultLabel, isShown, labelOf } from '@/domain/fields'
import { BASE_SIZES, BASE_VERSIONS, suggest } from '@/domain/suggestions'
import { ValidationError, normalizeUrl } from '@/domain/validation'
import { formatNumber } from '@/domain/numbers'
import { fold } from '@/domain/query'
import { pickPhoto, type PhotoSource } from '@/platform/photos'
import { toast } from '@/platform/toast'
import { useItemsStore } from '@/stores/items'
import { t } from '@/copy/es'
import PhotoViewer from './PhotoViewer.vue'
import Thumb from './Thumb.vue'

const props = defineProps<{ open: boolean; list: Collection; item?: Item | null }>()
const emit = defineEmits<{ close: [] }>()

const items = useItemsStore()
const form = reactive({
  name: '', status: 'have' as ItemStatus, year: '', version: '', size: '', price: '', place: '', url: '', description: '',
  authenticity: null as Authenticity | null,
  customization: '',
  extra: {} as Record<string, string>,
})
const errors = reactive<Record<string, string>>({})
const saving = ref(false)
/** Lo que se edita: el ítem del prop, o null si es nuevo (también después de "Duplicar"). */
const editing = ref<Item | null>(null)
const duplicated = ref(false)
/** undefined = la foto no cambió; null = se sacó; Photo = nueva. */
const photo = ref<Photo | null | undefined>(undefined)
const viewer = reactive({ open: false, src: null as string | null })
const nameInput = ref<InstanceType<typeof IonInput>>()
const customizationInput = ref<InstanceType<typeof IonInput>>()

const cfg = computed(() => props.list.fields)
const show = (f: Parameters<typeof isShown>[1]) => isShown(cfg.value, f)
const label = (f: Parameters<typeof labelOf>[1]) => labelOf(cfg.value, f)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    const i = props.item ?? null
    editing.value = i
    duplicated.value = false
    Object.assign(form, {
      name: i?.name ?? '',
      status: i?.status ?? 'have',
      year: i?.year?.toString() ?? '',
      version: i?.version ?? '',
      size: i?.size ?? '',
      price: i?.price != null ? formatNumber(i.price) : '',
      place: i?.place ?? '',
      authenticity: i?.authenticity ?? null,
      customization: i?.customization ?? '',
      url: i?.url ?? '',
      description: i?.description ?? '',
      extra: Object.fromEntries(props.list.fields.custom.map((f) => {
        const v = i?.extra[f.id]
        return [f.id, v == null ? '' : typeof v === 'number' ? formatNumber(v) : v]
      })),
    })
    photo.value = undefined
    Object.keys(errors).forEach((k) => delete errors[k])
    items.loadUsed(props.list.id)
  },
)

const thumb = computed(() => (photo.value === undefined ? (editing.value?.thumb ?? null) : (photo.value?.thumb ?? null)))
// Las sugerencias de camisetas solo si el campo conserva su nombre de fábrica.
const versions = computed(() => suggest(items.used.version, isDefaultLabel(cfg.value, 'version') ? BASE_VERSIONS : [], form.version))
const sizes = computed(() => suggest(items.used.size, isDefaultLabel(cfg.value, 'size') ? BASE_SIZES : [], form.size))
/** Atajos de personalización (solo con el nombre de fábrica). "Firmada" una sola vez; dorsales y parches pueden ser varios. */
const customizationChips = computed(() =>
  isDefaultLabel(cfg.value, 'customization')
    ? t.item.customizationChips.filter((c) => c !== 'Firmada' || !fold(form.customization).includes('firmada'))
    : [],
)
const places = computed(() => (form.place ? [] : items.used.place.slice(0, 6)))
/** El link listo para abrir, si es válido. */
const openableUrl = computed(() => {
  try { return normalizeUrl(form.url) } catch { return null }
})
const title = computed(() => (duplicated.value ? t.item.duplicateTitle : editing.value ? t.item.editTitle : t.item.newTitle))

async function photoMenu() {
  const buttons = [
    { text: t.photo.camera, handler: () => { choose('camera') } },
    { text: t.photo.gallery, handler: () => { choose('gallery') } },
  ]
  if (thumb.value) {
    buttons.unshift({ text: t.photo.view, handler: () => { view() } })
    buttons.push({ text: t.photo.remove, role: 'destructive', handler: () => { photo.value = null } } as never)
  }
  const sheet = await actionSheetController.create({
    header: thumb.value ? t.photo.change : t.photo.add,
    buttons: [...buttons, { text: t.common.cancel, role: 'cancel' } as never],
  })
  await sheet.present()
}

async function choose(source: PhotoSource) {
  try {
    const picked = await pickPhoto(source)
    if (picked) photo.value = picked
  } catch (e) {
    console.error(e)
    toast(t.photo.error)
  }
}

async function view() {
  viewer.src = photo.value ? photo.value.full : editing.value ? await services().items.photo(editing.value.id) : null
  viewer.open = !!viewer.src
}

/** "Misma camiseta, otra versión": el formulario pasa a ser un ítem nuevo con los mismos datos y la misma foto. */
async function duplicate() {
  const source = editing.value
  if (!source) return
  if (photo.value === undefined && source.thumb) {
    const full = await services().items.photo(source.id)
    photo.value = full ? { full, thumb: source.thumb } : undefined
  }
  editing.value = null
  duplicated.value = true
}

async function save() {
  saving.value = true
  Object.keys(errors).forEach((k) => delete errors[k])
  try {
    const input = { ...form, extra: { ...form.extra } }
    if (editing.value) await items.update(props.list, editing.value, input, photo.value)
    else await items.create(props.list, input, photo.value)
    emit('close')
  } catch (e) {
    if (e instanceof ValidationError) errors[e.field] = e.message
    else throw e
  } finally {
    saving.value = false
  }
}

/** Suma el atajo al final. "Dorsal" y "Parche" quedan para completar, con el foco en el campo. */
function addCustomization(chip: string) {
  const current = form.customization.trim()
  const complete = chip === 'Firmada'
  form.customization = `${current ? `${current} · ` : ''}${chip}${complete ? '' : ' '}`
  if (!complete) (customizationInput.value?.$el as HTMLIonInputElement | undefined)?.setFocus()
}

/** Tocar la opción marcada la desmarca: "sin dato" también es una respuesta válida. */
const toggleAuthenticity = (v: Authenticity) => { form.authenticity = form.authenticity === v ? null : v }

const focusName = () => !props.item && (nameInput.value?.$el as HTMLIonInputElement | undefined)?.setFocus()
const invalid = (field: string) => ({ 'ion-invalid ion-touched': !!errors[field] })
</script>

<template>
  <ion-modal :is-open="open" @did-present="focusName" @did-dismiss="emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="emit('close')">{{ t.common.cancel }}</ion-button>
        </ion-buttons>
        <ion-title>{{ title }}</ion-title>
        <ion-buttons slot="end">
          <ion-button strong :disabled="saving" @click="save">{{ editing ? t.common.save : t.item.add }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <form novalidate @submit.prevent="save">
        <p v-if="duplicated" class="hint">{{ t.item.duplicateHint }}</p>

        <button type="button" class="photo" @click="photoMenu">
          <Thumb :src="thumb" :fallback="list.emoji" :size="112" />
          <span>{{ thumb ? t.photo.change : t.photo.add }}</span>
        </button>

        <ion-input
          ref="nameInput"
          v-model="form.name"
          class="field"
          fill="solid"
          :label="t.item.name + ' *'"
          label-placement="stacked"
          :placeholder="t.item.namePh"
          :class="invalid('name')"
          :error-text="errors.name"
          autocapitalize="words"
        />

        <ion-segment v-model="form.status" class="status">
          <ion-segment-button value="have"><ion-label>{{ t.item.status.have }}</ion-label></ion-segment-button>
          <ion-segment-button value="want"><ion-label>{{ t.item.status.want }}</ion-label></ion-segment-button>
        </ion-segment>

        <ion-input
          v-if="show('year')"
          v-model="form.year"
          class="field"
          fill="solid"
          inputmode="numeric"
          :maxlength="4"
          :label="label('year')"
          label-placement="stacked"
          :placeholder="t.item.yearPh"
          :class="invalid('year')"
          :error-text="errors.year"
        />

        <template v-if="show('version')">
          <ion-input v-model="form.version" class="field" fill="solid" :label="label('version')" label-placement="stacked" :placeholder="isDefaultLabel(cfg, 'version') ? t.item.versionPh : ''" autocapitalize="sentences" />
          <div v-if="versions.length" class="chips">
            <button v-for="v in versions" :key="v" type="button" class="chip" @click="form.version = v">{{ v }}</button>
          </div>
        </template>

        <template v-if="show('size')">
          <ion-input v-model="form.size" class="field" fill="solid" :label="label('size')" label-placement="stacked" :placeholder="isDefaultLabel(cfg, 'size') ? t.item.sizePh : ''" autocapitalize="characters" />
          <div v-if="sizes.length" class="chips">
            <button v-for="s in sizes" :key="s" type="button" class="chip" @click="form.size = s">{{ s }}</button>
          </div>
        </template>

        <div v-if="show('authenticity')" class="choice" role="group" :aria-label="label('authenticity')">
          <span class="choice-label">{{ label('authenticity') }}</span>
          <div class="chips">
            <button
              v-for="(text, v) in AUTHENTICITY_LABELS"
              :key="v"
              type="button"
              class="chip"
              :class="{ on: form.authenticity === v }"
              :aria-pressed="form.authenticity === v"
              @click="toggleAuthenticity(v)"
            >{{ text }}</button>
          </div>
        </div>

        <template v-if="show('customization')">
          <ion-input
            ref="customizationInput"
            v-model="form.customization"
            class="field"
            fill="solid"
            :label="label('customization')"
            label-placement="stacked"
            :placeholder="isDefaultLabel(cfg, 'customization') ? t.item.customizationPh : ''"
            autocapitalize="sentences"
          />
          <div v-if="customizationChips.length" class="chips">
            <button v-for="c in customizationChips" :key="c" type="button" class="chip" @click="addCustomization(c)">{{ c }}</button>
          </div>
        </template>

        <ion-input
          v-for="f in list.fields.custom"
          :key="f.id"
          v-model="form.extra[f.id]"
          class="field"
          fill="solid"
          :inputmode="f.type === 'number' ? 'decimal' : 'text'"
          :label="f.label"
          label-placement="stacked"
          :class="invalid(`x:${f.id}`)"
          :error-text="errors[`x:${f.id}`]"
          autocapitalize="sentences"
        />

        <ion-input
          v-if="show('price')"
          v-model="form.price"
          class="field"
          fill="solid"
          inputmode="decimal"
          :label="label('price')"
          label-placement="stacked"
          :placeholder="t.item.pricePh"
          :class="invalid('price')"
          :error-text="errors.price"
        />

        <template v-if="show('place')">
          <ion-input v-model="form.place" class="field" fill="solid" :label="label('place')" label-placement="stacked" :placeholder="t.item.placePh" autocapitalize="sentences" />
          <div v-if="places.length" class="chips">
            <button v-for="p in places" :key="p" type="button" class="chip" @click="form.place = p">{{ p }}</button>
          </div>
        </template>

        <div v-if="show('url')" class="url">
          <ion-input
            v-model="form.url"
            class="field"
            fill="solid"
            inputmode="url"
            autocapitalize="off"
            :autocorrect="false"
            :label="label('url')"
            label-placement="stacked"
            :placeholder="t.item.urlPh"
            :class="invalid('url')"
            :error-text="errors.url"
          />
          <a v-if="openableUrl" class="open" :href="openableUrl" target="_blank" rel="noopener">{{ t.item.open }}</a>
        </div>

        <ion-textarea
          v-if="show('description')"
          v-model="form.description"
          class="field"
          fill="solid"
          :label="label('description')"
          label-placement="stacked"
          :placeholder="t.item.descriptionPh"
          :auto-grow="true"
          :rows="2"
          autocapitalize="sentences"
        />

        <ion-button v-if="editing" fill="outline" expand="block" class="duplicate" @click="duplicate">{{ t.item.duplicate }}</ion-button>
      </form>
      <PhotoViewer :open="viewer.open" :src="viewer.src" :title="form.name" @close="viewer.open = false" />
    </ion-content>
  </ion-modal>
</template>

<style scoped>
.hint { margin: 0 0 12px; font-size: 14px; color: var(--app-muted); text-align: center; }
.photo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin: 8px auto 16px;
  border: 0;
  background: none;
  color: var(--ion-color-primary);
  font-weight: 600;
  font-size: 14px;
}
.status { margin-bottom: 12px; }
.chips { display: flex; gap: 6px; overflow-x: auto; margin: -4px 0 14px; scrollbar-width: none; }
.chip {
  flex: none;
  border: 1px solid var(--app-border);
  background: var(--app-surface-2);
  color: var(--ion-text-color);
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 14px;
}
.chip.on {
  border-color: var(--ion-color-primary);
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  font-weight: 600;
}
.choice { margin: 0 0 14px; }
.choice-label { display: block; margin: 0 0 8px 4px; font-size: 13px; color: var(--app-muted); }
.choice .chips { margin: 0; }
.url { position: relative; }
.open {
  position: absolute;
  top: 8px;
  right: 12px;
  z-index: 2;
  font-size: 14px;
  font-weight: 600;
  color: var(--ion-color-primary);
  text-decoration: none;
}
.duplicate { margin: 8px 0 24px; }
</style>

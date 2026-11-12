<script setup lang="ts">
import {
  IonButton, IonButtons, IonContent, IonHeader, IonInput, IonLabel, IonModal, IonSegment, IonSegmentButton,
  IonTextarea, IonTitle, IonToolbar, actionSheetController,
} from '@ionic/vue'
import { computed, reactive, ref, watch } from 'vue'
import { services } from '@/app/container'
import { MAX_PHOTOS, type Authenticity, type Collection, type Item, type ItemStatus, type PhotoSet } from '@/domain/models'
import { AUTHENTICITY_LABELS, isDefaultLabel, isShown, labelOf } from '@/domain/fields'
import { BASE_SIZES, BASE_VERSIONS, suggest } from '@/domain/suggestions'
import { ValidationError, normalizeUrl, today } from '@/domain/validation'
import { formatNumber } from '@/domain/numbers'
import { fold } from '@/domain/query'
import { pickPhotos, thumbOf, type PhotoSource } from '@/platform/photos'
import { toast } from '@/platform/toast'
import { useItemsStore } from '@/stores/items'
import { useItemActions } from '@/composables/itemActions'
import { t } from '@/copy/es'
import PhotoViewer from './PhotoViewer.vue'
import Thumb from './Thumb.vue'

const props = defineProps<{ open: boolean; list: Collection; item?: Item | null }>()
const emit = defineEmits<{ close: [] }>()

const items = useItemsStore()
const { remove } = useItemActions()
const form = reactive({
  name: '', status: 'have' as ItemStatus, year: '', version: '', size: '', price: '', place: '', url: '', description: '',
  authenticity: null as Authenticity | null,
  customization: '',
  goneAt: '',
  goneReason: '',
  extra: {} as Record<string, string>,
})
const errors = reactive<Record<string, string>>({})
const saving = ref(false)
/** Lo que se edita: el ítem del prop, o null si es nuevo (también después de "Duplicar"). */
const editing = ref<Item | null>(null)
const duplicated = ref(false)
/** Fotos en el orden en que quedan; la primera es la principal. La miniatura solo se conoce de las recién elegidas. */
interface FormPhoto { full: string; thumb?: string }
const photos = ref<FormPhoto[]>([])
/** Si no se tocaron, al guardar no se reescriben. */
const photosChanged = ref(false)
/** Mientras cargan las fotos del ítem no se puede tocar la fila: se perderían las que faltan llegar. */
let photosLoading: Promise<void> = Promise.resolve()
const loadingPhotos = ref(false)
const viewer = reactive({ open: false, photos: [] as string[], start: 0 })
const nameInput = ref<InstanceType<typeof IonInput>>()
const customizationInput = ref<InstanceType<typeof IonInput>>()

// Al pasar a "Tuve" la fecha arranca en hoy; se puede cambiar.
watch(() => form.status, (s) => { if (s === 'gone' && !form.goneAt) form.goneAt = today() })

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
      goneAt: i?.goneAt ?? '',
      goneReason: i?.goneReason ?? '',
      extra: Object.fromEntries(props.list.fields.custom.map((f) => {
        const v = i?.extra[f.id]
        return [f.id, v == null ? '' : typeof v === 'number' ? formatNumber(v) : v]
      })),
    })
    photos.value = []
    photosChanged.value = false
    photosLoading = loadPhotos(i)
    Object.keys(errors).forEach((k) => delete errors[k])
    items.loadUsed(props.list.id)
  },
)

async function loadPhotos(i: Item | null) {
  if (!i?.thumb) return
  loadingPhotos.value = true
  try {
    const full = await services().items.photos(i.id)
    if (editing.value?.id === i.id) photos.value = full.map((f, n) => (n === 0 ? { full: f, thumb: i.thumb! } : { full: f }))
  } finally {
    loadingPhotos.value = false
  }
}

const canAddPhoto = computed(() => photos.value.length < MAX_PHOTOS)
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

function setPhotos(next: FormPhoto[]) {
  photos.value = next
  photosChanged.value = true
}

async function addPhotoMenu() {
  if (loadingPhotos.value) return
  if (!canAddPhoto.value) return toast(t.photo.full(MAX_PHOTOS))
  const sheet = await actionSheetController.create({
    header: photos.value.length ? t.photo.more : t.photo.add,
    buttons: [
      { text: t.photo.camera, handler: () => { choose('camera') } },
      { text: t.photo.gallery, handler: () => { choose('gallery') } },
      { text: t.common.cancel, role: 'cancel' },
    ],
  })
  await sheet.present()
}

async function photoMenu(n: number) {
  const sheet = await actionSheetController.create({
    header: n === 0 ? t.photo.main : t.photo.count(n + 1, photos.value.length),
    buttons: [
      { text: t.photo.view, handler: () => { view(n) } },
      ...(n > 0 ? [{ text: t.photo.cover, handler: () => { setPhotos([photos.value[n], ...photos.value.filter((_, k) => k !== n)]) } }] : []),
      { text: t.photo.remove, role: 'destructive', handler: () => { setPhotos(photos.value.filter((_, k) => k !== n)) } },
      { text: t.common.cancel, role: 'cancel' },
    ],
  })
  await sheet.present()
}

async function choose(source: PhotoSource) {
  try {
    const picked = await pickPhotos(source, MAX_PHOTOS - photos.value.length)
    if (picked.length) setPhotos([...photos.value, ...picked].slice(0, MAX_PHOTOS))
  } catch (e) {
    console.error(e)
    toast(t.photo.error)
  }
}

function view(n: number) {
  viewer.photos = photos.value.map((p) => p.full)
  viewer.start = n
  viewer.open = true
}

/** "Misma camiseta, otra versión": el formulario pasa a ser un ítem nuevo con los mismos datos y las mismas fotos. */
async function duplicate() {
  if (!editing.value) return
  await photosLoading
  photosChanged.value = photos.value.length > 0
  editing.value = null
  duplicated.value = true
}

/** La miniatura de la principal: la que ya había o, si cambió cuál es, una nueva. */
async function photoSet(): Promise<PhotoSet> {
  const first = photos.value[0]
  return { full: photos.value.map((p) => p.full), thumb: first ? (first.thumb ?? (await thumbOf(first.full))) : null }
}

async function removeItem() {
  if (editing.value && (await remove(editing.value))) emit('close')
}

async function save() {
  saving.value = true
  Object.keys(errors).forEach((k) => delete errors[k])
  try {
    await photosLoading
    const input = { ...form, extra: { ...form.extra } }
    const change = photosChanged.value ? await photoSet() : undefined
    if (editing.value) await items.update(props.list, editing.value, input, change)
    else await items.create(props.list, input, change)
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

        <div v-if="photos.length" class="photos">
          <span class="choice-label">{{ t.photo.title(photos.length, MAX_PHOTOS) }}</span>
          <div class="strip">
            <button v-for="(p, n) in photos" :key="n" type="button" class="tile" @click="photoMenu(n)">
              <img :src="p.thumb ?? p.full" alt="" />
              <span v-if="n === 0" class="badge">{{ t.photo.main }}</span>
            </button>
            <button v-if="canAddPhoto" type="button" class="tile add" :aria-label="t.photo.more" @click="addPhotoMenu">＋</button>
          </div>
        </div>
        <button v-else type="button" class="photo" :disabled="loadingPhotos" @click="addPhotoMenu">
          <Thumb :src="editing?.thumb ?? null" :fallback="list.emoji" :size="112" />
          <span>{{ t.photo.add }}</span>
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
          <ion-segment-button value="gone"><ion-label>{{ t.item.status.gone }}</ion-label></ion-segment-button>
        </ion-segment>

        <template v-if="form.status === 'gone'">
          <p class="hint">{{ t.item.goneHint }}</p>
          <ion-input
            v-model="form.goneReason"
            class="field"
            fill="solid"
            :label="t.item.goneReason"
            label-placement="stacked"
            :placeholder="t.item.goneReasonPh"
            autocapitalize="sentences"
          />
          <div class="chips">
            <button
              v-for="c in t.item.goneChips"
              :key="c"
              type="button"
              class="chip"
              :class="{ on: form.goneReason === c }"
              @click="form.goneReason = c"
            >{{ c }}</button>
          </div>
          <ion-input v-model="form.goneAt" class="field" fill="solid" type="date" :max="today()" :label="t.item.goneAt" label-placement="stacked" />
        </template>

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
        <ion-button v-if="editing" fill="clear" color="danger" expand="block" class="delete" @click="removeItem">{{ t.item.delete }}</ion-button>
      </form>
      <PhotoViewer :open="viewer.open" :photos="viewer.photos" :start="viewer.start" :title="form.name" @close="viewer.open = false" />
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
.duplicate { margin: 8px 0 4px; }
.delete { margin: 0 0 24px; }
.photos { margin: 0 0 16px; }
.strip { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
.strip::-webkit-scrollbar { display: none; }
.tile {
  position: relative;
  flex: none;
  width: 76px;
  height: 76px;
  padding: 0;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--app-surface-2);
}
.tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
.tile.add { font-size: 32px; color: var(--ion-color-primary); border-style: dashed; }
.badge {
  position: absolute;
  left: 4px;
  bottom: 4px;
  padding: 2px 6px;
  border-radius: 6px;
  background: rgb(0 0 0 / 60%);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
}
</style>

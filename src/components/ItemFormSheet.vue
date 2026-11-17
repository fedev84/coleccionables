<script setup lang="ts">
import {
  IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonInput, IonModal,
  IonTextarea, IonToolbar, actionSheetController,
} from '@ionic/vue'
import { cameraOutline, chevronDown, chevronUp } from 'ionicons/icons'
import { computed, reactive, ref, watch } from 'vue'
import { services } from '@/app/container'
import { MAX_PHOTOS, type Authenticity, type Collection, type Item, type ItemStatus, type PhotoSet } from '@/domain/models'
import { AUTHENTICITY_LABELS, isDefaultLabel, isShown, labelOf } from '@/domain/fields'
import { BASE_SIZES, BASE_VERSIONS, nameSuggestions, sortSizes, suggest } from '@/domain/suggestions'
import { ValidationError, normalizeUrl, today } from '@/domain/validation'
import { formatNumber } from '@/domain/numbers'
import { fold } from '@/domain/query'
import { pickPhotos, thumbOf, type PhotoSource } from '@/platform/photos'
import { toast } from '@/platform/toast'
import { useItemsStore } from '@/stores/items'
import { useListsStore } from '@/stores/lists'
import { tintsOf } from '@/theme/tints'
import { useItemActions } from '@/composables/itemActions'
import { t } from '@/copy/es'
import PhotoViewer from './PhotoViewer.vue'

const props = defineProps<{ open: boolean; list: Collection; item?: Item | null }>()
const emit = defineEmits<{ close: [] }>()

const items = useItemsStore()
const lists = useListsStore()
/** El formulario lleva el pastel de su lista, como la cabecera de la lista. */
const tint = computed(() => tintsOf(lists.lists)[props.list.id] ?? 'tint-0')
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
const content = ref<InstanceType<typeof IonContent>>()
const customizationInput = ref<InstanceType<typeof IonInput>>()

// Al pasar a "Tuve" la fecha arranca en hoy; se puede cambiar.
watch(() => form.status, (s) => { if (s === 'gone' && !form.goneAt) form.goneAt = today() })

const cfg = computed(() => props.list.fields)
const show = (f: Parameters<typeof isShown>[1]) => isShown(cfg.value, f)
const label = (f: Parameters<typeof labelOf>[1]) => labelOf(cfg.value, f)

// ---------- "Más datos": arriba lo básico (foto, nombre, estado, año, versión, talle, original o réplica); el resto, plegado ----------
const MORE = ['customization', 'price', 'place', 'url', 'description'] as const
/** Lo que hay plegado en esta lista, en el orden en que aparece (sus campos propios van después de la personalización). */
const moreLabels = computed(() => [
  ...(['customization'] as const).filter(show).map(label),
  ...props.list.fields.custom.map((f) => f.label),
  ...(['price', 'place', 'url', 'description'] as const).filter(show).map(label),
])
const moreHint = computed(() => {
  const ls = moreLabels.value
  return ls.length > 3 ? `${ls.slice(0, 3).join(', ')}…` : ls.join(', ')
})
/** Cuántos de los plegados tienen algo: se ve en el botón para no olvidarse de que están. */
const moreFilled = computed(() =>
  [...MORE.filter(show).map((f) => form[f]), ...Object.values(form.extra)]
    .filter((v) => v != null && String(v).trim() !== '').length)
const moreOpen = ref(false)
/** Los errores de estos campos tienen que verse: si hay uno, se despliega. */
const MORE_ERRORS = ['price', 'url']

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
    // Al editar algo que ya tiene esos datos, se ven; al cargar uno nuevo, plegados.
    moreOpen.value = moreFilled.value > 0
    savedInARow.value = 0
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
/**
 * Opciones como chips que se marcan: si lo escrito es una de ellas, se ven todas con esa marcada;
 * si es otra cosa, se filtran por lo tipeado (como antes).
 */
function options(used: string[], base: string[], value: string) {
  const all = suggest(used, base, '')
  return !value.trim() || all.some((o) => fold(o) === fold(value)) ? all : suggest(used, base, value)
}
const versions = computed(() => options(items.used.version, isDefaultLabel(cfg.value, 'version') ? BASE_VERSIONS : [], form.version))
const sizes = computed(() => sortSizes(options(items.used.size, isDefaultLabel(cfg.value, 'size') ? BASE_SIZES : [], form.size)))
/** Nombres ya usados en cualquier lista (los de esta primero), mientras se escribe uno nuevo. */
const names = computed(() => (editing.value ? [] : nameSuggestions(items.used.names, form.name)))
const isOn = (value: string, option: string) => !!value.trim() && fold(value) === fold(option)
/** Tocar el chip marcado lo desmarca. */
const pick = (key: 'version' | 'size', option: string) => { form[key] = isOn(form[key], option) ? '' : option }
const STATUSES = ['have', 'want', 'gone'] as const
/** La principal grande al lado del nombre; las demás, en la tira de abajo. */
const cover = computed(() => photos.value[0]?.thumb ?? photos.value[0]?.full ?? (loadingPhotos.value ? editing.value?.thumb : null) ?? null)
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

/** Cuántas se guardaron con "Guardar y cargar otra" desde que se abrió. */
const savedInARow = ref(0)

/** `next`: en vez de cerrar, deja el formulario listo para la siguiente pieza (ver `startNext`). */
async function save(next = false) {
  saving.value = true
  Object.keys(errors).forEach((k) => delete errors[k])
  try {
    await photosLoading
    const input = { ...form, extra: { ...form.extra } }
    const change = photosChanged.value ? await photoSet() : undefined
    if (editing.value) await items.update(props.list, editing.value, input, change)
    else await items.create(props.list, input, change)
    if (next) startNext()
    else emit('close')
  } catch (e) {
    if (e instanceof ValidationError) {
      errors[e.field] = e.message
      if (MORE_ERRORS.includes(e.field) || e.field.startsWith('x:')) moreOpen.value = true
    } else throw e
  } finally {
    saving.value = false
  }
}

/**
 * Cargar en serie (todas las de una temporada, una caja de figuritas…): queda lo que suele repetirse
 * (estado, año, versión, talle, original o réplica, dónde la compraste) y se vacía lo que es de cada pieza.
 */
function startNext() {
  const name = form.name.trim()
  Object.assign(form, { name: '', customization: '', price: '', url: '', description: '' })
  form.extra = Object.fromEntries(Object.keys(form.extra).map((k) => [k, '']))
  photos.value = []
  photosChanged.value = false
  editing.value = null
  duplicated.value = false
  savedInARow.value++
  toast(t.item.savedNext(name))
  content.value?.$el.scrollToTop(200)
  focusName()
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

const focusName = () => !editing.value && (nameInput.value?.$el as HTMLIonInputElement | undefined)?.setFocus()
const invalid = (field: string) => ({ 'ion-invalid ion-touched': !!errors[field] })
</script>

<template>
  <ion-modal :is-open="open" :class="tint" @did-present="focusName" @did-dismiss="emit('close')">
    <ion-header class="ion-no-border">
      <ion-toolbar class="tinted">
        <ion-buttons slot="start">
          <ion-button @click="emit('close')">{{ t.common.cancel }}</ion-button>
        </ion-buttons>
        <ion-buttons slot="end">
          <ion-button strong :disabled="saving" @click="save()">{{ editing ? t.common.save : t.item.add }}</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content ref="content">
      <form novalidate @submit.prevent="save()">
        <!-- Arriba, sobre el color de la lista: foto, nombre y estado. -->
        <div class="hero">
          <div class="head">
            <button
              type="button"
              class="cover"
              :class="{ empty: !cover }"
              :disabled="loadingPhotos"
              :aria-label="cover ? t.photo.main : t.photo.add"
              @click="photos.length ? photoMenu(0) : addPhotoMenu()"
            >
              <img v-if="cover" :src="cover" alt="" />
              <ion-icon v-else :icon="cameraOutline" />
            </button>
            <div class="who">
              <span class="context">{{ list.emoji }} {{ list.name }} · {{ title }}</span>
              <ion-input
                ref="nameInput"
                v-model="form.name"
                class="name"
                :aria-label="t.item.name"
                :placeholder="t.item.namePh"
                :class="invalid('name')"
                :error-text="errors.name"
                autocapitalize="words"
              />
            </div>
          </div>
          <div v-if="names.length" class="names" role="group" :aria-label="t.item.nameSuggestions">
            <button v-for="n in names" :key="n" type="button" class="pill" @click="form.name = n">{{ n }}</button>
          </div>
          <div v-if="photos.length" class="strip">
            <button v-for="(p, n) in photos.slice(1)" :key="n" type="button" class="tile" @click="photoMenu(n + 1)">
              <img :src="p.thumb ?? p.full" alt="" />
            </button>
            <button v-if="canAddPhoto" type="button" class="tile add" :aria-label="t.photo.more" @click="addPhotoMenu">＋</button>
            <span class="count">{{ t.photo.title(photos.length, MAX_PHOTOS) }}</span>
          </div>
          <div class="pills" role="radiogroup" :aria-label="t.item.statusLabel">
            <button
              v-for="st in STATUSES"
              :key="st"
              type="button"
              class="pill"
              role="radio"
              :aria-checked="form.status === st"
              :class="{ on: form.status === st }"
              @click="form.status = st"
            >{{ t.item.status[st] }}</button>
          </div>
        </div>

        <div class="body">
          <p v-if="duplicated" class="hint">{{ t.item.duplicateHint }}</p>
          <p v-else-if="savedInARow && !editing" class="hint">{{ t.item.inARow(savedInARow) }}</p>

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

          <!-- Año y versión lado a lado: los dos son cortos. -->
          <div class="pair">
            <ion-input
              v-if="show('year')"
              v-model="form.year"
              class="field year"
              fill="solid"
              inputmode="numeric"
              :maxlength="4"
              :label="label('year')"
              label-placement="stacked"
              :placeholder="t.item.yearPh"
              :class="invalid('year')"
              :error-text="errors.year"
            />
            <ion-input v-if="show('version')" v-model="form.version" class="field" fill="solid" :label="label('version')" label-placement="stacked" :placeholder="isDefaultLabel(cfg, 'version') ? t.item.versionPh : ''" autocapitalize="sentences" />
          </div>
          <div v-if="show('version') && versions.length" class="chips">
            <button v-for="v in versions" :key="v" type="button" class="chip" :class="{ on: isOn(form.version, v) }" @click="pick('version', v)">{{ v }}</button>
          </div>

          <template v-if="show('size')">
            <ion-input v-model="form.size" class="field" fill="solid" :label="label('size')" label-placement="stacked" :placeholder="isDefaultLabel(cfg, 'size') ? t.item.sizePh : ''" autocapitalize="characters" />
            <div v-if="sizes.length" class="chips">
              <button v-for="sz in sizes" :key="sz" type="button" class="chip" :class="{ on: isOn(form.size, sz) }" @click="pick('size', sz)">{{ sz }}</button>
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

          <button
            v-if="moreLabels.length"
            type="button"
            class="more"
            :aria-expanded="moreOpen"
            @click="moreOpen = !moreOpen"
          >
            <span>
              <strong>{{ t.item.more }}<template v-if="moreFilled && !moreOpen"> · {{ t.item.moreFilled(moreFilled) }}</template></strong>
              <small v-if="!moreOpen">{{ moreHint }}</small>
            </span>
            <ion-icon :icon="moreOpen ? chevronUp : chevronDown" />
          </button>

          <template v-if="moreOpen">
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
          </template>

          <ion-button v-if="!editing" fill="outline" expand="block" class="next" :disabled="saving" @click="save(true)">{{ t.item.saveAndNext }}</ion-button>
          <ion-button v-if="editing" fill="outline" expand="block" class="duplicate" @click="duplicate">{{ t.item.duplicate }}</ion-button>
          <ion-button v-if="editing" fill="clear" color="danger" expand="block" class="delete" @click="removeItem">{{ t.item.delete }}</ion-button>
        </div>
      </form>
      <PhotoViewer :open="viewer.open" :photos="viewer.photos" :start="viewer.start" :title="form.name" @close="viewer.open = false" />
    </ion-content>
  </ion-modal>
</template>

<style scoped>
/* ---------- Arriba: el pastel de la lista ---------- */
.tinted { --background: var(--tint-bg); --color: var(--tint-ink); --border-width: 0; }
.tinted ion-button { --color: var(--tint-ink); }
.hero { background: var(--tint-bg); padding: 0 16px 16px; border-radius: 0 0 24px 24px; }
.head { display: flex; align-items: center; gap: 14px; }
.cover {
  flex: none;
  display: grid;
  place-items: center;
  width: 84px;
  height: 84px;
  padding: 0;
  border: 0;
  border-radius: 20px;
  overflow: hidden;
  background: var(--app-surface);
  color: var(--tint-bar);
  font-size: 30px;
}
.cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cover.empty { box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--tint-bar) 45%, transparent); }
.who { flex: 1; min-width: 0; }
.context { display: block; font-size: 13px; color: var(--tint-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.name {
  --padding-top: 2px;
  --padding-bottom: 4px;
  --highlight-color-focused: var(--tint-bar);
  --highlight-color-invalid: var(--ion-color-danger);
  --placeholder-color: var(--tint-ink);
  --placeholder-opacity: 0.45;
  font-family: var(--app-font-display);
  font-size: 24px;
  font-weight: 600;
  border-bottom: 1.5px solid color-mix(in srgb, var(--tint-ink) 25%, transparent);
}
.strip { display: flex; align-items: center; gap: 8px; margin-top: 12px; overflow-x: auto; scrollbar-width: none; }
.strip::-webkit-scrollbar { display: none; }
.tile {
  flex: none;
  width: 52px;
  height: 52px;
  padding: 0;
  border: 0;
  border-radius: 12px;
  overflow: hidden;
  background: var(--app-surface);
}
.tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
.tile.add { font-size: 24px; color: var(--tint-bar); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--tint-bar) 45%, transparent); }
.count { flex: none; font-size: 12px; color: var(--tint-ink); }
.pills { display: flex; gap: 6px; margin-top: 14px; }
.names { display: flex; gap: 6px; margin-top: 10px; overflow-x: auto; scrollbar-width: none; }
.names::-webkit-scrollbar { display: none; }
.names .pill { flex: none; font-weight: 400; }
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

/* ---------- Abajo: campos suaves, sin la raya de Material ---------- */
.body { padding: 16px; }
.body .field {
  --background: var(--app-surface-2);
  --border-radius: 14px;
  --border-width: 0;
  --highlight-color-focused: var(--tint-bar);
  --padding-start: 14px;
  --padding-end: 14px;
}
.pair { display: flex; gap: 10px; }
.pair .field { flex: 2; min-width: 0; }
.pair .year { flex: 1; }
.hint { margin: 0 0 12px; font-size: 14px; color: var(--app-muted); text-align: center; }
.chips { display: flex; gap: 6px; overflow-x: auto; margin: -4px 0 14px; scrollbar-width: none; }
.chips::-webkit-scrollbar { display: none; }
.chip {
  flex: none;
  border: 0;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 14px;
  color: var(--tint-ink);
  background: color-mix(in srgb, var(--tint-bg) 70%, transparent);
}
.chip.on { color: var(--app-surface); background: var(--tint-ink); font-weight: 600; }
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
  color: var(--tint-ink);
  text-decoration: none;
}
.more {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  margin: 4px 0 14px;
  padding: 14px 4px;
  border: 0;
  border-top: 1px solid var(--app-border);
  border-radius: 0;
  background: none;
  color: var(--tint-ink);
  text-align: left;
  font: inherit;
}
.more span { display: flex; flex-direction: column; min-width: 0; }
.more strong { font-size: 15px; }
.more small { font-size: 13px; color: var(--app-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.more ion-icon { flex: none; font-size: 20px; }
.next, .duplicate { --color: var(--tint-ink); --border-color: color-mix(in srgb, var(--tint-ink) 35%, transparent); --border-radius: 14px; }
.next { margin: 8px 0 24px; }
.duplicate { margin: 8px 0 4px; }
.delete { margin: 0 0 24px; }
</style>

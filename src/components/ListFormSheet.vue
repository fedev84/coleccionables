<script setup lang="ts">
import { IonButton, IonInput, IonModal, alertController } from '@ionic/vue'
import { computed, reactive, ref, watch } from 'vue'
import type { Collection } from '@/domain/models'
import { LIST_EMOJIS, isEmoji } from '@/domain/suggestions'
import { ValidationError } from '@/domain/validation'
import { toast } from '@/platform/toast'
import { useListsStore } from '@/stores/lists'
import { t } from '@/copy/es'

const props = defineProps<{ open: boolean; list?: Collection | null }>()
const emit = defineEmits<{ close: []; created: [list: Collection] }>()

const lists = useListsStore()
const form = reactive({ name: '', emoji: LIST_EMOJIS[0] })
const error = ref('')
const nameInput = ref<InstanceType<typeof IonInput>>()

watch(
  () => props.open,
  (open) => {
    if (!open) return
    error.value = ''
    Object.assign(form, props.list ? { name: props.list.name, emoji: props.list.emoji } : { name: '', emoji: LIST_EMOJIS[0] })
  },
)

/** Un emoji elegido con "Otro" se muestra al principio, marcado. */
const custom = computed(() => (LIST_EMOJIS.includes(form.emoji) ? null : form.emoji))

/** Cualquier emoji, desde el teclado del teléfono. */
async function otherEmoji() {
  const alert = await alertController.create({
    header: t.listForm.otherTitle,
    message: t.listForm.otherHint,
    inputs: [{ name: 'emoji', value: custom.value ?? '', attributes: { maxlength: 16, autocapitalize: 'off' } }],
    buttons: [{ text: t.common.cancel, role: 'cancel' }, { text: t.common.done, role: 'confirm' }],
  })
  await alert.present()
  const { role, data } = await alert.onDidDismiss()
  if (role !== 'confirm') return
  const emoji = String(data?.values?.emoji ?? '').trim()
  if (isEmoji(emoji)) form.emoji = emoji
  else if (emoji) toast(t.listForm.emojiInvalid)
}

async function save() {
  try {
    if (props.list) await lists.update(props.list.id, { ...form })
    else emit('created', await lists.create({ ...form }))
    emit('close')
  } catch (e) {
    if (e instanceof ValidationError) error.value = e.message
    else throw e
  }
}

const focusName = () => !props.list && (nameInput.value?.$el as HTMLIonInputElement | undefined)?.setFocus()
</script>

<template>
  <ion-modal class="auto-sheet" :is-open="open" :initial-breakpoint="1" :breakpoints="[0, 1]" @did-present="focusName" @did-dismiss="emit('close')">
    <form class="sheet" novalidate @submit.prevent="save">
      <h2>{{ list ? t.listForm.editTitle : t.listForm.newTitle }}</h2>
      <ion-input
        ref="nameInput"
        v-model="form.name"
        class="field"
        fill="solid"
        :label="t.listForm.name"
        label-placement="stacked"
        :placeholder="t.listForm.namePh"
        :class="{ 'ion-invalid ion-touched': error }"
        :error-text="error"
        autocapitalize="sentences"
      />
      <div class="emojis">
        <button v-if="custom" type="button" class="emoji on" aria-pressed="true" @click="otherEmoji">{{ custom }}</button>
        <button
          v-for="e in LIST_EMOJIS"
          :key="e"
          type="button"
          class="emoji"
          :class="{ on: form.emoji === e }"
          :aria-pressed="form.emoji === e"
          @click="form.emoji = e"
        >{{ e }}</button>
        <button type="button" class="emoji other" @click="otherEmoji">{{ t.listForm.other }}</button>
      </div>
      <ion-button type="submit" expand="block">{{ list ? t.common.save : t.listForm.create }}</ion-button>
    </form>
  </ion-modal>
</template>

<style scoped>
.emojis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin-bottom: 16px; }
.emoji {
  aspect-ratio: 1;
  font-size: 24px;
  border-radius: 12px;
  border: 2px solid transparent;
  background: var(--app-surface-2);
}
.emoji.on { border-color: var(--ion-color-primary); }
.emoji.other { font-size: 13px; font-weight: 600; color: var(--ion-color-primary); }
</style>

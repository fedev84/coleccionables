<script setup lang="ts">
import { IonButton, IonInput, IonModal } from '@ionic/vue'
import { reactive, ref, watch } from 'vue'
import type { Collection } from '@/domain/models'
import { LIST_EMOJIS } from '@/domain/suggestions'
import { ValidationError } from '@/domain/validation'
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
        <button
          v-for="e in LIST_EMOJIS"
          :key="e"
          type="button"
          class="emoji"
          :class="{ on: form.emoji === e }"
          :aria-pressed="form.emoji === e"
          @click="form.emoji = e"
        >{{ e }}</button>
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
</style>

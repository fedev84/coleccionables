<script setup lang="ts">
/** Miniatura cuadrada; sin foto muestra el emoji de la lista. */
defineProps<{ src: string | null; fallback: string; size?: number }>()
</script>

<template>
  <div class="thumb" :style="{ '--size': `${size ?? 56}px` }">
    <img v-if="src" :src="src" alt="" />
    <span v-else>{{ fallback }}</span>
  </div>
</template>

<style scoped>
.thumb {
  width: var(--size);
  height: var(--size);
  flex: none;
  border-radius: 10px;
  overflow: hidden;
  background: var(--app-surface-2);
  display: grid;
  place-items: center;
  font-size: calc(var(--size) * 0.45);
}
img { width: 100%; height: 100%; object-fit: cover; display: block; }
span { opacity: 0.5; }
</style>

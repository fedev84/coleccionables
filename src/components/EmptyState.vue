<script setup lang="ts">
defineProps<{ emoji: string; title: string; body: string }>()
</script>

<template>
  <div class="empty">
    <div class="emoji">{{ emoji }}</div>
    <h3>{{ title }}</h3>
    <p class="muted">{{ body }}</p>
  </div>
</template>

<style scoped>
.empty { text-align: center; padding: 56px 24px; }
.emoji { font-size: 48px; margin-bottom: 8px; }
h3 { margin: 0 0 6px; font-size: 18px; }
p { margin: 0 auto; max-width: 280px; line-height: 1.4; }
</style>

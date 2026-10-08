<script setup>
defineProps({
  content: {
    type: String,
    default: '',
  },
});
</script>

<template>
  <div class="note-markdown" v-html="content" />
</template>

<style scoped>
.note-markdown :deep(p) {
  margin: 0 0 0.5rem;
}

.note-markdown :deep(p:last-child),
.note-markdown :deep(ul:last-child),
.note-markdown :deep(ol:last-child) {
  margin-bottom: 0;
}

.note-markdown :deep(ul) {
  list-style: disc;
  margin: 0.5rem 0;
  padding-inline-start: 1.25rem;
}

.note-markdown :deep(ol) {
  list-style: decimal;
  margin: 0.5rem 0;
  padding-inline-start: 1.25rem;
}

.note-markdown :deep(a) {
  color: #2563eb;
  text-decoration: underline;
}

.dark .note-markdown :deep(a) {
  color: #60a5fa;
}
</style>

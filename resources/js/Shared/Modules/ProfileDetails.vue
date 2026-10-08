<template>
  <section class="mb-8 space-y-5 text-sm">
    <details class="rounded-lg border border-gray-200 p-3 dark:border-gray-700" open>
      <summary class="cursor-pointer font-semibold">{{ $t('Work history') }}</summary>
      <ul class="mt-3 space-y-3">
        <li v-for="job in employments" :key="job.id" class="flex justify-between gap-2">
          <div>
            <div class="font-medium">{{ job.position || job.employer }}</div>
            <div v-if="job.position" class="text-gray-600 dark:text-gray-300">{{ job.employer }}</div>
            <div class="text-xs text-gray-500">{{ period(job) }}</div>
          </div>
          <button class="text-red-500" type="button" @click="removeEmployment(job)">{{ $t('Remove') }}</button>
        </li>
      </ul>
      <form class="mt-3 space-y-2" @submit.prevent="addEmployment">
        <input
          v-model="job.employer"
          class="w-full rounded border-gray-300 text-sm dark:bg-gray-800"
          :placeholder="$t('Company or organization')"
          required />
        <input
          v-model="job.position"
          class="w-full rounded border-gray-300 text-sm dark:bg-gray-800"
          :placeholder="$t('Position')" />
        <div class="grid grid-cols-2 gap-2">
          <input
            v-model="job.started_on"
            class="rounded border-gray-300 text-sm dark:bg-gray-800"
            type="date"
            :aria-label="$t('Start date')" />
          <input
            v-model="job.ended_on"
            class="rounded border-gray-300 text-sm dark:bg-gray-800"
            type="date"
            :aria-label="$t('End date')"
            :disabled="job.is_current" />
        </div>
        <label class="flex items-center gap-2"
          ><input v-model="job.is_current" type="checkbox" />{{ $t('Works here now') }}</label
        >
        <button class="text-blue-500 hover:underline" type="submit">{{ $t('Add work history') }}</button>
      </form>
    </details>

    <details class="rounded-lg border border-gray-200 p-3 dark:border-gray-700" open>
      <summary class="cursor-pointer font-semibold">{{ $t('Interests, skills and groups') }}</summary>
      <div class="mt-3 space-y-4">
        <div v-for="kind in ['interest', 'skill']" :key="kind">
          <h3 class="mb-2 font-semibold">{{ kind === 'interest' ? $t('Interests') : $t('Skills') }}</h3>
          <ul class="mb-2 flex flex-wrap gap-2">
            <li v-for="tag in tags[kind]" :key="tag.id" class="rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-800">
              {{ tag.name }}
              <button class="ms-1 text-red-500" type="button" :aria-label="$t('Remove')" @click="removeTag(tag)">
                ×
              </button>
            </li>
          </ul>
          <form class="flex gap-2" @submit.prevent="addTag(kind)">
            <input
              v-model="tagInput[kind]"
              class="min-w-0 flex-1 rounded border-gray-300 text-sm dark:bg-gray-800"
              :placeholder="kind === 'interest' ? $t('Add an interest') : $t('Add a skill')" />
            <button class="text-blue-500 hover:underline" type="submit">{{ $t('Add') }}</button>
          </form>
        </div>
        <Groups :data="data.groups" />
      </div>
    </details>
  </section>
</template>

<script setup>
import { reactive, ref } from 'vue';
import Groups from '@/Shared/Modules/Groups.vue';

const props = defineProps({
  data: { type: Object, required: true },
});
const employments = ref(props.data.employments || []);
const tags = reactive({ interest: props.data.interests || [], skill: props.data.skills || [] });
const job = reactive({ employer: '', position: '', started_on: '', ended_on: '', is_current: false });
const tagInput = reactive({ interest: '', skill: '' });

const addEmployment = async () => {
  const response = await axios.post(props.data.url.employments, job);
  employments.value.unshift(response.data.data);
  Object.assign(job, { employer: '', position: '', started_on: '', ended_on: '', is_current: false });
};
const removeEmployment = async (item) => {
  await axios.delete(`${props.data.url.employments}/${item.id}`);
  employments.value = employments.value.filter((entry) => entry.id !== item.id);
};
const addTag = async (kind) => {
  const name = tagInput[kind].trim();
  if (!name) return;
  const response = await axios.post(props.data.url.tags, { kind, name });
  if (!tags[kind].some((tag) => tag.id === response.data.data.id)) tags[kind].push(response.data.data);
  tagInput[kind] = '';
};
const removeTag = async (tag) => {
  await axios.delete(`${props.data.url.tags}/${tag.id}`);
  tags[tag.kind] = tags[tag.kind].filter((entry) => entry.id !== tag.id);
};
const period = (item) => {
  const start = item.started_on ? item.started_on.slice(0, 10) : '';
  const end = item.is_current ? 'Present' : item.ended_on ? item.ended_on.slice(0, 10) : '';
  return [start, end].filter(Boolean).join(' – ');
};
</script>

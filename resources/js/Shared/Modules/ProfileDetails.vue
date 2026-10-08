<template>
  <section class="mb-8 space-y-5 text-sm">
    <details class="rounded-lg border border-gray-200 p-3 dark:border-gray-700" open>
      <summary class="cursor-pointer font-semibold">{{ $t('Work history') }}</summary>
      <ul class="mt-3 space-y-3">
        <li v-for="employment in employments" :key="employment.id" class="flex justify-between gap-2">
          <div>
            <div class="font-medium">{{ employment.position || employment.employer }}</div>
            <div v-if="employment.position" class="text-gray-600 dark:text-gray-300">{{ employment.employer }}</div>
            <div class="text-xs text-gray-500">{{ period(employment) }}</div>
          </div>
          <button class="text-red-500" type="button" @click="removeEmployment(employment)">{{ $t('Remove') }}</button>
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

    <details class="rounded-lg border border-gray-200 p-3 dark:border-gray-700" open>
      <summary class="cursor-pointer font-semibold">{{ $t('Personality') }}</summary>
      <div class="mt-3 space-y-5">
        <div class="space-y-4">
          <label class="block">
            <span class="mb-1 block font-medium">{{ $t('Myers-Briggs type') }}</span>
            <select
              v-model="personality.myers_briggs_type"
              class="w-full rounded border-gray-300 text-sm dark:bg-gray-800"
              @change="savePersonality">
              <option value="">{{ $t('Not set') }}</option>
              <option v-for="type in myersBriggsTypes" :key="type.code" :value="type.code">
                {{ type.code }} - {{ $t(type.name) }}
              </option>
            </select>
          </label>

          <label class="block">
            <span class="mb-1 block font-medium">{{ $t('Enneagram type') }}</span>
            <select
              v-model="personality.enneagram_type"
              class="w-full rounded border-gray-300 text-sm dark:bg-gray-800"
              @change="savePersonality">
              <option value="">{{ $t('Not set') }}</option>
              <option v-for="type in enneagramTypes" :key="type.number" :value="type.number">
                {{ $t('Type :number - :name', { number: type.number, name: $t(type.name) }) }}
              </option>
            </select>
          </label>
        </div>

        <div>
          <div class="mb-1 font-medium">{{ $t('Working Genius') }}</div>
          <div class="grid gap-4 sm:grid-cols-2">
            <fieldset>
              <legend class="mb-2 font-medium">
                {{ $t('Strengths') }} ({{ personality.working_genius_strengths.length }}/3)
              </legend>
              <select
                class="w-full rounded border-gray-300 text-sm dark:bg-gray-800"
                :disabled="personality.working_genius_strengths.length >= 3"
                @change="selectWorkingGenius('strengths', $event)">
                <option value="">{{ $t('Select a strength') }}</option>
                <option
                  v-for="genius in workingGeniusTypes"
                  :key="`strength-option-${genius}`"
                  :value="genius"
                  :disabled="workingGeniusDisabled('strengths', genius)">
                  {{ $t(genius) }}
                </option>
              </select>
              <ul class="mt-2 flex flex-wrap gap-2">
                <li
                  v-for="genius in personality.working_genius_strengths"
                  :key="`strength-chip-${genius}`"
                  class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">
                  {{ $t(genius) }}
                  <button
                    type="button"
                    :aria-label="$t('Remove :name', { name: $t(genius) })"
                    @click="removeWorkingGenius('strengths', genius)">
                    ×
                  </button>
                </li>
              </ul>
            </fieldset>
            <fieldset>
              <legend class="mb-2 font-medium">
                {{ $t('Weaknesses') }} ({{ personality.working_genius_weaknesses.length }}/3)
              </legend>
              <select
                class="w-full rounded border-gray-300 text-sm dark:bg-gray-800"
                :disabled="personality.working_genius_weaknesses.length >= 3"
                @change="selectWorkingGenius('weaknesses', $event)">
                <option value="">{{ $t('Select a weakness') }}</option>
                <option
                  v-for="genius in workingGeniusTypes"
                  :key="`weakness-option-${genius}`"
                  :value="genius"
                  :disabled="workingGeniusDisabled('weaknesses', genius)">
                  {{ $t(genius) }}
                </option>
              </select>
              <ul class="mt-2 flex flex-wrap gap-2">
                <li
                  v-for="genius in personality.working_genius_weaknesses"
                  :key="`weakness-chip-${genius}`"
                  class="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs text-rose-900 dark:bg-rose-900 dark:text-rose-100">
                  {{ $t(genius) }}
                  <button
                    type="button"
                    :aria-label="$t('Remove :name', { name: $t(genius) })"
                    @click="removeWorkingGenius('weaknesses', genius)">
                    ×
                  </button>
                </li>
              </ul>
            </fieldset>
          </div>
          <button
            v-if="personality.working_genius_strengths.length || personality.working_genius_weaknesses.length"
            class="mt-1 text-xs text-gray-600 underline dark:text-gray-300"
            type="button"
            @click="clearWorkingGenius">
            {{ $t('Clear Working Genius selections') }}
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-3" aria-live="polite">
          <span v-if="personalitySaving" class="text-xs text-gray-600 dark:text-gray-300">{{ $t('Saving…') }}</span>
          <span v-if="personalitySaved" class="text-xs text-green-700 dark:text-green-400">{{
            $t('Personality saved')
          }}</span>
          <span v-if="personalityError" class="text-xs text-red-600">{{ personalityError }}</span>
        </div>
      </div>
    </details>
  </section>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { trans } from 'laravel-vue-i18n';
import Groups from '@/Shared/Modules/Groups.vue';

const props = defineProps({
  data: { type: Object, required: true },
});
const employments = ref(props.data.employments || []);
const tags = reactive({ interest: props.data.interests || [], skill: props.data.skills || [] });
const job = reactive({ employer: '', position: '', started_on: '', ended_on: '', is_current: false });
const tagInput = reactive({ interest: '', skill: '' });
const profile = props.data.personality || {};
const personality = reactive({
  myers_briggs_type: profile.myers_briggs_type || '',
  enneagram_type: profile.enneagram_type || '',
  working_genius_strengths: profile.working_genius_strengths || [],
  working_genius_weaknesses: profile.working_genius_weaknesses || [],
});
const personalitySaving = ref(false);
const personalitySaved = ref(false);
const personalityError = ref('');
const myersBriggsTypes = [
  { code: 'ISTJ', name: 'Logistician' },
  { code: 'ISFJ', name: 'Defender' },
  { code: 'INFJ', name: 'Advocate' },
  { code: 'INTJ', name: 'Architect' },
  { code: 'ISTP', name: 'Virtuoso' },
  { code: 'ISFP', name: 'Adventurer' },
  { code: 'INFP', name: 'Mediator' },
  { code: 'INTP', name: 'Logician' },
  { code: 'ESTP', name: 'Entrepreneur' },
  { code: 'ESFP', name: 'Entertainer' },
  { code: 'ENFP', name: 'Campaigner' },
  { code: 'ENTP', name: 'Debater' },
  { code: 'ESTJ', name: 'Executive' },
  { code: 'ESFJ', name: 'Consul' },
  { code: 'ENFJ', name: 'Protagonist' },
  { code: 'ENTJ', name: 'Commander' },
];
const enneagramTypes = [
  { number: 1, name: 'Reformer' },
  { number: 2, name: 'Helper' },
  { number: 3, name: 'Achiever' },
  { number: 4, name: 'Individualist' },
  { number: 5, name: 'Investigator' },
  { number: 6, name: 'Loyalist' },
  { number: 7, name: 'Enthusiast' },
  { number: 8, name: 'Challenger' },
  { number: 9, name: 'Peacemaker' },
];
const workingGeniusTypes = ['Wonder', 'Invention', 'Discernment', 'Galvanizing', 'Enablement', 'Tenacity'];
let personalitySaveQueued = false;
let personalityChangeVersion = 0;

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
const selectWorkingGenius = (kind, event) => {
  const genius = event.target.value;
  if (!genius) return;
  const list = kind === 'strengths' ? 'working_genius_strengths' : 'working_genius_weaknesses';
  if (
    personality[list].length < 3 &&
    !personality.working_genius_strengths.includes(genius) &&
    !personality.working_genius_weaknesses.includes(genius)
  ) {
    personality[list] = [...personality[list], genius];
    savePersonality();
  }
  event.target.value = '';
};
const removeWorkingGenius = (kind, genius) => {
  const list = kind === 'strengths' ? 'working_genius_strengths' : 'working_genius_weaknesses';
  personality[list] = personality[list].filter((item) => item !== genius);
  savePersonality();
};
const workingGeniusDisabled = (list, genius) => {
  const otherList = list === 'strengths' ? 'working_genius_weaknesses' : 'working_genius_strengths';
  const ownList = list === 'strengths' ? 'working_genius_strengths' : 'working_genius_weaknesses';
  return (
    (!personality[ownList].includes(genius) && personality[ownList].length >= 3) ||
    personality[otherList].includes(genius)
  );
};
const clearWorkingGenius = () => {
  personality.working_genius_strengths = [];
  personality.working_genius_weaknesses = [];
  savePersonality();
};
const savePersonality = async () => {
  personalityChangeVersion++;
  personalitySaved.value = false;
  personalityError.value = '';
  if (personalitySaving.value) {
    personalitySaveQueued = true;
    return;
  }

  personalitySaving.value = true;
  do {
    personalitySaveQueued = false;
    const requestVersion = personalityChangeVersion;
    try {
      await axios.put(props.data.url.personality, {
        myers_briggs_type: personality.myers_briggs_type || null,
        enneagram_type: personality.enneagram_type || null,
        working_genius_strengths: personality.working_genius_strengths,
        working_genius_weaknesses: personality.working_genius_weaknesses,
      });
      if (requestVersion === personalityChangeVersion) personalitySaved.value = true;
    } catch (error) {
      if (requestVersion === personalityChangeVersion) {
        const errors = error.response?.data?.errors;
        personalityError.value = errors
          ? Object.values(errors).flat().join(' ')
          : trans('Unable to save personality details.');
      }
    }
  } while (personalitySaveQueued);
  personalitySaving.value = false;
};
const period = (item) => {
  const start = item.started_on ? item.started_on.slice(0, 10) : '';
  const end = item.is_current ? 'Present' : item.ended_on ? item.ended_on.slice(0, 10) : '';
  return [start, end].filter(Boolean).join(' – ');
};
</script>

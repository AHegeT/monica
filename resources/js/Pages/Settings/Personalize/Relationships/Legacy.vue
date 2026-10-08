<template>
  <layout :layout-data="layoutData">
    <nav class="border-b border-gray-200 dark:border-gray-700 sm:mt-20">
      <div class="mx-auto hidden max-w-8xl px-4 py-2 sm:px-6 md:block">
        <ul class="text-sm">
          <li class="me-2 inline text-gray-600 dark:text-gray-400">{{ $t('You are here:') }}</li>
          <li class="me-2 inline">
            <InertiaLink :href="data.url.settings" class="text-blue-500 hover:underline">
              {{ $t('Settings') }}
            </InertiaLink>
          </li>
          <li class="me-2 inline text-gray-400">›</li>
          <li class="me-2 inline">
            <InertiaLink :href="data.url.relationship_types" class="text-blue-500 hover:underline">
              {{ $t('Relationship types') }}
            </InertiaLink>
          </li>
          <li class="me-2 inline text-gray-400">›</li>
          <li class="inline">{{ $t('Review old relationships') }}</li>
        </ul>
      </div>
    </nav>

    <main class="relative sm:mt-16">
      <div class="mx-auto max-w-5xl px-2 py-6 sm:px-6 lg:px-8">
        <div class="mb-6">
          <h1 class="mb-3 text-2xl font-semibold">{{ $t('Review old relationships') }}</h1>
          <p class="mb-3 text-sm text-gray-700 dark:text-gray-300">
            {{
              $t(
                'These are relationships stored in custom groups whose names duplicate built-in groups. Choose a new relationship type for each entry, then save it here. The existing relationship record and closeness level are preserved.',
              )
            }}
          </p>
          <p
            class="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            {{
              $t(
                'A pair can appear more than once if the database has separate entries in both directions. Choose the direction carefully: unless you check Swap direction, the contact on the left gets the first role in the new type.',
              )
            }}
          </p>
        </div>

        <div v-if="data.legacy_groups.length" class="mb-5 text-sm text-gray-600 dark:text-gray-400">
          {{ $t('Duplicate custom groups:') }}
          <span v-for="(group, index) in data.legacy_groups" :key="group.id">
            {{ index ? ', ' : '' }}{{ group.name }}
          </span>
        </div>

        <p class="mb-5 text-sm text-gray-700 dark:text-gray-300">
          {{
            $t(
              'After the review list is empty, return to Relationship types and delete the duplicate custom groups. Deleting a group with relationships still attached removes those relationships.',
            )
          }}
          <InertiaLink
            :href="data.url.relationship_types"
            class="ms-1 text-blue-600 hover:underline dark:text-blue-400">
            {{ $t('Relationship types') }}
          </InertiaLink>
        </p>

        <div
          v-if="localRelationships.length"
          class="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div
            v-for="relationship in localRelationships"
            :key="relationship.id"
            class="border-b border-gray-200 p-4 last:border-b-0 dark:border-gray-700">
            <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ relationship.group_name }} · {{ $t('Old relationship') }}
            </div>
            <div class="flex flex-wrap items-center gap-2 text-sm">
              <InertiaLink :href="relationship.contact.url" class="text-blue-600 hover:underline dark:text-blue-400">
                {{ relationship.contact.name }}
              </InertiaLink>
              <span class="rounded bg-gray-100 px-2 py-1 dark:bg-gray-800">{{ relationship.from_role }}</span>
              <span aria-hidden="true" class="text-gray-500">↔</span>
              <span class="rounded bg-gray-100 px-2 py-1 dark:bg-gray-800">{{ relationship.to_role }}</span>
              <InertiaLink
                :href="relationship.related_contact.url"
                class="text-blue-600 hover:underline dark:text-blue-400">
                {{ relationship.related_contact.name }}
              </InertiaLink>
            </div>
            <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {{ $t('Relationship record #:id', { id: relationship.id }) }}
            </div>
            <form
              class="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
              @submit.prevent="updateRelationship(relationship)">
              <div>
                <label :for="`target-type-${relationship.id}`" class="mb-1 block text-xs font-medium">
                  {{ $t('Move to relationship type') }}
                </label>
                <select
                  :id="`target-type-${relationship.id}`"
                  v-model="relationship.targetTypeId"
                  required
                  class="w-full rounded-md border-gray-300 bg-white text-sm dark:border-gray-700 dark:bg-gray-900">
                  <option value="">{{ $t('Choose a relationship type') }}</option>
                  <optgroup v-for="group in data.target_groups" :key="group.id" :label="group.name">
                    <option v-for="type in group.types" :key="type.id" :value="type.id">
                      {{ type.name }} ↔ {{ type.reverse_name }}
                    </option>
                  </optgroup>
                </select>
                <label class="mt-2 flex items-center gap-2 text-xs">
                  <input v-model="relationship.swapDirection" type="checkbox" class="rounded border-gray-300" />
                  {{ $t('Swap direction') }}
                </label>
                <p v-if="selectedType(relationship)" class="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  {{ $t('After mapping:') }}
                  {{ relationship.swapDirection ? relationship.related_contact.name : relationship.contact.name }}
                  — {{ selectedType(relationship).name }} ↔
                  {{ relationship.swapDirection ? relationship.contact.name : relationship.related_contact.name }}
                  — {{ selectedType(relationship).reverse_name }}
                </p>
                <p v-if="relationship.error" class="mt-2 text-xs text-red-600">{{ $t(relationship.error) }}</p>
              </div>
              <div class="flex items-end">
                <button
                  type="submit"
                  :disabled="relationship.saving || !relationship.targetTypeId"
                  class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {{ relationship.saving ? $t('Saving…') : $t('Update relationship') }}
                </button>
              </div>
            </form>
          </div>
        </div>
        <p v-else class="rounded-lg border border-gray-200 bg-white p-5 text-sm dark:border-gray-700 dark:bg-gray-900">
          {{ $t('No relationships are using the duplicate custom groups.') }}
        </p>

        <div v-if="data.relationships.last_page > 1" class="mt-5 flex flex-wrap gap-2">
          <template v-for="link in data.relationships.links" :key="link.label">
            <InertiaLink
              v-if="link.url"
              :href="link.url"
              class="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              :class="{ 'font-semibold text-blue-600': link.active }">
              {{ paginationLabel(link.label) }}
            </InertiaLink>
            <span v-else class="rounded border border-gray-200 px-3 py-2 text-sm text-gray-400 dark:border-gray-800">
              {{ paginationLabel(link.label) }}
            </span>
          </template>
        </div>
      </div>
    </main>
  </layout>
</template>

<script setup>
import { ref, watch } from 'vue';
import { router } from '@inertiajs/vue3';

const props = defineProps({
  layoutData: { type: Object, required: true },
  data: { type: Object, required: true },
});

const paginationLabel = (label) =>
  label
    .replace(/<[^>]*>/g, '')
    .replaceAll('&laquo;', '‹')
    .replaceAll('&raquo;', '›')
    .replaceAll('&hellip;', '…');

const prepareRelationships = (relationships) =>
  relationships.map((relationship) => ({
    ...relationship,
    targetTypeId: '',
    swapDirection: false,
    saving: false,
    error: '',
  }));

const localRelationships = ref(prepareRelationships(props.data.relationships.data));

const selectedType = (relationship) => {
  for (const group of props.data.target_groups) {
    const type = group.types.find((item) => item.id == relationship.targetTypeId);
    if (type) return type;
  }

  return null;
};

watch(
  () => props.data.relationships.data,
  (relationships) => {
    localRelationships.value = prepareRelationships(relationships);
  },
);

const updateRelationship = (relationship) => {
  relationship.saving = true;
  relationship.error = '';

  axios
    .put(relationship.url.update, {
      relationship_type_id: relationship.targetTypeId,
      swap_direction: relationship.swapDirection,
    })
    .then(() => {
      router.reload({ only: ['data'], preserveScroll: true });
    })
    .catch(() => {
      relationship.error = 'Unable to update this relationship. Refresh the page and try again.';
      relationship.saving = false;
    });
};
</script>

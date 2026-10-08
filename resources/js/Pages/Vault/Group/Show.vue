<script setup>
import { ref, reactive } from 'vue';
import { Link, router } from '@inertiajs/vue3';
import { trans } from 'laravel-vue-i18n';
import Layout from '@/Layouts/Layout.vue';
import Avatar from '@/Shared/Avatar.vue';
import JetConfirmationModal from '@/Components/Jetstream/ConfirmationModal.vue';
import JetDangerButton from '@/Components/Jetstream/DangerButton.vue';
import JetSecondaryButton from '@/Components/Jetstream/SecondaryButton.vue';
import ContactSelector from '@/Shared/Form/ContactSelector.vue';

const props = defineProps({
  layoutData: Object,
  data: Object,
});

const deletingGroup = ref(false);
const selectedContacts = ref([]);
const addingContacts = ref(false);
const addContactsError = ref('');
const deleteGroupForm = reactive({
  processing: false,
});

const addContacts = () => {
  if (selectedContacts.value.length === 0 || addingContacts.value) {
    return;
  }

  addingContacts.value = true;
  addContactsError.value = '';
  axios
    .post(props.data.url.add_contacts, {
      contact_ids: selectedContacts.value.map((contact) => contact.id),
    })
    .then(() => {
      selectedContacts.value = [];
      localStorage.success = trans('Contacts added to group');
      router.reload({ preserveScroll: true });
    })
    .catch((error) => {
      addContactsError.value = error.response?.data?.message || trans('Something went wrong');
    })
    .finally(() => {
      addingContacts.value = false;
    });
};

const destroy = () => {
  deleteGroupForm.processing = true;

  axios
    .delete(props.data.url.destroy)
    .then((response) => {
      deleteGroupForm.processing = false;

      localStorage.success = trans('The group has been deleted');
      router.visit(response.data.data);
    })
    .catch((error) => {
      deleteGroupForm.processing = false;
      form.errors = error.response.data;
    });
};
</script>

<template>
  <layout :layout-data="layoutData" :inside-vault="true">
    <!-- breadcrumb -->
    <nav class="bg-white dark:bg-gray-900 sm:mt-20 sm:border-b">
      <div class="max-w-8xl mx-auto hidden px-4 py-2 sm:px-6 md:block">
        <div class="flex items-baseline justify-between space-x-6">
          <ul class="text-sm">
            <li class="me-2 inline text-gray-600 dark:text-gray-400">
              {{ $t('You are here:') }}
            </li>
            <li class="me-2 inline">
              <Link :href="layoutData.vault.url.groups" class="text-blue-500 hover:underline">
                {{ $t('Groups') }}
              </Link>
            </li>
            <li class="relative me-2 inline">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="icon-breadcrumb relative inline h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </li>
            <li class="inline">
              {{ data.name }}
            </li>
          </ul>
        </div>
      </div>
    </nav>

    <main class="sm:mt-18 relative">
      <div class="mx-auto max-w-6xl px-2 py-2 sm:px-6 sm:py-6 lg:px-8">
        <!-- group title -->
        <h1 class="mb-2 text-center text-2xl">{{ data.name }}</h1>

        <!-- group information -->
        <div class="mb-8 flex justify-center">
          <!-- number of contacts -->
          <div class="me-8 flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="me-1 h-4 w-4">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>

            <p class="text-center text-gray-600">
              {{ $tChoice(':count contact|:count contacts', data.contact_count, { count: data.contact_count }) }}
            </p>
          </div>

          <!-- type -->
          <div v-if="data.type.label" class="me-8 flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="me-1 h-4 w-4">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>

            <p class="text-center text-gray-600">{{ $t('Group type: :name', { name: data.type.label }) }}</p>
          </div>

          <!-- actions -->
          <div class="flex items-center">
            <ul class="list">
              <li class="me-4 inline">
                <Link :href="data.url.edit" class="text-blue-500 hover:underline">{{ $t('Edit') }}</Link>
              </li>
              <li class="inline" @click="deletingGroup = true">
                <span class="inline cursor-pointer text-red-500 hover:text-red-900">{{ $t('Delete') }}</span>
              </li>
            </ul>
          </div>
        </div>

        <section
          v-if="layoutData.vault.permission.at_least_editor"
          class="mb-8 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <h2 class="mb-3 text-lg font-semibold">{{ $t('Add contacts to this group') }}</h2>
          <ContactSelector
            v-model="selectedContacts"
            :add-multiple-contacts="true"
            :excluded-ids="data.contact_ids"
            :search-url="layoutData.vault.url.search_contacts_only"
            :label="$t('Search contacts')"
            :required="true" />
          <button
            type="button"
            class="mt-3 rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="selectedContacts.length === 0 || addingContacts"
            @click="addContacts">
            {{ addingContacts ? $t('Adding…') : $t('Add selected contacts') }}
          </button>
          <p v-if="addContactsError" class="mt-2 text-sm text-red-600" role="alert">
            {{ addContactsError }}
          </p>
        </section>

        <!-- contacts by roles -->
        <div v-for="role in data.roles" :key="role.id" class="mb-8">
          <p
            v-if="role.contacts.length > 0"
            class="mb-2 me-2 inline-block rounded-xs bg-neutral-200 px-2 py-1 text-xs font-semibold text-neutral-800 last:me-0">
            {{ role.label }}
          </p>

          <div v-if="role.contacts.length > 0" class="grid grid-cols-3 gap-x-12 gap-y-6 sm:grid-cols-4">
            <div
              v-for="contact in role.contacts"
              :key="contact.id"
              class="rounded-lg border border-gray-200 bg-white p-3 text-center hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-slate-800">
              <avatar :data="contact.avatar" :class="'inline-block h-14 w-14 rounded-full'" />

              <Link :href="contact.url" class="text-blue-500 hover:underline">{{ contact.name }}</Link>

              <span v-if="contact.age" class="ms-1 text-xs text-gray-500">({{ contact.age }})</span>
            </div>
          </div>
        </div>

        <!-- Delete Contact Confirmation Modal -->
        <JetConfirmationModal :show="deletingGroup" @close="deletingGroup = false">
          <template #title>
            {{ $t('Delete group') }}
          </template>

          <template #content>
            {{ $t('Are you sure? This action cannot be undone.') }}
          </template>

          <template #footer>
            <JetSecondaryButton @click="deletingGroup = false">
              {{ $t('Cancel') }}
            </JetSecondaryButton>

            <JetDangerButton
              class="ms-3"
              :class="{ 'opacity-25': deleteGroupForm.processing }"
              :disabled="deleteGroupForm.processing"
              @click="destroy">
              {{ $t('Delete') }}
            </JetDangerButton>
          </template>
        </JetConfirmationModal>
      </div>
    </main>
  </layout>
</template>

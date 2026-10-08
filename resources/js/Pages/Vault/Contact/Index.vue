<script setup>
import { router, useForm, Link } from '@inertiajs/vue3';
import { ref, watch } from 'vue';
import { trans } from 'laravel-vue-i18n';
import Layout from '@/Layouts/Layout.vue';
import PrettyLink from '@/Shared/Form/PrettyLink.vue';
import Avatar from '@/Shared/Avatar.vue';
import Pagination from '@/Components/Pagination.vue';
import Dropdown from '@/Shared/Form/Dropdown.vue';

const props = defineProps({
  layoutData: Object,
  data: Object,
  paginator: Object,
});

const form = useForm({
  sort_order: props.data.user_contact_sort_order,
});
const searchTerm = ref(props.data.search_term || '');
let searchTimeout;

watch(
  () => props.data.search_term,
  (value) => {
    searchTerm.value = value || '';
  },
);

const filterContacts = () => {
  window.clearTimeout(searchTimeout);
  searchTimeout = window.setTimeout(() => {
    router.get(
      props.data.url.contact.index,
      { search: searchTerm.value || undefined },
      { preserveState: true, preserveScroll: true, replace: true },
    );
  }, 300);
};

const update = () => {
  axios.put(props.data.url.sort.update, form).then((response) => {
    localStorage.success = trans('Changes saved');
    router.visit(response.data.data);
  });
};
</script>

<template>
  <layout :title="$t('Contacts')" :layout-data="layoutData" :inside-vault="true">
    <main class="relative sm:mt-24">
      <div class="mx-auto max-w-6xl px-2 py-2 sm:px-6 sm:py-6 lg:px-8">
        <div class="special-grid grid grid-cols-1 gap-6 sm:grid-cols-3">
          <!-- left -->
          <div>
            <!-- labels -->
            <div class="mb-8">
              <div class="mb-3 border-b border-gray-200 dark:border-gray-700">{{ $t('Labels') }}</div>
              <ul v-if="data.labels.length > 0">
                <li class="mb-1">
                  <div v-if="data.current_label">
                    <Link :href="data.url.contact.index" class="text-blue-500 hover:underline">
                      {{ $t('View all') }}
                    </Link>
                  </div>
                  <div v-if="!data.current_label">
                    {{ $t('View all') }}
                  </div>
                </li>
                <li v-for="label in data.labels" :key="label.id" class="mb-1">
                  <div v-if="label.id !== data.current_label">
                    <Link :href="label.url.show" class="text-blue-500 hover:underline">
                      {{ label.name }}
                    </Link>
                    <span class="text-sm text-gray-500">({{ label.count }})</span>
                  </div>
                  <div v-if="label.id === data.current_label">
                    {{ label.name }} <span class="text-sm text-gray-500">({{ label.count }})</span>
                  </div>
                </li>
              </ul>

              <p v-else class="text-sm text-gray-500">
                {{ $t('No labels yet.') }}
              </p>
            </div>
          </div>

          <!-- right -->
          <div class="p-3 sm:px-3 sm:py-0">
            <!-- title + cta -->
            <div class="mb-3 flex items-center justify-between">
              <h3>{{ $t('All contacts in the vault') }}</h3>

              <div class="flex items-center">
                <dropdown
                  v-model="form.sort_order"
                  :data="data.contact_sort_orders"
                  :required="false"
                  :dropdown-class="'block w-full me-2'"
                  @change="update()" />

                <pretty-link
                  v-if="layoutData.vault.permission.at_least_editor"
                  :href="data.url.contact.create"
                  :text="$t('Add a contact')"
                  class="ms-3"
                  :icon="'plus'" />
              </div>
            </div>

            <label class="mb-4 block">
              <span class="sr-only">{{ $t('Search contacts by name') }}</span>
              <input
                v-model="searchTerm"
                type="search"
                class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-xs focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900"
                :placeholder="$t('Search contacts by name')"
                @input="filterContacts" />
            </label>

            <!-- contact list -->
            <ul
              class="contact-list mb-6 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
              <li
                v-for="contact in data.contacts"
                :key="contact.id"
                class="flex items-center border-b border-gray-200 px-5 py-2 hover:bg-slate-50 dark:border-gray-700 dark:bg-slate-900 dark:hover:bg-slate-800">
                <avatar :data="contact.avatar" :class="'me-2 h-5 w-5 rounded-full'" />

                <Link :href="contact.url.show" class="text-blue-500 hover:underline">
                  {{ contact.name }}
                </Link>
              </li>
            </ul>
            <p v-if="data.contacts.length === 0" class="mb-6 text-sm text-gray-500">
              {{ searchTerm ? $t('No contacts match your search.') : $t('No contacts in this vault yet.') }}
            </p>

            <!-- pagination -->
            <Pagination :items="paginator" />
          </div>
        </div>
      </div>
    </main>
  </layout>
</template>

<style lang="scss" scoped>
.contact-list {
  li:hover:first-child {
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
  }

  li:last-child {
    border-bottom: 0;
  }

  li:hover:last-child {
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
  }
}

.special-grid {
  grid-template-columns: 200px 1fr;
}

@media (max-width: 480px) {
  .special-grid {
    grid-template-columns: 1fr;
  }
}
</style>

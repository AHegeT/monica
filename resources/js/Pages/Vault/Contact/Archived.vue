<script setup>
import { Link } from '@inertiajs/vue3';
import Layout from '@/Layouts/Layout.vue';
import Avatar from '@/Shared/Avatar.vue';
import Pagination from '@/Components/Pagination.vue';

defineProps({
  layoutData: Object,
  data: Object,
  paginator: Object,
});
</script>

<template>
  <layout :title="$t('Archived contacts')" :layout-data="layoutData" :inside-vault="true">
    <main class="relative sm:mt-24">
      <div class="mx-auto max-w-6xl px-2 py-2 sm:px-6 sm:py-6 lg:px-8">
        <h1 class="mb-4 text-xl font-semibold">{{ $t('Archived contacts') }}</h1>
        <p v-if="data.contacts.length === 0" class="mb-6 text-sm text-gray-500">
          {{ $t('There are no archived contacts in this vault.') }}
        </p>
        <ul v-else class="mb-6 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <li
            v-for="contact in data.contacts"
            :key="contact.id"
            class="flex items-center border-b border-gray-200 px-5 py-2 last:border-b-0 hover:bg-slate-50 dark:border-gray-700 dark:hover:bg-slate-800">
            <avatar :data="contact.avatar" :class="'me-2 h-5 w-5 rounded-full'" />
            <Link :href="contact.url.show" class="text-blue-500 hover:underline">
              {{ contact.name }}
            </Link>
          </li>
        </ul>
        <Pagination :items="paginator" />
      </div>
    </main>
  </layout>
</template>

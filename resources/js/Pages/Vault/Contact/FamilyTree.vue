<script setup>
import { computed } from 'vue';
import { Link } from '@inertiajs/vue3';
import { ArrowLeft, ContactRound, Network } from 'lucide-vue-next';
import Layout from '@/Layouts/Layout.vue';

const props = defineProps({
  layoutData: Object,
  data: Object,
});

const root = computed(() => props.data.nodes.find((node) => node.id === props.data.root_id));
const relativesByDepth = computed(() => {
  const levels = new Map();
  props.data.nodes
    .filter((node) => node.depth > 0)
    .forEach((node) => {
      if (!levels.has(node.depth)) {
        levels.set(node.depth, []);
      }
      levels.get(node.depth).push(node);
    });

  return [...levels.entries()].map(([depth, nodes]) => ({ depth, nodes }));
});

const connectionsFor = (node) => {
  const namesById = new Map(props.data.nodes.map((contact) => [contact.id, contact.name]));

  return props.data.edges
    .filter((edge) => edge.source === node.id || edge.target === node.id)
    .map((edge) => {
      const isSource = edge.source === node.id;
      const otherId = isSource ? edge.target : edge.source;
      const label = isSource ? edge.source_label : edge.target_label;

      return `${label} · ${namesById.get(otherId)}`;
    });
};
</script>

<template>
  <Layout :inside-vault="true" :layout-data="layoutData" :title="$t('Family tree')">
    <div class="mx-auto max-w-6xl px-3 py-6 sm:px-6">
      <Link :href="data.url.back" class="mb-5 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
        <ArrowLeft class="h-4 w-4" />
        {{ $t('Back to contact') }}
      </Link>

      <div class="mb-6 flex items-center gap-3">
        <Network class="h-6 w-6 text-gray-500" />
        <div>
          <h1 class="text-xl font-semibold">{{ $t('Family tree') }}</h1>
          <p class="text-sm text-gray-500">
            {{ $t('Explore family and partner relationships around :name', { name: root?.name }) }}
          </p>
        </div>
      </div>

      <div class="flex flex-col items-center">
        <section
          class="w-full max-w-md rounded-xl border-2 border-blue-300 bg-blue-50 p-4 text-center shadow-sm dark:border-blue-800 dark:bg-blue-950/40">
          <div class="text-xs font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">
            {{ $t('Starting contact') }}
          </div>
          <div class="mt-1 text-lg font-semibold">{{ root?.name }}</div>
          <div class="mt-1 text-xs text-gray-500">
            {{ $t('Center the tree on another person to explore their family') }}
          </div>
        </section>

        <div v-if="relativesByDepth.length" class="my-4 h-8 border-s border-gray-300 dark:border-gray-700" />

        <section v-for="level in relativesByDepth" :key="level.depth" class="mb-5 w-full">
          <h2 class="mb-2 text-center text-sm font-semibold text-gray-600 dark:text-gray-300">
            {{ $t('Connections :depth links away', { depth: level.depth }) }}
          </h2>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <article
              v-for="relative in level.nodes"
              :key="relative.id"
              class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <div class="flex items-center gap-2">
                <ContactRound v-if="!relative.is_private_person" class="h-4 w-4 shrink-0 text-gray-400" />
                <span class="font-medium">{{ relative.name }}</span>
              </div>
              <ul class="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                <li v-for="connection in connectionsFor(relative)" :key="connection">{{ connection }}</li>
              </ul>
              <div class="mt-3 flex gap-3 text-sm">
                <Link :href="relative.focus_url" class="text-blue-600 hover:underline">{{ $t('Center here') }}</Link>
                <Link :href="relative.detail_url" class="text-gray-600 hover:underline dark:text-gray-300">{{
                  $t('Open record')
                }}</Link>
              </div>
            </article>
          </div>
        </section>

        <div
          v-if="relativesByDepth.length === 0"
          class="w-full max-w-xl rounded-lg border border-dashed border-gray-300 px-5 py-8 text-center text-sm text-gray-500 dark:border-gray-700">
          {{ $t('No family or partner relationships have been added for this contact yet.') }}
        </div>

        <p v-if="data.is_limited" class="mt-2 text-center text-xs text-gray-500">
          {{
            $t(
              'This view is limited to the closest 150 people. Center the tree on someone else to explore another branch.',
            )
          }}
        </p>
      </div>
    </div>
  </Layout>
</template>

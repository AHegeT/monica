<template>
  <div class="mb-10">
    <!-- title + cta -->
    <div class="mb-3 items-center justify-between border-b border-gray-200 pb-2 dark:border-gray-700 sm:flex">
      <div class="mb-2 sm:mb-0 flex items-center gap-2">
        <UsersRound class="h-4 w-4 text-gray-600" />

        <span class="font-semibold"> {{ $t('Relationships') }} </span>
      </div>
      <pretty-link :text="$t('Add a relationship')" :icon="'plus'" :href="data.url.create" :class="'w-full sm:w-fit'" />
    </div>

    <!-- relationships -->
    <div>
      <div v-for="relationshipGroupType in localRelationships" :key="relationshipGroupType.id" class="mb-4">
        <!-- group name -->
        <h3 v-if="relationshipGroupType.relationship_types.length > 0" class="mb-1 font-semibold">
          {{ relationshipGroupType.name }}
        </h3>

        <!-- list of relationship types in this group -->
        <ul
          v-if="relationshipGroupType.relationship_types.length > 0"
          class="mb-4 rounded-lg border border-gray-200 last:mb-0 dark:border-gray-700">
          <li
            v-for="relationshipType in relationshipGroupType.relationship_types"
            :key="relationshipType.id"
            class="item-list flex items-center justify-between border-b border-gray-200 px-5 py-2 hover:bg-slate-50 dark:border-gray-700 dark:bg-slate-900 dark:hover:bg-slate-800">
            <div class="flex">
              <div class="me-2 flex items-center">
                <avatar :data="relationshipType.contact.avatar" :class="'me-2 h-5 w-5'" />

                <!-- name -->
                <InertiaLink
                  v-if="relationshipType.contact.url.show"
                  :href="relationshipType.contact.url.show"
                  class="text-blue-500 hover:underline">
                  {{ relationshipType.contact.name }}
                </InertiaLink>
                <span v-else>{{ relationshipType.contact.name }}</span>
                <ContactRound
                  v-if="!relationshipType.contact.is_private_person"
                  class="ms-2 h-3.5 w-3.5 text-gray-400"
                  role="img"
                  :aria-label="$t('Full contact')"
                  :title="$t('Full contact')" />

                <!-- age -->
                <span v-if="relationshipType.contact.age" class="ms-2 text-xs text-gray-400"
                  >({{ relationshipType.contact.age }})</span
                >
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <span class="text-gray-400">{{ relationshipType.relationship_type.name }}</span>
                <div v-if="relationshipType.closeness_level || canEdit" class="relative" data-closeness-control>
                  <button
                    v-if="canEdit"
                    type="button"
                    class="flex items-center gap-0.5 rounded px-1.5 py-1 text-gray-400 transition hover:bg-slate-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:bg-slate-800 dark:hover:text-gray-300"
                    :aria-label="closenessLabel(relationshipType.closeness_level)"
                    :title="closenessLabel(relationshipType.closeness_level)"
                    :aria-expanded="editingClosenessUrl === relationshipType.url.update_closeness"
                    @click="toggleClosenessMenu(relationshipType)">
                    <span
                      v-for="dot in 3"
                      :key="dot"
                      class="h-1.5 w-1.5 rounded-full"
                      :class="
                        dot <= (relationshipType.closeness_level || 0)
                          ? 'bg-gray-500 dark:bg-gray-300'
                          : 'bg-gray-200 dark:bg-gray-700'
                      " />
                  </button>
                  <span
                    v-else
                    class="inline-flex items-center gap-0.5 px-1.5 py-1 text-gray-400"
                    :aria-label="closenessLabel(relationshipType.closeness_level)"
                    :title="closenessLabel(relationshipType.closeness_level)">
                    <span
                      v-for="dot in 3"
                      :key="dot"
                      class="h-1.5 w-1.5 rounded-full"
                      :class="
                        dot <= relationshipType.closeness_level
                          ? 'bg-gray-500 dark:bg-gray-300'
                          : 'bg-gray-200 dark:bg-gray-700'
                      " />
                  </span>
                  <div
                    v-if="editingClosenessUrl === relationshipType.url.update_closeness"
                    class="absolute left-0 top-full z-20 mt-1 min-w-40 rounded-md border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                    <button
                      v-for="option in closenessOptions"
                      :key="option.value ?? 'unset'"
                      type="button"
                      class="block w-full rounded px-3 py-1.5 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
                      :class="
                        relationshipType.closeness_level === option.value
                          ? 'font-semibold text-blue-600 dark:text-blue-400'
                          : 'text-gray-700 dark:text-gray-200'
                      "
                      @click="updateCloseness(relationshipType, option.value)">
                      {{ $t(option.label) }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- actions -->
            <ul class="text-sm">
              <li class="inline cursor-pointer text-red-500 hover:text-red-900" @click="destroy(relationshipType)">
                {{ $t('Remove') }}
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </div>

    <!-- blank state -->
    <div
      v-if="data.number_of_defined_relations === 0"
      class="mb-6 rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <img src="/img/contact_blank_relationship.svg" :alt="$t('Relationships')" class="mx-auto mt-4 h-14 w-14" />
      <p class="px-5 pb-5 pt-2 text-center">{{ $t('There are no relationships yet.') }}</p>
    </div>
  </div>
</template>

<script>
import { Link } from '@inertiajs/vue3';
import PrettyLink from '@/Shared/Form/PrettyLink.vue';
import Avatar from '@/Shared/Avatar.vue';
import { ContactRound, UsersRound } from 'lucide-vue-next';

export default {
  components: {
    InertiaLink: Link,
    PrettyLink,
    Avatar,
    ContactRound,
    UsersRound,
  },

  props: {
    data: {
      type: Object,
      default: null,
    },
    canEdit: {
      type: Boolean,
      default: false,
    },
  },

  data() {
    return {
      localRelationships: [],
      editingClosenessUrl: null,
    };
  },

  created() {
    this.localRelationships = this.data.relationship_group_types;
  },

  mounted() {
    document.addEventListener('click', this.closeClosenessMenuOnOutsideClick);
  },

  beforeUnmount() {
    document.removeEventListener('click', this.closeClosenessMenuOnOutsideClick);
  },

  methods: {
    closeClosenessMenuOnOutsideClick(event) {
      if (!event.target.closest('[data-closeness-control]')) {
        this.editingClosenessUrl = null;
      }
    },
    toggleClosenessMenu(relationship) {
      this.editingClosenessUrl =
        this.editingClosenessUrl === relationship.url.update_closeness ? null : relationship.url.update_closeness;
    },
    closenessLabel(level) {
      const labels = {
        1: 'Acquaintance',
        2: 'Friendly',
        3: 'Very close (BFF)',
      };

      return level ? `${this.$t('Closeness')}: ${this.$t(labels[level])}` : this.$t('Set closeness');
    },
    updateCloseness(relationship, value) {
      const closenessLevel = value === null ? null : Number(value);
      const previousLevel = relationship.closeness_level;
      relationship.closeness_level = closenessLevel;
      this.editingClosenessUrl = null;

      axios
        .put(relationship.url.update_closeness, { closeness_level: closenessLevel })
        .then((response) => {
          relationship.closeness_level = response.data.data.closeness_level;
        })
        .catch((error) => {
          relationship.closeness_level = previousLevel;
          this.flash(error.response?.data?.message ?? this.$t('Changes could not be saved'), 'error');
        });
    },
    destroy(relationshipType) {
      if (confirm(this.$t('Are you sure? This action cannot be undone.'))) {
        axios
          .put(relationshipType.url.update)
          .then((response) => {
            this.flash(this.$t('The relationship has been deleted'), 'success');
            this.localRelationships = response.data.data.relationship_group_types;
          })
          .catch((error) => {
            this.form.errors = error.response.data;
          });
      }
    },
  },

  computed: {
    closenessOptions() {
      return [
        { value: null, label: 'Clear closeness' },
        { value: 1, label: '1 · Acquaintance' },
        { value: 2, label: '2 · Friendly' },
        { value: 3, label: '3 · Very close (BFF)' },
      ];
    },
  },
};
</script>

<style lang="scss" scoped>
.item-list {
  &:hover:first-child {
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
  }

  &:last-child {
    border-bottom: 0;
  }

  &:hover:last-child {
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
  }
}
</style>

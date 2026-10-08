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
                <LockKeyhole
                  v-if="relationshipType.contact.is_private_person"
                  class="ms-2 h-3.5 w-3.5 text-gray-400"
                  role="img"
                  :aria-label="$t('Relationship only')"
                  :title="$t('This is a relationship-only person')" />

                <!-- age -->
                <span v-if="relationshipType.contact.age" class="ms-2 text-xs text-gray-400"
                  >({{ relationshipType.contact.age }})</span
                >
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <span class="text-gray-400">{{ relationshipType.relationship_type.name }}</span>
                <select
                  :value="relationshipType.closeness_level ?? ''"
                  :aria-label="$t('Closeness')"
                  :disabled="!canEdit"
                  class="rounded border-gray-300 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
                  @change="updateCloseness(relationshipType, $event.target.value)">
                  <option value="">{{ $t('Not set') }}</option>
                  <option value="1">1 · {{ $t('Acquaintance') }}</option>
                  <option value="2">2 · {{ $t('Friendly') }}</option>
                  <option value="3">3 · {{ $t('Very close (BFF)') }}</option>
                </select>
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
import { LockKeyhole, UsersRound } from 'lucide-vue-next';

export default {
  components: {
    InertiaLink: Link,
    PrettyLink,
    Avatar,
    LockKeyhole,
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
    };
  },

  created() {
    this.localRelationships = this.data.relationship_group_types;
  },

  methods: {
    updateCloseness(relationship, value) {
      const closenessLevel = value === '' ? null : Number(value);
      const previousLevel = relationship.closeness_level;
      relationship.closeness_level = closenessLevel;

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

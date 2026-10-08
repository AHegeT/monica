<?php

namespace App\Domains\Settings\ManageRelationshipTypes\Web\ViewHelpers;

use App\Models\Account;
use App\Models\RelationshipGroupType;
use App\Models\RelationshipType;
use Illuminate\Support\Facades\DB;

class PersonalizeRelationshipIndexViewHelper
{
    public static function data(Account $account): array
    {
        $relationshipGroupTypes = $account->relationshipGroupTypes()
            ->with('types')
            ->get()
            ->sortByCollator('name')
            ->map(fn (RelationshipGroupType $relationshipGroupType) => self::dtoGroupType($relationshipGroupType));

        return [
            'group_types' => $relationshipGroupTypes,
            'legacy_relationship_count' => self::legacyRelationshipCount($account),
            'url' => [
                'settings' => route('settings.index'),
                'personalize' => route('settings.personalize.index'),
                'legacy_relationships' => route('settings.personalize.relationship.legacy.index'),
                'group_type_store' => route('settings.personalize.relationship.grouptype.store'),
            ],
        ];
    }

    public static function legacyRelationships(Account $account): array
    {
        $groups = $account->relationshipGroupTypes()->with('types')->get();
        $legacyGroupIds = self::legacyGroupIds($groups);
        $legacyGroups = $groups->whereIn('id', $legacyGroupIds);
        $legacyTypeIds = $legacyGroups->flatMap(fn (RelationshipGroupType $groupType) => $groupType->types->pluck('id'));

        $relationships = DB::table('relationships as relationships')
            ->join('relationship_types as relationship_types', 'relationships.relationship_type_id', '=', 'relationship_types.id')
            ->join('relationship_group_types as relationship_group_types', 'relationship_types.relationship_group_type_id', '=', 'relationship_group_types.id')
            ->join('contacts as contact', 'relationships.contact_id', '=', 'contact.id')
            ->join('contacts as related_contact', 'relationships.related_contact_id', '=', 'related_contact.id')
            ->whereIn('relationships.relationship_type_id', $legacyTypeIds)
            ->whereNull('contact.deleted_at')
            ->whereNull('related_contact.deleted_at')
            ->select([
                'relationships.id',
                'relationships.contact_id',
                'relationships.related_contact_id',
                'contact.vault_id as contact_vault_id',
                'contact.first_name as contact_first_name',
                'contact.middle_name as contact_middle_name',
                'contact.last_name as contact_last_name',
                'related_contact.vault_id as related_vault_id',
                'related_contact.first_name as related_first_name',
                'related_contact.middle_name as related_middle_name',
                'related_contact.last_name as related_last_name',
                'relationship_group_types.name as group_name',
                'relationship_group_types.name_translation_key as group_translation_key',
                'relationship_types.name as type_name',
                'relationship_types.name_translation_key as type_translation_key',
                'relationship_types.name_reverse_relationship as reverse_name',
                'relationship_types.name_reverse_relationship_translation_key as reverse_translation_key',
            ])
            ->orderBy('relationship_group_types.name')
            ->orderBy('relationships.id')
            ->paginate(50)
            ->through(function ($relationship): array {
                $contactName = self::contactName($relationship->contact_first_name, $relationship->contact_middle_name, $relationship->contact_last_name);
                $relatedName = self::contactName($relationship->related_first_name, $relationship->related_middle_name, $relationship->related_last_name);

                return [
                    'id' => $relationship->id,
                    'group_name' => $relationship->group_name ?: __($relationship->group_translation_key),
                    'from_role' => $relationship->type_name ?: __($relationship->type_translation_key),
                    'to_role' => $relationship->reverse_name ?: __($relationship->reverse_translation_key),
                    'contact' => [
                        'name' => $contactName,
                        'url' => route('contact.show', ['vault' => $relationship->contact_vault_id, 'contact' => $relationship->contact_id]),
                    ],
                    'related_contact' => [
                        'name' => $relatedName,
                        'url' => route('contact.show', ['vault' => $relationship->related_vault_id, 'contact' => $relationship->related_contact_id]),
                    ],
                    'url' => [
                        'update' => route('settings.personalize.relationship.legacy.update', ['relationshipId' => $relationship->id]),
                    ],
                ];
            });

        $targetGroups = $groups->whereNotIn('id', $legacyGroupIds)->map(fn (RelationshipGroupType $groupType) => [
            'id' => $groupType->id,
            'name' => $groupType->name,
            'types' => $groupType->types->map(fn (RelationshipType $type) => [
                'id' => $type->id,
                'name' => $type->name,
                'reverse_name' => $type->name_reverse_relationship,
            ])->values(),
        ])->values();

        return [
            'relationships' => $relationships,
            'legacy_groups' => $legacyGroups->map(fn (RelationshipGroupType $groupType) => [
                'id' => $groupType->id,
                'name' => $groupType->name,
            ])->values(),
            'target_groups' => $targetGroups,
            'url' => [
                'settings' => route('settings.index'),
                'relationship_types' => route('settings.personalize.relationship.index'),
            ],
        ];
    }

    private static function legacyRelationshipCount(Account $account): int
    {
        $groups = $account->relationshipGroupTypes()->get();
        $legacyGroupIds = self::legacyGroupIds($groups);

        return DB::table('relationships')
            ->join('relationship_types', 'relationships.relationship_type_id', '=', 'relationship_types.id')
            ->whereIn('relationship_types.relationship_group_type_id', $legacyGroupIds)
            ->join('contacts as contact', 'relationships.contact_id', '=', 'contact.id')
            ->join('contacts as related_contact', 'relationships.related_contact_id', '=', 'related_contact.id')
            ->whereNull('contact.deleted_at')
            ->whereNull('related_contact.deleted_at')
            ->count();
    }

    public static function legacyGroupIds($groups)
    {
        $duplicateNames = $groups
            ->groupBy(fn (RelationshipGroupType $groupType) => mb_strtolower(trim($groupType->name)))
            ->filter(fn ($sameNameGroups) => $sameNameGroups->count() > 1)
            ->keys();

        return $groups->filter(fn (RelationshipGroupType $groupType) => $groupType->getRawOriginal('name') !== null
            && $duplicateNames->contains(mb_strtolower(trim($groupType->name)))
        )->pluck('id');
    }

    private static function contactName(?string ...$parts): string
    {
        return collect($parts)->filter(fn (?string $part) => filled($part))->implode(' ');
    }

    public static function dtoGroupType(RelationshipGroupType $groupType): array
    {
        return [
            'id' => $groupType->id,
            'name' => $groupType->name,
            'can_be_deleted' => $groupType->can_be_deleted,
            'types' => $groupType->types->map(function ($type) use ($groupType) {
                return self::dtoRelationshipType($groupType, $type);
            }),
            'url' => [
                'store' => route('settings.personalize.relationship.type.store', [
                    'groupType' => $groupType->id,
                ]),
                'update' => route('settings.personalize.relationship.grouptype.update', [
                    'groupType' => $groupType->id,
                ]),
                'destroy' => route('settings.personalize.relationship.grouptype.destroy', [
                    'groupType' => $groupType->id,
                ]),
            ],
        ];
    }

    public static function dtoRelationshipType(RelationshipGroupType $groupType, RelationshipType $type): array
    {
        return [
            'id' => $type->id,
            'name' => $type->name,
            'name_reverse_relationship' => $type->name_reverse_relationship,
            'can_be_deleted' => $type->can_be_deleted,
            'url' => [
                'update' => route('settings.personalize.relationship.type.update', [
                    'groupType' => $groupType->id,
                    'type' => $type->id,
                ]),
                'destroy' => route('settings.personalize.relationship.type.destroy', [
                    'groupType' => $groupType->id,
                    'type' => $type->id,
                ]),
            ],
        ];
    }
}

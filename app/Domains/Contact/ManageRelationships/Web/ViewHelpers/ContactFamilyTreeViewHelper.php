<?php

namespace App\Domains\Contact\ManageRelationships\Web\ViewHelpers;

use App\Models\Contact;
use App\Models\RelationshipGroupType;
use App\Models\Vault;
use Illuminate\Support\Facades\DB;

class ContactFamilyTreeViewHelper
{
    private const MAX_DEPTH = 4;

    private const MAX_CONTACTS = 150;

    public static function data(Vault $vault, Contact $root): array
    {
        $relationships = DB::table('relationships')
            ->join('relationship_types', 'relationships.relationship_type_id', '=', 'relationship_types.id')
            ->join('relationship_group_types', 'relationship_types.relationship_group_type_id', '=', 'relationship_group_types.id')
            ->join('contacts as source_contact', 'relationships.contact_id', '=', 'source_contact.id')
            ->join('contacts as target_contact', 'relationships.related_contact_id', '=', 'target_contact.id')
            ->where('relationship_group_types.account_id', $vault->account_id)
            ->whereIn('relationship_group_types.type', [RelationshipGroupType::TYPE_FAMILY, RelationshipGroupType::TYPE_LOVE])
            ->where('source_contact.vault_id', $vault->id)
            ->where('target_contact.vault_id', $vault->id)
            ->whereNull('source_contact.deleted_at')
            ->whereNull('target_contact.deleted_at')
            ->where(function ($query): void {
                $query->where('source_contact.listed', true)
                    ->orWhere('source_contact.is_private_person', true);
            })
            ->where(function ($query): void {
                $query->where('target_contact.listed', true)
                    ->orWhere('target_contact.is_private_person', true);
            })
            ->select([
                'relationships.contact_id as source_id',
                'relationships.related_contact_id as target_id',
                'relationship_types.name as source_label',
                'relationship_types.name_translation_key as source_label_key',
                'relationship_types.name_reverse_relationship as target_label',
                'relationship_types.name_reverse_relationship_translation_key as target_label_key',
            ])
            ->get();

        $adjacency = [];
        foreach ($relationships as $relationship) {
            $sourceLabel = $relationship->source_label ?: __($relationship->source_label_key);
            $targetLabel = $relationship->target_label ?: __($relationship->target_label_key);
            $adjacency[$relationship->source_id][] = [
                'id' => $relationship->target_id,
                'label' => $sourceLabel,
            ];
            $adjacency[$relationship->target_id][] = [
                'id' => $relationship->source_id,
                'label' => $targetLabel,
            ];
        }

        $depths = [$root->id => 0];
        $queue = [$root->id];
        while ($queue !== [] && count($depths) < self::MAX_CONTACTS) {
            $currentId = array_shift($queue);
            $depth = $depths[$currentId];
            if ($depth >= self::MAX_DEPTH) {
                continue;
            }

            foreach ($adjacency[$currentId] ?? [] as $neighbor) {
                if (isset($depths[$neighbor['id']])) {
                    continue;
                }

                $depths[$neighbor['id']] = $depth + 1;
                $queue[] = $neighbor['id'];
                if (count($depths) >= self::MAX_CONTACTS) {
                    break;
                }
            }
        }

        $contacts = Contact::query()
            ->where('vault_id', $vault->id)
            ->whereIn('id', array_keys($depths))
            ->get()
            ->keyBy('id');

        $nodes = [];
        foreach ($depths as $id => $depth) {
            $contact = $contacts->get($id);
            if (! $contact) {
                continue;
            }

            $nodes[] = [
                'id' => $contact->id,
                'name' => $contact->name,
                'is_private_person' => $contact->is_private_person,
                'depth' => $depth,
                'detail_url' => $contact->is_private_person
                    ? route('contact.note.index', ['vault' => $vault->id, 'contact' => $contact->id, 'from' => $root->id])
                    : route('contact.show', ['vault' => $vault->id, 'contact' => $contact->id]),
                'focus_url' => route('contact.family_tree.show', ['vault' => $vault->id, 'contact' => $contact->id]),
            ];
        }

        $nodeIds = array_fill_keys(array_column($nodes, 'id'), true);
        $edges = [];
        foreach ($relationships as $relationship) {
            if (! isset($nodeIds[$relationship->source_id], $nodeIds[$relationship->target_id])) {
                continue;
            }

            $sourceLabel = $relationship->source_label ?: __($relationship->source_label_key);
            $targetLabel = $relationship->target_label ?: __($relationship->target_label_key);
            $edges[] = [
                'source' => $relationship->source_id,
                'target' => $relationship->target_id,
                'source_label' => $sourceLabel,
                'target_label' => $targetLabel,
            ];
        }

        return [
            'root_id' => $root->id,
            'nodes' => $nodes,
            'edges' => $edges,
            'is_limited' => count($depths) >= self::MAX_CONTACTS,
            'url' => [
                'back' => route('contact.show', ['vault' => $vault->id, 'contact' => $root->id]),
            ],
        ];
    }
}

<?php

namespace App\Domains\Settings\ManageRelationshipTypes\Web\Controllers;

use App\Domains\Settings\ManageRelationshipTypes\Services\CreateRelationshipGroupType;
use App\Domains\Settings\ManageRelationshipTypes\Services\DestroyRelationshipGroupType;
use App\Domains\Settings\ManageRelationshipTypes\Services\UpdateRelationshipGroupType;
use App\Domains\Settings\ManageRelationshipTypes\Web\ViewHelpers\PersonalizeRelationshipIndexViewHelper;
use App\Domains\Vault\ManageVault\Web\ViewHelpers\VaultIndexViewHelper;
use App\Http\Controllers\Controller;
use App\Models\RelationshipType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class PersonalizeRelationshipController extends Controller
{
    public function index()
    {
        return Inertia::render('Settings/Personalize/Relationships/Index', [
            'layoutData' => VaultIndexViewHelper::layoutData(),
            'data' => PersonalizeRelationshipIndexViewHelper::data(Auth::user()->account),
        ]);
    }

    public function legacyRelationships()
    {
        return Inertia::render('Settings/Personalize/Relationships/Legacy', [
            'layoutData' => VaultIndexViewHelper::layoutData(),
            'data' => PersonalizeRelationshipIndexViewHelper::legacyRelationships(Auth::user()->account),
        ]);
    }

    public function updateLegacyRelationship(Request $request, int $relationshipId)
    {
        $validated = $request->validate([
            'relationship_type_id' => ['required', 'integer'],
            'swap_direction' => ['sometimes', 'boolean'],
        ]);

        $account = Auth::user()->account;
        $legacyGroupIds = PersonalizeRelationshipIndexViewHelper::legacyGroupIds(
            $account->relationshipGroupTypes()->get(),
        );

        $relationship = DB::table('relationships')
            ->join('relationship_types', 'relationships.relationship_type_id', '=', 'relationship_types.id')
            ->join('relationship_group_types', 'relationship_types.relationship_group_type_id', '=', 'relationship_group_types.id')
            ->where('relationships.id', $relationshipId)
            ->where('relationship_group_types.account_id', $account->id)
            ->whereIn('relationship_group_types.id', $legacyGroupIds)
            ->select('relationships.*')
            ->first();

        abort_unless($relationship, 404);

        $targetType = RelationshipType::query()
            ->whereKey($validated['relationship_type_id'])
            ->whereHas('groupType', fn ($query) => $query
                ->where('account_id', $account->id)
                ->whereNotIn('id', $legacyGroupIds))
            ->firstOrFail();

        DB::transaction(function () use ($relationshipId, $relationship, $targetType, $validated): void {
            $contactId = $relationship->contact_id;
            $relatedContactId = $relationship->related_contact_id;

            $updated = DB::table('relationships')
                ->where('id', $relationshipId)
                ->where('relationship_type_id', $relationship->relationship_type_id)
                ->update([
                    'relationship_type_id' => $targetType->id,
                    'contact_id' => ($validated['swap_direction'] ?? false) ? $relatedContactId : $contactId,
                    'related_contact_id' => ($validated['swap_direction'] ?? false) ? $contactId : $relatedContactId,
                    'updated_at' => now(),
                ]);

            abort_unless($updated === 1, 409);

            DB::table('contacts')
                ->whereIn('id', [$contactId, $relatedContactId])
                ->update(['last_updated_at' => now()]);
        });

        return response()->json(['data' => true], 200);
    }

    public function store(Request $request)
    {
        $data = [
            'account_id' => Auth::user()->account_id,
            'author_id' => Auth::id(),
            'name' => $request->input('relationshipGroupTypeName'),
            'can_be_deleted' => true,
        ];

        $groupType = (new CreateRelationshipGroupType)->execute($data);

        return response()->json([
            'data' => PersonalizeRelationshipIndexViewHelper::dtoGroupType($groupType),
        ], 201);
    }

    public function update(Request $request, int $groupTypeId)
    {
        $data = [
            'account_id' => Auth::user()->account_id,
            'author_id' => Auth::id(),
            'relationship_group_type_id' => $groupTypeId,
            'name' => $request->input('relationshipGroupTypeName'),
        ];

        $groupType = (new UpdateRelationshipGroupType)->execute($data);

        return response()->json([
            'data' => PersonalizeRelationshipIndexViewHelper::dtoGroupType($groupType),
        ], 200);
    }

    public function destroy(Request $request, int $groupTypeId)
    {
        $data = [
            'account_id' => Auth::user()->account_id,
            'author_id' => Auth::id(),
            'relationship_group_type_id' => $groupTypeId,
        ];

        (new DestroyRelationshipGroupType)->execute($data);

        return response()->json([
            'data' => true,
        ], 200);
    }
}

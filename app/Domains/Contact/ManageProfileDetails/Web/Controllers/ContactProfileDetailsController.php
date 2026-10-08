<?php

namespace App\Domains\Contact\ManageProfileDetails\Web\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ContactProfileDetailsController extends Controller
{
    public function index(string $vaultId, string $contactId): JsonResponse
    {
        $contact = $this->contact($vaultId, $contactId);

        return response()->json(['data' => [
            'employments' => $contact->employments()->orderByDesc('is_current')->orderByDesc('started_on')->get(),
            'interests' => $contact->profileTags()->where('kind', 'interest')->orderBy('name')->get(),
            'skills' => $contact->profileTags()->where('kind', 'skill')->orderBy('name')->get(),
        ]]);
    }

    public function storeEmployment(Request $request, string $vaultId, string $contactId): JsonResponse
    {
        $contact = $this->contact($vaultId, $contactId);
        $data = $request->validate([
            'employer' => ['required', 'string', 'max:255'],
            'position' => ['nullable', 'string', 'max:255'],
            'started_on' => ['nullable', 'date'],
            'ended_on' => ['nullable', 'date', 'after_or_equal:started_on'],
            'is_current' => ['required', 'boolean'],
        ]);
        if ($data['is_current']) {
            $data['ended_on'] = null;
        }
        $data['employer'] = trim($data['employer']);
        $data['normalized_employer'] = Str::of($data['employer'])->lower()->squish()->toString();

        $employment = $contact->employments()->create($data);

        return response()->json(['data' => $employment], 201);
    }

    public function destroyEmployment(string $vaultId, string $contactId, string $employmentId): JsonResponse
    {
        $contact = $this->contact($vaultId, $contactId);
        $contact->employments()->findOrFail($employmentId)->delete();

        return response()->json([], 204);
    }

    public function storeTag(Request $request, string $vaultId, string $contactId): JsonResponse
    {
        $contact = $this->contact($vaultId, $contactId);
        $data = $request->validate([
            'kind' => ['required', 'in:interest,skill'],
            'name' => ['required', 'string', 'max:100'],
        ]);
        $normalizedName = Str::of($data['name'])->trim()->lower()->squish()->toString();
        $tag = $contact->profileTags()->firstOrCreate(
            ['kind' => $data['kind'], 'normalized_name' => $normalizedName],
            ['name' => trim($data['name'])]
        );

        return response()->json(['data' => $tag], 201);
    }

    public function destroyTag(string $vaultId, string $contactId, string $tagId): JsonResponse
    {
        $contact = $this->contact($vaultId, $contactId);
        $contact->profileTags()->findOrFail($tagId)->delete();

        return response()->json([], 204);
    }

    public function toggleGroupActive(Request $request, string $vaultId, string $contactId, string $groupId): JsonResponse
    {
        $contact = $this->contact($vaultId, $contactId);
        $membership = $contact->groups()->whereKey($groupId)->firstOrFail();
        $active = (bool) $request->validate(['is_active' => ['required', 'boolean']])['is_active'];
        $contact->groups()->updateExistingPivot($membership->id, ['is_active' => $active]);

        return response()->json(['data' => ['is_active' => $active]]);
    }

    private function contact(string $vaultId, string $contactId): Contact
    {
        return Contact::query()->where('vault_id', $vaultId)->findOrFail($contactId);
    }
}

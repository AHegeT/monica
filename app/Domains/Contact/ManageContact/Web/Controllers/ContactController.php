<?php

namespace App\Domains\Contact\ManageContact\Web\Controllers;

use App\Domains\Contact\ManageContact\Services\CreateContact;
use App\Domains\Contact\ManageContact\Services\DestroyContact;
use App\Domains\Contact\ManageContact\Services\UpdateContact;
use App\Domains\Contact\ManageContact\Services\UpdateContactView;
use App\Domains\Contact\ManageContact\Web\ViewHelpers\ContactCreateViewHelper;
use App\Domains\Contact\ManageContact\Web\ViewHelpers\ContactEditViewHelper;
use App\Domains\Contact\ManageContact\Web\ViewHelpers\ContactIndexViewHelper;
use App\Domains\Contact\ManageContact\Web\ViewHelpers\ContactShowViewHelper;
use App\Domains\Vault\ManageVault\Web\ViewHelpers\VaultIndexViewHelper;
use App\Helpers\PaginatorHelper;
use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\RelationshipGroupType;
use App\Models\User;
use App\Models\Vault;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

use function Safe\preg_replace;

class ContactController extends Controller
{
    public function index(Request $request, Vault $vault)
    {
        $contacts = $vault->contacts()
            ->active();

        $searchTerm = trim((string) $request->input('search', ''));
        if ($searchTerm !== '') {
            $contacts->nameMatches($searchTerm);
        }

        $withoutGroup = $request->boolean('without_group');
        $withoutFamily = $request->boolean('without_family');

        if ($withoutGroup) {
            $contacts->whereDoesntHave('groups');
        }

        if ($withoutFamily) {
            $contacts->whereNotExists(function ($query) use ($vault): void {
                $query->selectRaw('1')
                    ->from('relationships')
                    ->join('relationship_types', 'relationships.relationship_type_id', '=', 'relationship_types.id')
                    ->join('relationship_group_types', 'relationship_types.relationship_group_type_id', '=', 'relationship_group_types.id')
                    ->where('relationship_group_types.account_id', $vault->account_id)
                    ->where('relationship_group_types.type', RelationshipGroupType::TYPE_FAMILY)
                    ->where(function ($query): void {
                        $query->whereColumn('relationships.contact_id', 'contacts.id')
                            ->orWhereColumn('relationships.related_contact_id', 'contacts.id');
                    });
            });
        }

        $column_to_order = preg_replace('/^%([a-z_]+)%.*$/', '$1', Auth::user()->name_order);

        switch (Auth::user()->contact_sort_order) {
            case User::CONTACT_SORT_ORDER_ASC:
                $contacts = $contacts->orderBy($column_to_order, 'asc');
                break;
            case User::CONTACT_SORT_ORDER_DESC:
                $contacts = $contacts->orderBy($column_to_order, 'desc');
                break;
            default:
                $contacts = $contacts->orderBy('last_updated_at', 'desc');
                break;
        }
        $contacts = $contacts->paginate(25)->withQueryString();

        return Inertia::render('Vault/Contact/Index', [
            'layoutData' => VaultIndexViewHelper::layoutData($vault),
            'data' => ContactIndexViewHelper::data($contacts, $vault, null, Auth::user(), $searchTerm, $withoutGroup, $withoutFamily),
            'paginator' => PaginatorHelper::getData($contacts),
        ]);
    }

    public function archived(Request $request, Vault $vault)
    {
        $contacts = $vault->contacts()
            ->where('listed', false)
            ->orderBy('last_updated_at', 'desc')
            ->paginate(25);

        return Inertia::render('Vault/Contact/Archived', [
            'layoutData' => VaultIndexViewHelper::layoutData($vault),
            'data' => ContactIndexViewHelper::data($contacts, $vault, null, Auth::user()),
            'paginator' => PaginatorHelper::getData($contacts),
        ]);
    }

    public function create(Request $request, Vault $vault)
    {
        Gate::authorize('vault-editor', $vault);

        return Inertia::render('Vault/Contact/Create', [
            'layoutData' => VaultIndexViewHelper::layoutData($vault),
            'data' => ContactCreateViewHelper::data($vault),
        ]);
    }

    public function store(Request $request, string $vaultId)
    {
        Gate::authorize('vault-editor', $vaultId);

        $data = [
            'account_id' => Auth::user()->account_id,
            'author_id' => Auth::id(),
            'vault_id' => $vaultId,
            'first_name' => $request->input('first_name'),
            'last_name' => $request->input('last_name'),
            'second_last_name' => $request->input('second_last_name'),
            'middle_name' => $request->input('middle_name'),
            'nickname' => $request->input('nickname'),
            'maiden_name' => $request->input('maiden_name'),
            'gender_id' => $request->input('gender_id'),
            'pronoun_id' => $request->input('pronoun_id'),
            'template_id' => $request->input('template_id'),
            'prefix' => $request->input('prefix'),
            'suffix' => $request->input('suffix'),
            'listed' => true,
        ];

        $contact = (new CreateContact)->execute($data);

        return response()->json([
            'data' => route('contact.show', [
                'vault' => $vaultId,
                'contact' => $contact,
            ]),
        ], 201);
    }

    public function show(Request $request, string $vaultId, string $contactId)
    {
        $vault = Vault::findOrFail($vaultId);
        $contact = Contact::with([
            'gender',
            'pronoun',
            'notes',
            'importantDates',
            'vault',
        ])
            ->findOrFail($contactId);

        if (! $contact->template_id) {
            return redirect()->route('contact.blank', [
                'vault' => $vaultId,
                'contact' => $contactId,
            ]);
        }

        (new UpdateContactView)->execute([
            'account_id' => Auth::user()->account_id,
            'vault_id' => $vaultId,
            'author_id' => Auth::id(),
            'contact_id' => $contactId,
        ]);

        return Inertia::render('Vault/Contact/Show', [
            'layoutData' => VaultIndexViewHelper::layoutData($vault),
            'data' => ContactShowViewHelper::data($contact, Auth::user()),
        ]);
    }

    public function edit(Request $request, string $vaultId, string $contactId)
    {
        $vault = Vault::findOrFail($vaultId);
        $contact = Contact::findOrFail($contactId);

        return Inertia::render('Vault/Contact/Names/Edit', [
            'layoutData' => VaultIndexViewHelper::layoutData($vault),
            'data' => ContactEditViewHelper::data($vault, $contact, Auth::user()),
        ]);
    }

    public function update(Request $request, string $vaultId, string $contactId)
    {
        $data = [
            'account_id' => Auth::user()->account_id,
            'author_id' => Auth::id(),
            'vault_id' => $vaultId,
            'contact_id' => $contactId,
            'first_name' => $request->input('first_name'),
            'last_name' => $request->input('last_name'),
            'second_last_name' => $request->input('second_last_name'),
            'middle_name' => $request->input('middle_name'),
            'nickname' => $request->input('nickname'),
            'maiden_name' => $request->input('maiden_name'),
            'gender_id' => $request->input('gender_id'),
            'pronoun_id' => $request->input('pronoun_id'),
            'prefix' => $request->input('prefix'),
            'suffix' => $request->input('suffix'),
        ];

        $contact = (new UpdateContact)->execute($data);

        return response()->json([
            'data' => route('contact.show', [
                'vault' => $vaultId,
                'contact' => $contact,
            ]),
        ], 200);
    }

    public function destroy(Request $request, string $vaultId, string $contactId)
    {
        $data = [
            'account_id' => Auth::user()->account_id,
            'author_id' => Auth::id(),
            'vault_id' => $vaultId,
            'contact_id' => $contactId,
        ];

        DestroyContact::dispatchSync($data);

        return response()->json([
            'data' => route('contact.index', [
                'vault' => $vaultId,
            ]),
        ], 200);
    }
}

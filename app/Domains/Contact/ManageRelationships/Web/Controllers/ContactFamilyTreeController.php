<?php

namespace App\Domains\Contact\ManageRelationships\Web\Controllers;

use App\Domains\Contact\ManageRelationships\Web\ViewHelpers\ContactFamilyTreeViewHelper;
use App\Domains\Vault\ManageVault\Web\ViewHelpers\VaultIndexViewHelper;
use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\Vault;
use Inertia\Inertia;

class ContactFamilyTreeController extends Controller
{
    public function show(string $vaultId, string $contactId)
    {
        $vault = Vault::findOrFail($vaultId);
        $contact = Contact::query()
            ->where('vault_id', $vault->id)
            ->findOrFail($contactId);

        return Inertia::render('Vault/Contact/FamilyTree', [
            'layoutData' => VaultIndexViewHelper::layoutData($vault),
            'data' => ContactFamilyTreeViewHelper::data($vault, $contact),
        ]);
    }
}

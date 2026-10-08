<?php

namespace App\Domains\Contact\ManageNotes\Web\Controllers;

use App\Domains\Contact\ManageNotes\Web\ViewHelpers\NotesIndexViewHelper;
use App\Domains\Vault\ManageVault\Web\ViewHelpers\VaultIndexViewHelper;
use App\Helpers\PaginatorHelper;
use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\Vault;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class ContactNotesController extends Controller
{
    public function index(Request $request, string $vaultId, string $contactId)
    {
        $vault = Vault::findOrFail($vaultId);
        $contact = Contact::query()->where('vault_id', $vaultId)->findOrFail($contactId);
        $returnUrl = null;

        if ($contact->is_private_person && $request->filled('from')) {
            $sourceContact = Contact::query()->where('vault_id', $vaultId)->find($request->input('from'));
            if ($sourceContact && DB::table('relationships')
                ->where(function ($query) use ($contact, $sourceContact): void {
                    $query->where('contact_id', $contact->id)->where('related_contact_id', $sourceContact->id);
                })
                ->orWhere(function ($query) use ($contact, $sourceContact): void {
                    $query->where('contact_id', $sourceContact->id)->where('related_contact_id', $contact->id);
                })
                ->exists()) {
                $returnUrl = route('contact.show', ['vault' => $vaultId, 'contact' => $sourceContact->id]);
            }
        }

        $notes = $contact->notes()->orderBy('created_at', 'desc')->paginate(10);

        return Inertia::render('Vault/Contact/Notes/Index', [
            'layoutData' => VaultIndexViewHelper::layoutData($vault),
            'data' => NotesIndexViewHelper::data($contact, $notes, Auth::user(), $returnUrl),
            'paginator' => PaginatorHelper::getData($notes),
        ]);
    }
}

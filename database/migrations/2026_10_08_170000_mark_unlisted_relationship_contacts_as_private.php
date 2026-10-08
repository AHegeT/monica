<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('contacts')
            ->where('listed', false)
            ->whereExists(function ($query) {
                $query->selectRaw('1')
                    ->from('relationships')
                    ->where(function ($query) {
                        $query->whereColumn('relationships.contact_id', 'contacts.id')
                            ->orWhereColumn('relationships.related_contact_id', 'contacts.id');
                    });
            })
            ->whereNotExists(function ($query) {
                $query->selectRaw('1')
                    ->from('contact_feed_items as archived')
                    ->whereColumn('archived.contact_id', 'contacts.id')
                    ->where('archived.action', 'archived')
                    ->whereNotExists(function ($query) {
                        $query->selectRaw('1')
                            ->from('contact_feed_items as later')
                            ->whereColumn('later.contact_id', 'archived.contact_id')
                            ->whereIn('later.action', ['archived', 'unarchived'])
                            ->where(function ($query) {
                                $query->whereColumn('later.created_at', '>', 'archived.created_at')
                                    ->orWhere(function ($query) {
                                        $query->whereColumn('later.created_at', 'archived.created_at')
                                            ->whereColumn('later.id', '>', 'archived.id');
                                    });
                            });
                    });
            })
            ->update(['is_private_person' => true]);
    }

    public function down(): void
    {
        // The data change is intentionally irreversible because it identifies existing
        // relationship-only contacts that cannot be distinguished from archived contacts otherwise.
    }
};

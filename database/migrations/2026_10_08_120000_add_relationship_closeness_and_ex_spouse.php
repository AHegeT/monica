<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('relationships', function (Blueprint $table) {
            $table->unsignedTinyInteger('closeness_level')->nullable()->after('relationship_type_id');
        });

        DB::table('relationship_group_types')
            ->where('type', 'love')
            ->pluck('id')
            ->each(function ($groupTypeId): void {
                $exists = DB::table('relationship_types')
                    ->where('relationship_group_type_id', $groupTypeId)
                    ->where('name_translation_key', 'ex-spouse')
                    ->exists();

                if ($exists) {
                    return;
                }

                DB::table('relationship_types')->insert([
                    'relationship_group_type_id' => $groupTypeId,
                    'name_translation_key' => 'ex-spouse',
                    'name_reverse_relationship_translation_key' => 'ex-spouse',
                    'type' => null,
                    'can_be_deleted' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });
    }

    public function down(): void
    {
        Schema::table('relationships', function (Blueprint $table) {
            $table->dropColumn('closeness_level');
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_employments', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('contact_id')->constrained()->cascadeOnDelete();
            $table->string('employer');
            $table->string('normalized_employer');
            $table->string('position')->nullable();
            $table->date('started_on')->nullable();
            $table->date('ended_on')->nullable();
            $table->boolean('is_current')->default(false);
            $table->timestamps();
            $table->index(['normalized_employer', 'is_current']);
        });

        Schema::create('contact_profile_tags', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('contact_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 16);
            $table->string('name');
            $table->string('normalized_name');
            $table->timestamps();
            $table->unique(['contact_id', 'kind', 'normalized_name'], 'contact_profile_tags_unique');
            $table->index(['kind', 'normalized_name']);
        });

        Schema::table('contact_group', function (Blueprint $table) {
            $table->boolean('is_active')->default(true);
        });

        DB::table('contacts')
            ->join('companies', 'contacts.company_id', '=', 'companies.id')
            ->whereNotNull('contacts.company_id')
            ->select('contacts.id', 'contacts.company_id', 'contacts.job_position', 'companies.name')
            ->orderBy('contacts.id')
            ->chunk(500, function ($contacts): void {
                $now = now();
                DB::table('contact_employments')->insert($contacts->map(fn ($contact) => [
                    'contact_id' => $contact->id,
                    'employer' => $contact->name,
                    'normalized_employer' => mb_strtolower(trim($contact->name)),
                    'position' => $contact->job_position,
                    'started_on' => null,
                    'ended_on' => null,
                    'is_current' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])->all());
            });
    }

    public function down(): void
    {
        Schema::table('contact_group', function (Blueprint $table) {
            $table->dropColumn('is_active');
        });
        Schema::dropIfExists('contact_profile_tags');
        Schema::dropIfExists('contact_employments');
    }
};

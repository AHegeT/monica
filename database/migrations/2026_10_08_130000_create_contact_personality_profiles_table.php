<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contact_personality_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('contact_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('myers_briggs_type', 4)->nullable();
            $table->unsignedTinyInteger('enneagram_type')->nullable();
            $table->json('working_genius_strengths')->nullable();
            $table->json('working_genius_weaknesses')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_personality_profiles');
    }
};

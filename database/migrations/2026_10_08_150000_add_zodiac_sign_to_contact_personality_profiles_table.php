<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contact_personality_profiles', function (Blueprint $table) {
            $table->string('zodiac_sign', 20)->nullable()->after('enneagram_type');
        });
    }

    public function down(): void
    {
        Schema::table('contact_personality_profiles', function (Blueprint $table) {
            $table->dropColumn('zodiac_sign');
        });
    }
};

<?php

use App\Helpers\ScoutHelper;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            $table->string('second_last_name')->nullable()->after('last_name');
            if (ScoutHelper::isFullTextIndex()) {
                $table->fullText('second_last_name');
            }
        });
    }

    public function down(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            if (ScoutHelper::isFullTextIndex()) {
                $table->dropFullText('second_last_name');
            }
            $table->dropColumn('second_last_name');
        });
    }
};

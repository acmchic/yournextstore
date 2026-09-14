<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $schema = Schema::connection('store');
        if (! $schema->hasTable('checkout_settings') || $schema->hasColumn('checkout_settings', 'pdp_assurance_enabled')) {
            return;
        }

        DB::connection('store')->unprepared(file_get_contents(base_path('../api/mysql/init/011_pdp_delivery_estimate.sql')));
    }

    public function down(): void
    {
        // Keep owner-configured delivery estimates across code rollbacks.
    }
};

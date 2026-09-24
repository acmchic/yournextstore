<?php

use Database\Seeders\TeeBravoPolicyContentSeeder;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // Apply this editorial release once; subsequent deploys keep CMS edits.
        (new TeeBravoPolicyContentSeeder)->run();
    }

    public function down(): void
    {
        // A code rollback must not revert published purchase conditions.
    }
};

<?php

use Database\Seeders\TeeBravoPolicySeeder;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // Run once so later deployments preserve edits made in the policy editor.
        (new TeeBravoPolicySeeder)->run();
    }

    public function down(): void
    {
        // Published policies and business settings must survive a code rollback.
    }
};

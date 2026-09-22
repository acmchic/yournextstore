<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $schema = Schema::connection('store');
        if ($schema->hasTable('activity_logs')) {
            return;
        }

        $schema->create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('admin_user_id')->nullable();
            $table->string('entity_type', 40);
            $table->unsignedBigInteger('entity_id');
            $table->json('before_json');
            $table->json('after_json');
            $table->timestamp('created_at');
            $table->index(['entity_type', 'entity_id']);
        });
    }

    public function down(): void
    {
        // Audit history is shared operational data and survives rollbacks.
    }
};

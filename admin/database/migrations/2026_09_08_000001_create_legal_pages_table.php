<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The commerce schema may already provide this shared table.
        if (Schema::connection('store')->hasTable('legal_pages')) {
            return;
        }

        Schema::connection('store')->create('legal_pages', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 120)->unique();
            $table->string('title', 200);
            $table->longText('content');
            $table->boolean('published')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        // This table is shared with the API and must survive admin rollbacks.
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::connection('store')->hasTable('collections')) {
            return;
        }

        Schema::connection('store')->table('collections', function (Blueprint $table) {
            $table->string('selection_rule', 32)->default('manual');
            $table->boolean('featured')->default(false);
            $table->integer('sort_order')->default(0);
        });
        foreach ([['new-arrivals', 'New arrivals', 'The latest graphics. Find your next everyday piece.', 'newest', 0], ['graphic-tees', 'Graphic tees', 'Artwork meets the everyday tee. Explore the graphics, choose your fit.', 'tees', 1]] as [$slug, $title, $description, $rule, $order]) {
            DB::connection('store')->table('collections')->insertOrIgnore([
                'public_id' => 'collection-'.$slug, 'slug' => $slug, 'title' => $title,
                'description' => $description, 'status' => 'active', 'selection_rule' => $rule,
                'featured' => true, 'sort_order' => $order, 'indexable' => true,
            ]);
        }
    }

    public function down(): void
    {
        if (! Schema::connection('store')->hasTable('collections')) {
            return;
        }

        Schema::connection('store')->table('collections', fn (Blueprint $table) => $table->dropColumn(['selection_rule', 'featured', 'sort_order']));
    }
};

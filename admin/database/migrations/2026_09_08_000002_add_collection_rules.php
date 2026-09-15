<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $schema = Schema::connection('store');
        if (! $schema->hasTable('collections')) {
            return;
        }

        if (! $schema->hasColumn('collections', 'selection_rule')) {
            $schema->table('collections', fn (Blueprint $table) => $table->string('selection_rule', 32)->default('manual'));
        }
        if (! $schema->hasColumn('collections', 'featured')) {
            $schema->table('collections', fn (Blueprint $table) => $table->boolean('featured')->default(false));
        }
        if (! $schema->hasColumn('collections', 'sort_order')) {
            $schema->table('collections', fn (Blueprint $table) => $table->integer('sort_order')->default(0));
        }

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
        // Collection data and columns are shared with the API and survive admin rollbacks.
    }
};

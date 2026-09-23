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
        if (! $schema->hasColumn('collections', 'selection_keywords')) {
            $schema->table('collections', fn (Blueprint $table) => $table->string('selection_keywords', 500)->nullable());
        }
        DB::connection('store')->table('collections')->where('slug', 'new-arrivals')->update([
            'selection_rule' => 'newest', 'status' => 'active', 'featured' => true,
        ]);
        $occasions = [
            ['halloween', 'Halloween', 'halloween, spooky, trick or treat, jack o lantern', 'Spooky graphics for October nights. Find Halloween designs on tees, hoodies and sweatshirts.'],
            ['christmas', 'Christmas', 'christmas, xmas, santa claus, merry and bright', 'Get dressed for the festive season with Christmas graphics, from everyday tees to warm layers.'],
            ['thanksgiving', 'Thanksgiving', 'thanksgiving, turkey day, grateful thankful blessed', 'Graphics for gathering around the table. Explore Thanksgiving tees and layers for the holiday.'],
            ['valentines-day', "Valentine's Day", "valentine, valentines, valentine’s, valentine's", 'Wear a little love. Find Valentine designs for a date, a gift or an everyday favorite.'],
            ['mothers-day', "Mother's Day", "mothers day, mother's day, mother’s day", 'Celebrate her with a graphic that feels personal. Browse Mother’s Day designs and choose her favorite fit.'],
            ['fathers-day', "Father's Day", "fathers day, father's day, father’s day", 'Find a design that suits Dad. Explore Father’s Day graphics on tees and comfortable layers.'],
        ];
        foreach ($occasions as $order => [$slug, $title, $keywords, $description]) {
            DB::connection('store')->table('collections')->insertOrIgnore([
                'public_id' => 'collection-'.$slug, 'slug' => $slug, 'title' => $title,
                'description' => $description, 'selection_rule' => 'keywords',
                'selection_keywords' => $keywords, 'status' => 'active',
                'featured' => true, 'sort_order' => $order + 10, 'indexable' => true,
            ]);
        }
    }

    public function down(): void
    {
        // Keep CMS content and the shared API column on rollback.
    }
};

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
        if (! $schema->hasColumn('collections', 'homepage_section')) {
            $schema->table('collections', fn (Blueprint $table) => $table->string('homepage_section', 32)->nullable()->after('selection_keywords'));
        }

        $db = DB::connection('store');
        collect([
            ['halloween', '/v1/merchandising/holiday-halloween.png'],
            ['thanksgiving', '/v1/merchandising/holiday-thanksgiving.png'],
            ['christmas', '/v1/merchandising/holiday-christmas.png'],
        ])->each(function (array $holiday) use ($db): void {
            $db->table('collections')->where('slug', $holiday[0])->update([
                'homepage_section' => 'holiday',
                'image_url' => DB::raw("coalesce(image_url, '{$holiday[1]}')"),
            ]);
        });

        $themes = [
            ['dog-lover', 'Dog Lover', 'dog', 'Playful graphics for people whose best days include a dog.', 'theme-dog-lover.png'],
            ['teacher', 'Teacher', 'teacher', 'Classroom-ready graphics for teachers, mentors and lifelong learners.', 'theme-teacher.png'],
            ['fishing', 'Fishing', 'fishing, fish', 'Easygoing graphics inspired by early water and one more cast.', 'theme-fishing.png'],
            ['trucker', 'Trucker', 'trucker, truck', 'Road-tested graphics made for drivers and long-haul stories.', 'theme-trucker.png'],
            ['funny', 'Funny', 'funny, humor', 'Dry wit, cheerful chaos and graphics that land the joke.', 'theme-funny.png'],
            ['nurse', 'Nurse', 'nurse, nursing', 'Thoughtful graphics for nurses and the care they bring every day.', 'theme-nurse.png'],
        ];
        collect($themes)->each(function (array $theme, int $index) use ($db): void {
            $db->table('collections')->insertOrIgnore([
                'public_id' => 'collection-'.$theme[0],
                'slug' => $theme[0],
                'title' => $theme[1],
                'selection_keywords' => $theme[2],
                'description' => $theme[3],
                'image_url' => '/v1/merchandising/'.$theme[4],
                'selection_rule' => 'keywords',
                'homepage_section' => 'theme',
                'status' => 'active',
                'featured' => true,
                'indexable' => true,
                'sort_order' => 100 + ($index * 10),
            ]);
            $db->table('collections')->where('slug', $theme[0])->whereNull('homepage_section')->update([
                'homepage_section' => 'theme',
            ]);
        });
    }

    public function down(): void
    {
        $schema = Schema::connection('store');
        if ($schema->hasColumn('collections', 'homepage_section')) {
            $schema->table('collections', fn (Blueprint $table) => $table->dropColumn('homepage_section'));
        }
    }
};

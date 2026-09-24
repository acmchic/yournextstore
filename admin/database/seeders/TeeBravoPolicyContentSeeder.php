<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class TeeBravoPolicyContentSeeder extends Seeder
{
    public function run(): void
    {
        (new TeeBravoPolicySeeder)->refreshContent();
    }
}

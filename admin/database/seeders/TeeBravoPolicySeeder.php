<?php

namespace Database\Seeders;

use App\Http\Controllers\Store\CheckoutSettingsController;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class TeeBravoPolicySeeder extends Seeder
{
    public function run(): void
    {
        $payload = json_decode(file_get_contents(base_path('../api/policies.teebravo.json')), true, 512, JSON_THROW_ON_ERROR);
        $db = DB::connection('store');
        $db->transaction(function () use ($db, $payload) {
            $current = $db->table('checkout_settings')->where('id', 1)->lockForUpdate()->first();
            if (! $current) {
                throw new RuntimeException('Run API checkout migrations before seeding policies.');
            }
            $db->table('checkout_settings')->where('id', 1)->update([
                ...$payload['rates'],
                ...$payload['delivery'],
                'details_json' => json_encode([...json_decode($current->details_json, true, 512, JSON_THROW_ON_ERROR), ...$payload['details']], JSON_THROW_ON_ERROR),
                'updated_at' => now(),
            ]);
            $values = CheckoutSettingsController::values();
            foreach ($payload['pages'] as $page) {
                preg_match_all('/\{\{([^{}]+)\}\}/', $page['content'], $matches);
                foreach ($matches[1] as $key) {
                    if ($page['published'] && trim($values[$key] ?? '') === '') {
                        throw new RuntimeException("Cannot publish {$page['slug']}: missing {$key}.");
                    }
                }
            }
            $db->table('legal_pages')->upsert(
                array_map(fn ($page) => [...$page, 'created_at' => now(), 'updated_at' => now()], $payload['pages']),
                ['slug'],
                ['title', 'content', 'published', 'updated_at'],
            );
        });
    }
}

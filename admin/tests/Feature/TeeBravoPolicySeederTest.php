<?php

namespace Tests\Feature;

use App\Http\Controllers\Store\CheckoutSettingsController;
use Database\Seeders\TeeBravoPolicyContentSeeder;
use Database\Seeders\TeeBravoPolicySeeder;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TeeBravoPolicySeederTest extends TestCase
{
    public function test_seed_publishes_complete_policies_without_duplicates_and_uses_live_rates(): void
    {
        config(['database.connections.store' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
        DB::purge('store');
        (require database_path('migrations/2026_09_08_000001_create_legal_pages_table.php'))->up();
        Schema::connection('store')->create('checkout_settings', function (Blueprint $table) {
            $table->id();
            $table->text('details_json');
            $table->boolean('pdp_assurance_enabled')->default(false);
            foreach (CheckoutSettingsController::DELIVERY_FIELDS as $field) {
                $table->integer($field)->nullable();
            }
            foreach (['standard_first_minor', 'standard_additional_minor', 'express_first_minor', 'express_additional_minor'] as $field) {
                $table->integer($field)->default(0);
            }
            $table->timestamp('updated_at')->nullable();
        });
        $db = DB::connection('store');
        $db->table('checkout_settings')->insert(['id' => 1, 'details_json' => '{}']);
        $db->table('legal_pages')->insert(['slug' => 'about', 'title' => 'Draft', 'content' => 'Draft', 'published' => false]);
        (new TeeBravoPolicySeeder)->run();
        (new TeeBravoPolicySeeder)->run();
        $this->assertSame(7, $db->table('legal_pages')->where('published', true)->count());
        foreach ($db->table('legal_pages')->pluck('content') as $content) {
            $this->assertStringNotContainsString('{{', CheckoutSettingsController::render($content));
        }
        $this->assertSame('help@teebravo.com', CheckoutSettingsController::values()['support_email']);
        $this->assertSame('5–7 business days', CheckoutSettingsController::values()['standard_transit']);
        $this->assertSame('1–2 business days', CheckoutSettingsController::values()['express_transit']);
        $this->assertFalse((bool) $db->table('checkout_settings')->value('pdp_assurance_enabled'));
        $db->table('checkout_settings')->update(['standard_first_minor' => 650]);
        $shipping = $db->table('legal_pages')->where('slug', 'shipping-policy')->value('content');
        $this->assertStringContainsString('$6.50', CheckoutSettingsController::render($shipping));

        $details = json_decode($db->table('checkout_settings')->value('details_json'), true);
        $details['business_name'] = 'TeeBravo operator';
        $details['business_address'] = 'Owner-managed address';
        $details['support_email'] = 'support@example.com';
        $details['restrictions'] = 'US destinations supported by our carrier.';
        $details['about_story'] = 'Previous editorial copy';
        $details['owner_note'] = 'Keep this setting';
        $db->table('checkout_settings')->update([
            'details_json' => json_encode($details),
            'processing_max_business_days' => 4,
            'pdp_assurance_enabled' => true,
        ]);
        $migration = require database_path('migrations/2026_09_25_000010_refresh_teebravo_policy_content.php');
        $migration->up();
        (new TeeBravoPolicyContentSeeder)->run();
        $values = CheckoutSettingsController::values();
        foreach (['business_name', 'business_address', 'support_email', 'restrictions', 'owner_note'] as $key) {
            $this->assertSame($details[$key], $values[$key]);
        }
        $this->assertNotSame($details['about_story'], $values['about_story']);
        $this->assertSame('$6.50', $values['standard_first']);
        $this->assertSame('1–4 business days', $values['processing_time']);
        $this->assertTrue((bool) $db->table('checkout_settings')->value('pdp_assurance_enabled'));
        $this->assertSame(7, $db->table('legal_pages')->count());
        foreach ($db->table('legal_pages')->pluck('content') as $content) {
            $rendered = CheckoutSettingsController::render($content);
            $this->assertStringNotContainsString('{{', $rendered);
            $this->assertStringNotContainsString('help@teebravo.com', $rendered);
        }

        // Invalid live delivery settings must roll back the entire content refresh.
        $db->table('checkout_settings')->update(['processing_min_business_days' => null]);
        $before = $db->table('checkout_settings')->first();
        $db->table('legal_pages')->where('slug', 'about')->update(['content' => 'Keep on failure']);
        try {
            (new TeeBravoPolicyContentSeeder)->run();
            $this->fail('Expected missing processing time to block publication.');
        } catch (\RuntimeException $error) {
            $this->assertStringContainsString('processing_time', $error->getMessage());
        }
        $this->assertEquals($before, $db->table('checkout_settings')->first());
        $this->assertSame('Keep on failure', $db->table('legal_pages')->where('slug', 'about')->value('content'));
    }
}

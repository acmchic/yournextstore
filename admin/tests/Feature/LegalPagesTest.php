<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Tests\TestCase;

class LegalPagesTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['database.connections.store' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
        DB::purge('store');
        (require database_path('migrations/2026_09_08_000001_create_legal_pages_table.php'))->up();
        Schema::connection('store')->create('activity_logs', function (Blueprint $table) {
            $table->id(); $table->integer('admin_user_id')->nullable(); $table->string('entity_type');
            $table->integer('entity_id'); $table->text('before_json'); $table->text('after_json'); $table->timestamp('created_at');
        });
    }

    public function test_guests_cannot_manage_policies(): void
    {
        $this->get('/legal')->assertRedirect('/login');
    }

    public function test_policy_can_be_created_published_and_unpublished_with_history(): void
    {
        $this->withoutMiddleware();
        $data = ['slug' => 'shipping', 'title' => 'Shipping', 'content' => 'Verified shipping conditions', 'published' => false];
        $this->post('/legal', $data)->assertRedirect('/legal');
        $id = DB::connection('store')->table('legal_pages')->value('id');
        $this->put('/legal/'.$id, [...$data, 'published' => true])->assertRedirect('/legal');
        $this->assertEquals(1, DB::connection('store')->table('legal_pages')->value('published'));
        $this->put('/legal/'.$id, $data)->assertRedirect('/legal');
        $this->assertEquals(0, DB::connection('store')->table('legal_pages')->value('published'));
        $this->assertEquals(3, DB::connection('store')->table('activity_logs')->count());
        $this->put('/legal/'.$id, [...$data, 'slug' => 'different-url'])->assertStatus(422);
    }

    public function test_invalid_or_duplicate_slugs_are_rejected(): void
    {
        $this->withoutMiddleware();
        $data = ['slug' => 'privacy', 'title' => 'Privacy', 'content' => 'Policy', 'published' => false];
        $this->post('/legal', $data)->assertRedirect('/legal');
        $this->postJson('/legal', $data)->assertUnprocessable()->assertJsonValidationErrors('slug');
        $this->postJson('/legal', [...$data, 'slug' => '../unsafe'])->assertUnprocessable()->assertJsonValidationErrors('slug');
    }
}

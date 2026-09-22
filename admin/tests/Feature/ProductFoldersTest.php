<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ProductFoldersTest extends TestCase
{
    public function test_folder_counts_filter_boundaries_and_pagination(): void
    {
        config(['database.connections.store' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
        DB::purge('store');
        $db = DB::connection('store');
        $pdo = $db->getPdo();
        $pdo->sqliteCreateFunction('CHAR_LENGTH', fn ($value) => mb_strlen($value));
        $pdo->sqliteCreateFunction('SUBSTRING_INDEX', fn ($value, $delimiter, $count) => implode($delimiter, array_slice(explode($delimiter, $value), 0, $count)));
        $db->statement('CREATE TABLE designs (id INTEGER PRIMARY KEY, name TEXT, source_path TEXT)');
        $db->statement('CREATE TABLE products (id INTEGER PRIMARY KEY, design_id INTEGER, title TEXT, slug TEXT, status TEXT, updated_at TEXT)');
        $db->statement('CREATE TABLE catalogs (id INTEGER, slug TEXT, name TEXT, active INTEGER, sort_order INTEGER)');
        $db->statement('CREATE TABLE catalog_assets (catalog_id INTEGER, status TEXT)');
        $db->statement('CREATE TABLE catalog_variants (catalog_id INTEGER, color_id INTEGER, active INTEGER)');
        $db->statement('CREATE TABLE catalog_colors (id INTEGER, active INTEGER)');
        collect(range(1, 25))->each(function ($id) use ($db) {
            $path = match ($id) {
                23 => 'external/ids/gmc/sub/art.png',
                24 => 'external/ids/gmc-other/art.png',
                25 => 'ids/gmc/sample.png',
                default => 'external/ids/gmc/art-'.$id.'.png',
            };
            $db->table('designs')->insert(['id' => $id, 'name' => 'Art', 'source_path' => $path]);
            $db->table('products')->insert(['id' => $id, 'design_id' => $id, 'title' => 'Art '.$id, 'slug' => 'art-'.$id, 'status' => $id === 1 ? 'draft' : 'active', 'updated_at' => $id === 1 ? '2026-09-23' : '2026-09-22']);
        });
        $this->actingAs(User::factory()->make(['id' => 1]))
            ->get('/products?folder=external/ids/gmc')
            ->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('products/index')
            ->where('productTotal', 25)
            ->where('productFolders.0.path', 'external/ids/gmc')
            ->where('productFolders.0.count', 23)
            ->where('products.total', 23)
            ->where('products.last_page', 2)
            ->where('products.data.0.id', 1)
            ->where('filters.folder', 'external/ids/gmc')
            ->where('products.next_page_url', fn ($url) => str_contains($url, 'folder=external%2Fids%2Fgmc') && str_contains($url, 'page=2')));
        $this->get('/products?folder=external/ids/gmc&status=draft')
            ->assertInertia(fn (Assert $page) => $page->where('products.total', 1));
        $this->get('/products?folder=external/ids/gmc&q=nonexistent')
            ->assertInertia(fn (Assert $page) => $page->where('products.total', 0));
        DB::purge('store');
    }
}

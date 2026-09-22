<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class ProductImportTest extends TestCase
{
    public function test_external_host_path_is_mapped_and_trial_is_limited_without_publish(): void
    {
        $root = sys_get_temp_dir().'/teebravo-import-'.uniqid();
        File::makeDirectory($root.'/public/design/external/ids/gmc', 0755, true);
        File::makeDirectory($root.'/.venv/bin', 0755, true);
        File::put($root.'/bootstrap-db.sh', "#!/bin/sh\nexit 0\n");
        File::put($root.'/.venv/bin/python', <<<'SH'
#!/bin/sh
printf '%s\n' "$@" > arguments.txt
printf '%s' '{"count":100,"total":101,"next_offset":100,"done":false,"results":[]}'
SH);
        chmod($root.'/.venv/bin/python', 0755);
        $root = realpath($root);
        $previous = $_ENV['POD_API_PATH'] ?? null;
        $_ENV['POD_API_PATH'] = $_SERVER['POD_API_PATH'] = $root;
        putenv('POD_API_PATH='.$root);
        config(['services.product_import.host_root' => '/home/images_ids/images']);
        try {
            $user = User::factory()->make(['id' => 1]);
            $this->actingAs($user)->postJson('/products/import', [
                'folder' => '/home/images_ids/images/ids/gmc', 'trial' => true, 'offset' => 0,
            ])->assertOk()->assertJsonPath('count', 100)->assertJsonPath('done', false);
            $arguments = File::get($root.'/arguments.txt');
            $this->assertStringContainsString($root.'/public/design/external/ids/gmc', $arguments);
            $this->assertStringContainsString("--limit\n100\n--offset\n0", $arguments);
            $this->assertStringNotContainsString('--publish', $arguments);
            File::makeDirectory($root.'/public/design/external/another-source/artwork', 0755, true);
            $this->actingAs($user)->postJson('/products/import', [
                'folder' => '/home/images_ids/images/another-source', 'trial' => true,
            ])->assertOk();
            $this->assertStringContainsString(
                $root.'/public/design/external/another-source', File::get($root.'/arguments.txt')
            );
            $this->actingAs($user)->postJson('/products/import', [
                'folder' => '/home/images_ids/images/ids/../../../../..',
            ])->assertUnprocessable()->assertJsonValidationErrors('folder');
            $this->actingAs($user)->postJson('/products/import', [
                'folder' => '/etc',
            ])->assertUnprocessable()->assertJsonValidationErrors('folder');
            config(['database.connections.store' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']]);
            DB::purge('store');
            DB::connection('store')->statement('CREATE TABLE products (public_id TEXT)');
            File::put($root.'/.venv/bin/python', str_replace(
                '"results":[]', '"results":[{"product_id":"missing-product","status":"created"}]',
                File::get($root.'/.venv/bin/python')
            ));
            $this->actingAs($user)->postJson('/products/import', [
                'folder' => '/home/images_ids/images/ids/gmc', 'trial' => true,
            ])->assertUnprocessable()->assertJsonValidationErrors('import');
            DB::purge('store');
        } finally {
            unset($_ENV['POD_API_PATH'], $_SERVER['POD_API_PATH']);
            if ($previous !== null) {
                $_ENV['POD_API_PATH'] = $_SERVER['POD_API_PATH'] = $previous;
            }
            putenv($previous === null ? 'POD_API_PATH' : 'POD_API_PATH='.$previous);
            File::deleteDirectory($root);
        }
    }

    public function test_guest_cannot_import(): void
    {
        $this->postJson('/products/import', ['folder' => '/tmp'])->assertUnauthorized();
    }
}

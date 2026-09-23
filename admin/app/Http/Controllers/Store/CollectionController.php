<?php

namespace App\Http\Controllers\Store;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class CollectionController extends Controller
{
    public function index()
    {
        $db = DB::connection('store');
        $assignments = $db->table('collection_products')->get()->groupBy('collection_id');

        return Inertia::render('collections/index', [
            'collections' => $db->table('collections')->orderBy('sort_order')->get()->map(function ($item) use ($assignments) {
                $item->product_ids = ($assignments[$item->id] ?? collect())->pluck('product_id')->all();

                return $item;
            }),
            'products' => $db->table('products')->select('id', 'title')->where('status', 'active')->orderBy('title')->get(),
        ]);
    }

    public function save(Request $request, ?int $collection = null)
    {
        $db = DB::connection('store');
        if ($collection) {
            abort_unless($db->table('collections')->where('id', $collection)->exists(), 404);
        }
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', 'max:190', Rule::unique('store.collections', 'slug')->ignore($collection)],
            'description' => ['nullable', 'string', 'max:5000'],
            'selection_rule' => ['required', Rule::in(['manual', 'newest', 'tees', 'keywords'])],
            'selection_keywords' => ['nullable', 'required_if:selection_rule,keywords', 'string', 'max:500', 'regex:/^[\pL\pN ,’\x{0027}&-]+$/u'],
            'homepage_section' => ['nullable', Rule::in(['theme', 'holiday'])],
            'status' => ['required', Rule::in(['draft', 'active'])],
            'featured' => ['required', 'boolean'],
            'sort_order' => ['required', 'integer', 'min:0', 'max:999'],
            'product_ids' => ['array'],
            'product_ids.*' => ['integer', 'distinct', Rule::exists('store.products', 'id')],
        ]);
        $ids = $data['product_ids'] ?? [];
        unset($data['product_ids']);
        $db->transaction(function () use ($db, $collection, $data, $ids) {
            if ($collection) {
                $db->table('collections')->where('id', $collection)->update($data);
            } else {
                $collection = $db->table('collections')->insertGetId([...$data, 'public_id' => (string) Str::uuid()]);
            }
            $db->table('collection_products')->where('collection_id', $collection)->delete();
            foreach ($ids as $order => $id) {
                $db->table('collection_products')->insert(['collection_id' => $collection, 'product_id' => $id, 'sort_order' => $order]);
            }
        });

        return redirect('/collections')->with('success', 'Collection saved.');
    }

    public function uploadImage(Request $request, int $collection)
    {
        $db = DB::connection('store');
        abort_unless($db->table('collections')->where('id', $collection)->exists(), 404);
        $request->validate([
            'asset' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:20480'],
        ]);
        $asset = $request->file('asset');
        $image = $asset === null ? false : getimagesize($asset->getRealPath());
        if ($image === false || $image[0] < 500 || $image[1] < 500) {
            throw ValidationException::withMessages([
                'asset' => 'Upload an image that is at least 500 by 500 pixels.',
            ]);
        }

        $extension = strtolower($asset->extension() ?: $asset->getClientOriginalExtension());
        $filename = 'collection-'.$collection.'-'.now()->format('YmdHis').'.'.$extension;
        $directory = $this->merchandisingRoot();
        File::ensureDirectoryExists($directory);
        $asset->move($directory, $filename);
        $db->table('collections')->where('id', $collection)->update([
            'image_url' => '/v1/merchandising/'.$filename,
            'updated_at' => now(),
        ]);

        return redirect('/collections')->with('success', 'Collection image saved.');
    }

    public function image(int $collection)
    {
        $imageUrl = DB::connection('store')->table('collections')->where('id', $collection)->value('image_url');
        abort_unless(is_string($imageUrl) && str_starts_with($imageUrl, '/v1/merchandising/'), 404);
        $filename = basename($imageUrl);
        $path = $this->merchandisingRoot().DIRECTORY_SEPARATOR.$filename;
        abort_unless(is_file($path), 404);

        return response()->file($path, ['Cache-Control' => 'no-cache']);
    }

    private function merchandisingRoot(): string
    {
        $configuredPath = env('POD_API_PATH');
        $apiPath = $configuredPath ?: base_path('../api');

        return (realpath($apiPath) ?: $apiPath).'/public/merchandising';
    }
}

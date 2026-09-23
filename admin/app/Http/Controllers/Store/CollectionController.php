<?php

namespace App\Http\Controllers\Store;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
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
        if ($collection) abort_unless($db->table('collections')->where('id', $collection)->exists(), 404);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', 'max:190', Rule::unique('store.collections', 'slug')->ignore($collection)],
            'description' => ['nullable', 'string', 'max:5000'],
            'selection_rule' => ['required', Rule::in(['manual', 'newest', 'tees', 'keywords'])],
            'selection_keywords' => ['nullable', 'required_if:selection_rule,keywords', 'string', 'max:500', 'regex:/^[\pL\pN ,’\x{0027}&-]+$/u'],
            'status' => ['required', Rule::in(['draft', 'active'])],
            'featured' => ['required', 'boolean'],
            'sort_order' => ['required', 'integer', 'min:0', 'max:999'],
            'product_ids' => ['array'],
            'product_ids.*' => ['integer', 'distinct', Rule::exists('store.products', 'id')],
        ]);
        $ids = $data['product_ids'] ?? [];
        unset($data['product_ids']);
        $db->transaction(function () use ($db, $collection, $data, $ids) {
            if ($collection) $db->table('collections')->where('id', $collection)->update($data);
            else $collection = $db->table('collections')->insertGetId([...$data, 'public_id' => (string) Str::uuid()]);
            $db->table('collection_products')->where('collection_id', $collection)->delete();
            foreach ($ids as $order => $id) $db->table('collection_products')->insert(['collection_id' => $collection, 'product_id' => $id, 'sort_order' => $order]);
        });
        return redirect('/collections')->with('success', 'Collection saved.');
    }
}

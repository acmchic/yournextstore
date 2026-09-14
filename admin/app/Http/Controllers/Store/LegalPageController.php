<?php

namespace App\Http\Controllers\Store;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class LegalPageController extends Controller
{
    public function index()
    {
        return Inertia::render('legal/index', ['pages' => DB::connection('store')->table('legal_pages')->orderBy('title')->get(), 'variables' => CheckoutSettingsController::values()]);
    }

    public function save(Request $request, ?int $page = null)
    {
        $table = DB::connection('store')->table('legal_pages');
        if ($page !== null) {
            abort_unless((clone $table)->where('id', $page)->exists(), 404);
        }
        $data = $request->validate([
            'slug' => ['required', 'string', 'max:120', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::unique('store.legal_pages', 'slug')->ignore($page)],
            'title' => ['required', 'string', 'max:200'],
            'content' => ['required', 'string', 'max:100000'],
            'published' => ['required', 'boolean'],
        ]);
        $data['updated_at'] = now();
        if ($data['published']) {
            if ($data['slug'] === 'shipping-policy') {
                foreach (['standard_first', 'standard_additional', 'express_first', 'express_additional'] as $rate) {
                    if (! str_contains($data['content'], '{{'.$rate.'}}')) {
                        throw ValidationException::withMessages(['content' => 'Shipping policy must retain all four dynamic rate fields.']);
                    }
                }
            }
            preg_match_all('/\{\{([a-z_]+)\}\}/', $data['content'], $matches);
            $values = $matches[1] ? CheckoutSettingsController::values() : [];
            $missing = array_filter($matches[1], fn ($key) => ! isset($values[$key]) || trim($values[$key]) === '');
            if ($missing) {
                throw ValidationException::withMessages(['content' => 'Complete Shipping & business settings before publishing: '.implode(', ', array_unique($missing))]);
            }
        }
        DB::connection('store')->transaction(function () use ($table, $page, $data, $request) {
            $before = $page ? (array) (clone $table)->where('id', $page)->lockForUpdate()->first() : [];
            if ($page === null) {
                $page = $table->insertGetId([...$data, 'created_at' => now()]);
            } else {
                // A published URL stays stable, including after it is unpublished.
                abort_if($before['slug'] !== $data['slug'], 422, 'Policy URLs cannot be changed. Create a new policy for a different URL.');
                $table->where('id', $page)->update($data);
            }
            DB::connection('store')->table('activity_logs')->insert([
                'admin_user_id' => $request->user()?->getAuthIdentifier(), 'entity_type' => 'legal_page', 'entity_id' => $page,
                'before_json' => json_encode($before, JSON_THROW_ON_ERROR), 'after_json' => json_encode($data, JSON_THROW_ON_ERROR), 'created_at' => now(),
            ]);
        });

        return redirect('/legal')->with('success', 'Policy saved. Published changes appear on the storefront shortly.');
    }
}

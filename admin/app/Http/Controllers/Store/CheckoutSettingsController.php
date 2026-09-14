<?php

namespace App\Http\Controllers\Store;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class CheckoutSettingsController extends Controller
{
    public const FIELDS = ['business_name', 'business_address', 'support_email', 'about_story', 'restrictions', 'returns_eligibility', 'returns_window', 'returns_method', 'returns_fees', 'refund_timing', 'privacy_details', 'terms_conditions'];

    public const DELIVERY_FIELDS = ['processing_min_business_days', 'processing_max_business_days', 'standard_transit_min_business_days', 'standard_transit_max_business_days', 'express_transit_min_business_days', 'express_transit_max_business_days'];

    public static function values(): array
    {
        $settings = DB::connection('store')->table('checkout_settings')->find(1);
        $values = json_decode($settings->details_json, true) ?? [];
        foreach (['standard', 'express'] as $method) {
            foreach (['first', 'additional'] as $part) {
                $values[$method.'_'.$part] = '$'.number_format($settings->{$method.'_'.$part.'_minor'} / 100, 2, '.', '');
            }
        }
        $values['processing_time'] = self::businessDayRange($settings->processing_min_business_days, $settings->processing_max_business_days);
        $values['standard_transit'] = self::businessDayRange($settings->standard_transit_min_business_days, $settings->standard_transit_max_business_days);
        $values['express_transit'] = self::businessDayRange($settings->express_transit_min_business_days, $settings->express_transit_max_business_days);

        return $values;
    }

    public static function render(string $content): string
    {
        return preg_replace_callback('/\{\{([a-z_]+)\}\}/', fn ($match) => self::values()[$match[1]] ?? $match[0], $content);
    }

    public function index()
    {
        $settings = DB::connection('store')->table('checkout_settings')->find(1);

        return Inertia::render('checkout/settings', ['settings' => $settings, 'details' => json_decode($settings->details_json, true), 'fields' => self::FIELDS]);
    }

    public function save(Request $request)
    {
        $rules = collect(['standard_first_minor', 'standard_additional_minor', 'express_first_minor', 'express_additional_minor'])
            ->mapWithKeys(fn ($key) => [$key => 'required|integer|min:0|max:100000'])->all();
        $deliveryRules = collect(self::DELIVERY_FIELDS)->mapWithKeys(fn ($key) => [
            $key => ['nullable', 'integer', 'min:0', 'max:60', 'required_if:pdp_assurance_enabled,true'],
        ])->all();
        $data = $request->validate([
            ...$rules,
            ...$deliveryRules,
            'pdp_assurance_enabled' => ['required', 'boolean'],
            'details' => ['required', 'array:'.implode(',', self::FIELDS)],
            'details.*' => 'nullable|string|max:5000',
            'details.support_email' => 'nullable|email|max:255',
        ]);
        foreach (['processing', 'standard_transit', 'express_transit'] as $range) {
            if (($data[$range.'_min_business_days'] ?? 0) > ($data[$range.'_max_business_days'] ?? 0)) {
                throw ValidationException::withMessages([$range.'_max_business_days' => 'Maximum days must be greater than or equal to minimum days.']);
            }
        }
        foreach (DB::connection('store')->table('legal_pages')->where('published', true)->pluck('content') as $content) {
            preg_match_all('/\{\{([a-z_]+)\}\}/', $content, $matches);
            foreach ($matches[1] as $key) {
                if (in_array($key, self::FIELDS, true) && trim($data['details'][$key] ?? '') === '') {
                    throw ValidationException::withMessages(['details.'.$key => 'Unpublish the policy before clearing a value used in it.']);
                }
                $deliveryRange = match ($key) {
                    'processing_time' => 'processing',
                    'standard_transit' => 'standard_transit',
                    'express_transit' => 'express_transit',
                    default => null,
                };
                if ($deliveryRange && ($data[$deliveryRange.'_min_business_days'] === null || $data[$deliveryRange.'_max_business_days'] === null)) {
                    throw ValidationException::withMessages([$deliveryRange.'_min_business_days' => 'Unpublish the shipping policy before clearing a delivery range used in it.']);
                }
            }
        }
        DB::connection('store')->transaction(function () use ($data, $request) {
            $before = DB::connection('store')->table('checkout_settings')->where('id', 1)->lockForUpdate()->first();
            $after = [...collect($data)->except('details')->all(), 'details_json' => json_encode($data['details'], JSON_THROW_ON_ERROR), 'updated_at' => now()];
            DB::connection('store')->table('checkout_settings')->where('id', 1)->update($after);
            DB::connection('store')->table('activity_logs')->insert(['admin_user_id' => $request->user()->id, 'entity_type' => 'checkout_settings', 'entity_id' => 1, 'before_json' => json_encode($before), 'after_json' => json_encode($after), 'created_at' => now()]);
        });

        return back()->with('success', 'Settings saved. Storefront policy caches refresh within 60 seconds; existing checkout sessions keep their quoted rates.');
    }

    private static function businessDayRange(?int $minimum, ?int $maximum): string
    {
        if ($minimum === null || $maximum === null) {
            return '';
        }
        if ($minimum === $maximum) {
            return $minimum.' business day'.($minimum === 1 ? '' : 's');
        }

        return $minimum.'–'.$maximum.' business days';
    }

    public function carts()
    {
        $db = DB::connection('store');
        $carts = $db->table('carts')->orderByDesc('updated_at')->paginate(30);
        $items = $db->table('cart_items as ci')->join('product_variants as pv', 'pv.id', '=', 'ci.product_variant_id')
            ->join('products as p', 'p.id', '=', 'pv.product_id')->join('catalog_variants as cv', 'cv.id', '=', 'pv.catalog_variant_id')
            ->join('catalogs as c', 'c.id', '=', 'cv.catalog_id')->join('catalog_colors as cc', 'cc.id', '=', 'cv.color_id')
            ->join('catalog_sizes as cs', 'cs.id', '=', 'cv.size_id')->whereIn('ci.cart_id', $carts->pluck('id'))
            ->select('ci.cart_id', 'ci.quantity', 'p.title', 'c.name as catalog', 'cc.name as color', 'cs.code as size', 'cv.default_price_minor as price_minor')->get();
        $attempts = $db->table('checkout_attempts')->whereIn('cart_id', $carts->pluck('id'))->select('cart_id', 'status', 'stripe_session_id', 'created_at')->orderByDesc('created_at')->get();

        return Inertia::render('checkout/carts', ['carts' => $carts, 'items' => $items, 'attempts' => $attempts]);
    }
}

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $db = DB::connection('store');
        if ($db->getDriverName() !== 'mysql' || ! Schema::connection('store')->hasTable('carts')) {
            return;
        }

        $db->unprepared(file_get_contents(base_path('../api/mysql/init/010_checkout_stripe_shipping.sql')));
        $drafts = [
            'privacy-policy' => ['Privacy Policy', "We collect your email, name and delivery address to process your order. Card details are collected by Stripe on its secure payment page.\n\nData use, retention, service providers, cookies, customer rights and privacy requests:\n{{privacy_details}}\n\nPrivacy contact: {{support_email}}\nBusiness: {{business_name}}\nAddress: {{business_address}}"],
            'terms-of-service' => ['Terms of Service', "{{terms_conditions}}\n\nBusiness: {{business_name}}\nAddress: {{business_address}}\nContact: {{support_email}}"],
            'about' => ['About TeeBravo', "{{about_story}}\n\nBusiness name: {{business_name}}\nBusiness address: {{business_address}}\nContact: {{support_email}}"],
            'shipping-policy' => ['Shipping Policy', "We ship to the United States.\n\nShipping charges (USD)\nStandard: {{standard_first}} for the first item and {{standard_additional}} for each additional item in the same order.\nExpress: {{express_first}} for the first item and {{express_additional}} for each additional item in the same order.\n\nProcessing time: {{processing_time}}\nStandard delivery estimate after processing: {{standard_transit}}\nExpress delivery estimate after processing: {{express_transit}}\nDestination and delivery restrictions: {{restrictions}}\n\nYour selected shipping charge and applicable taxes are shown before payment.\nShipping questions: {{support_email}}"],
            'return-policy' => ['Returns & Refunds', "Return eligibility (including defective items, change of mind and incorrect size selections):\n{{returns_eligibility}}\n\nRequest window: {{returns_window}}\nHow to request a return and where to send approved returns: {{returns_method}}\nReturn shipping and other fees: {{returns_fees}}\nRefund processing and timing: {{refund_timing}}\n\nContact: {{support_email}}"],
        ];
        foreach ($drafts as $slug => [$title, $content]) {
            $db->table('legal_pages')->insertOrIgnore(['slug' => $slug, 'title' => $title, 'content' => $content, 'published' => false, 'created_at' => now(), 'updated_at' => now()]);
        }
    }

    public function down(): void
    {
        // Payment records and owner-edited policies must survive a code rollback.
    }
};

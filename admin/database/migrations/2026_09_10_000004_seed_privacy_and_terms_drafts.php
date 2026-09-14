<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::connection('store')->hasTable('legal_pages')) {
            return;
        }

        $drafts = [
            'privacy-policy' => ['Privacy Policy', "We collect your email, name and delivery address to process your order. Card details are collected by Stripe on its secure payment page.\n\nData use, retention, service providers, cookies, customer rights and privacy requests:\n{{privacy_details}}\n\nPrivacy contact: {{support_email}}\nBusiness: {{business_name}}\nAddress: {{business_address}}"],
            'terms-of-service' => ['Terms of Service', "{{terms_conditions}}\n\nBusiness: {{business_name}}\nAddress: {{business_address}}\nContact: {{support_email}}"],
        ];
        foreach ($drafts as $slug => [$title, $content]) {
            DB::connection('store')->table('legal_pages')->insertOrIgnore(['slug' => $slug, 'title' => $title, 'content' => $content, 'published' => false, 'created_at' => now(), 'updated_at' => now()]);
        }
    }

    public function down(): void {}
};

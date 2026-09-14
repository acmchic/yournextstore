<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class OperationsTest extends TestCase
{
    use RefreshDatabase;

    public function test_guests_cannot_access_operations(): void
    {
        $this->get('/operations')->assertRedirect('/login');
        $this->post('/operations/analyze-catalog-mockups')->assertRedirect('/login');
    }

    public function test_authenticated_admin_can_view_approved_operations(): void
    {
        $this->actingAs(User::factory()->create())
            ->get('/operations')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('operations/index')
                ->has('importFolders')
                ->has('operations', 4)
                ->where('operations.0.id', 'analyze-catalog-mockups'));
    }

    public function test_unknown_operation_is_rejected_without_running_a_command(): void
    {
        $this->actingAs(User::factory()->create())
            ->post('/operations/arbitrary-shell-command')
            ->assertNotFound();
    }
}

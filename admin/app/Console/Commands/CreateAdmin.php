<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class CreateAdmin extends Command
{
    protected $signature = 'admin:create {email} {--name= : Administrator name}';

    protected $description = 'Create an admin account using an interactive, hidden password prompt';

    public function handle(): int
    {
        $data = [
            'email' => strtolower((string) $this->argument('email')),
            'name' => $this->option('name') ?: $this->ask('Name'),
            'password' => $this->secret('Password (at least 12 characters)'),
            'password_confirmation' => $this->secret('Confirm password'),
        ];
        $validator = Validator::make($data, [
            'email' => 'required|email|max:255|unique:users,email', 'name' => 'required|string|max:255',
            'password' => ['required', 'confirmed', Password::min(12)->letters()->numbers()],
        ]);
        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }
        $user = User::create(collect($data)->only(['email', 'name', 'password'])->all());
        $user->forceFill(['email_verified_at' => now()])->save();
        $this->info('Admin account created.');

        return self::SUCCESS;
    }
}

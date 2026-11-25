<?php

namespace App\Providers;

use App\Contracts\CatalogSource;
use App\Repositories\FixtureCatalogSource;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Keep the API on synthetic data until a separately reviewed read-only adapter is approved.
        $this->app->bind(CatalogSource::class, FixtureCatalogSource::class);
    }

    public function boot(): void
    {
        //
    }
}

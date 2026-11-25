<?php

use Illuminate\\Support\\Facades\\Route;

Route::get('/health', function () {
    return response()->json([
        'ok' => true,
        'service' => 'muslimabaya-api',
        'version' => 'v1',
    ]);
})->name('api.health');

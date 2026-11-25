<?php

use Illuminate\\Support\\Facades\\Route;

Route::get('/', function () {
    return response()->json([
        'service' => 'muslimabaya-api',
        'message' => 'API service is running.',
    ]);
});

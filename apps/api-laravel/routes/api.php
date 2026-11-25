<?php

use App\Contracts\CatalogSource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'ok' => true,
        'service' => 'muslimabaya-api',
        'version' => 'v1',
    ]);
})->name('api.health');

Route::prefix('/v1/catalog')->group(function (): void {
    Route::get('/products', function (Request $request, CatalogSource $catalog) {
        $validated = $request->validate([
            'category' => ['sometimes', 'string', 'max:80'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $products = $catalog->publishedProducts($validated['category'] ?? null);
        $perPage = (int) ($validated['per_page'] ?? 24);
        $page = (int) ($validated['page'] ?? 1);
        $total = count($products);
        $items = array_slice($products, ($page - 1) * $perPage, $perPage);

        return response()->json([
            'data_source' => 'fixture',
            'data' => $items,
            'meta' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'last_page' => max(1, (int) ceil($total / $perPage)),
            ],
        ])->header('Cache-Control', 'no-store');
    })->name('catalog.products.index');

    Route::get('/products/{productId}', function (string $productId, CatalogSource $catalog) {
        $product = $catalog->findPublishedById($productId);

        if ($product === null) {
            return response()->json([
                'data_source' => 'fixture',
                'message' => 'Product not found.',
            ], 404);
        }

        return response()->json([
            'data_source' => 'fixture',
            'data' => $product,
        ])->header('Cache-Control', 'no-store');
    })->name('catalog.products.show');
});

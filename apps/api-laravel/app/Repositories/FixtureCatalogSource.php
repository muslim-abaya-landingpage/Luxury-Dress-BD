<?php

namespace App\Repositories;

use App\Contracts\CatalogSource;
use App\Support\CatalogFixture;

class FixtureCatalogSource implements CatalogSource
{
    public function publishedProducts(?string $category = null): array
    {
        return array_values(array_filter(
            CatalogFixture::products(),
            static fn (array $product): bool =>
                $product['published']
                && ($category === null || $product['category'] === $category)
        ));
    }

    public function findPublishedById(string $productId): ?array
    {
        return CatalogFixture::findPublishedById($productId);
    }
}

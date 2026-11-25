<?php

namespace App\Contracts;

interface CatalogSource
{
    /**
     * Return published catalog records in the API's canonical shape.
     *
     * @return array<int, array<string, mixed>>
     */
    public function publishedProducts(?string $category = null): array;

    /**
     * Return one published product by its immutable Product ID.
     *
     * @return array<string, mixed>|null
     */
    public function findPublishedById(string $productId): ?array;
}

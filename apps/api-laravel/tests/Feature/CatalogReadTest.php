<?php

namespace Tests\Feature;

use Tests\TestCase;

class CatalogReadTest extends TestCase
{
    public function test_catalog_lists_only_published_fixture_products(): void
    {
        $response = $this->getJson('/api/v1/catalog/products');

        $response->assertOk()
            ->assertJsonPath('data_source', 'fixture')
            ->assertJsonPath('meta.total', 2)
            ->assertJsonMissing(['product_id' => 'MA-DEMO-003']);
    }

    public function test_catalog_can_filter_by_category_and_paginate(): void
    {
        $this->getJson('/api/v1/catalog/products?category=hijab')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.product_id', 'MA-DEMO-002');

        $this->getJson('/api/v1/catalog/products?per_page=1&page=2')
            ->assertOk()
            ->assertJsonPath('meta.current_page', 2)
            ->assertJsonPath('meta.per_page', 1)
            ->assertJsonCount(1, 'data');
    }

    public function test_catalog_rejects_invalid_pagination(): void
    {
        $this->getJson('/api/v1/catalog/products?per_page=101')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['per_page']);
    }

    public function test_product_detail_returns_published_product_only(): void
    {
        $this->getJson('/api/v1/catalog/products/MA-DEMO-001')
            ->assertOk()
            ->assertJsonPath('data.product_id', 'MA-DEMO-001')
            ->assertJsonPath('data_source', 'fixture');

        $this->getJson('/api/v1/catalog/products/MA-DEMO-003')->assertNotFound();
        $this->getJson('/api/v1/catalog/products/DOES-NOT-EXIST')->assertNotFound();
    }
}

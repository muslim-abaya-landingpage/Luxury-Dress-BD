<?php

namespace Tests\Unit;

use App\Support\CatalogSnapshotReconciler;
use PHPUnit\Framework\TestCase;

class CatalogSnapshotReconcilerTest extends TestCase
{
    private function snapshot(string $sha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'): array
    {
        return [
            'sha' => $sha,
            'files' => [
                'category-products.js' => 'window.CATEGORY_PRODUCTS = {};',
                'product-links-data.js' => 'window.PRODUCT_LINKS_DATA = {};',
                'product-catalog-sections.js' => 'window.PRODUCT_CATALOG_SECTIONS = {};',
                'product-config.js' => 'window.SITE_LINKS = {};',
            ],
            'validation' => json_encode([
                'version' => 1,
                'releaseSha' => $sha,
                'products' => [],
            ]),
        ];
    }

    public function test_same_release_and_same_files_are_in_sync(): void
    {
        self::assertSame(
            ['status' => 'in_sync', 'reason' => 'same_release_and_file_hashes'],
            CatalogSnapshotReconciler::compare($this->snapshot(), $this->snapshot())
        );
    }

    public function test_different_release_sha_is_not_merged(): void
    {
        $result = CatalogSnapshotReconciler::compare(
            $this->snapshot(),
            $this->snapshot('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
        );

        self::assertSame('different_release', $result['status']);
        self::assertSame('release_sha_mismatch', $result['reason']);
    }

    public function test_same_sha_with_different_file_content_is_a_conflict(): void
    {
        $d1 = $this->snapshot();
        $d1['files']['category-products.js'] .= ' // drift';

        $result = CatalogSnapshotReconciler::compare($this->snapshot(), $d1);

        self::assertSame('conflict', $result['status']);
        self::assertSame('file_content_mismatch', $result['reason']);
    }

    public function test_validation_release_must_match_snapshot_sha(): void
    {
        $d1 = $this->snapshot();
        $d1['validation'] = json_encode([
            'version' => 1,
            'releaseSha' => 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            'products' => [],
        ]);

        $result = CatalogSnapshotReconciler::compare($this->snapshot(), $d1);

        self::assertSame('conflict', $result['status']);
        self::assertSame('validation_release_mismatch', $result['reason']);
    }

    public function test_missing_catalog_file_is_invalid(): void
    {
        $d1 = $this->snapshot();
        unset($d1['files']['product-config.js']);

        self::assertSame(
            ['status' => 'invalid', 'reason' => 'missing_catalog_file'],
            CatalogSnapshotReconciler::compare($this->snapshot(), $d1)
        );
    }
}

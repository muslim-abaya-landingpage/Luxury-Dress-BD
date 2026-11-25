<?php

namespace App\Support;

class CatalogSnapshotReconciler
{
    private const REQUIRED_FILES = [
        'category-products.js',
        'product-links-data.js',
        'product-catalog-sections.js',
        'product-config.js',
    ];

    /**
     * Compare GitHub's committed catalog with the D1 instant-publish overlay.
     * Different releases are never merged automatically.
     *
     * @param array<string, mixed> $github
     * @param array<string, mixed> $d1
     * @return array{status: 'in_sync'|'different_release'|'conflict'|'invalid', reason: string}
     */
    public static function compare(array $github, array $d1): array
    {
        foreach ([$github, $d1] as $snapshot) {
            if (!isset($snapshot['sha'], $snapshot['files'])
                || !is_string($snapshot['sha'])
                || !preg_match('/^[a-f0-9]{40}$/', $snapshot['sha'])
                || !is_array($snapshot['files'])) {
                return ['status' => 'invalid', 'reason' => 'invalid_snapshot_envelope'];
            }

            foreach (self::REQUIRED_FILES as $file) {
                if (!isset($snapshot['files'][$file]) || !is_string($snapshot['files'][$file])) {
                    return ['status' => 'invalid', 'reason' => 'missing_catalog_file'];
                }
            }
        }

        if ($github['sha'] !== $d1['sha']) {
            return ['status' => 'different_release', 'reason' => 'release_sha_mismatch'];
        }

        foreach (self::REQUIRED_FILES as $file) {
            if (!hash_equals(
                hash('sha256', $github['files'][$file]),
                hash('sha256', $d1['files'][$file])
            )) {
                return ['status' => 'conflict', 'reason' => 'file_content_mismatch'];
            }
        }

        if (isset($d1['validation'])) {
            if (!is_string($d1['validation'])) {
                return ['status' => 'invalid', 'reason' => 'invalid_validation_payload'];
            }

            $validation = json_decode($d1['validation'], true);
            if (!is_array($validation)
                || ($validation['releaseSha'] ?? null) !== $d1['sha']
                || !is_array($validation['products'] ?? null)) {
                return ['status' => 'conflict', 'reason' => 'validation_release_mismatch'];
            }
        }

        return ['status' => 'in_sync', 'reason' => 'same_release_and_file_hashes'];
    }
}

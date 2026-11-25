<?php

namespace Tests\\Feature;

use Tests\\TestCase;

class HealthTest extends TestCase
{
    public function test_api_health_endpoint_returns_a_safe_status_payload(): void
    {
        $response = $this->getJson('/api/health');

        $response
            ->assertOk()
            ->assertJson([
                'ok' => true,
                'service' => 'muslimabaya-api',
                'version' => 'v1',
            ])
            ->assertJsonMissingPath('env')
            ->assertJsonMissingPath('database');
    }

    public function test_framework_health_endpoint_is_available(): void
    {
        $this->get('/up')->assertOk();
    }
}

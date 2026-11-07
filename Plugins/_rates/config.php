<?php
// Copy to config.php and enter your Hostinger database password.
// Keep config.php private; never commit or publish it.
return [
    'db' => [
        'host' => 'localhost',
        'name' => 'u364134727_rates',
        'user' => 'u364134727_rates_user',
        'pass' => 'yK1&HXN5>',
        'charset' => 'utf8mb4',
    ],
    // Change this before deployment.
    'admin_password' => 'Rates@2027',
    // Generate a long random string for API access.
    'api_key' => '2cf1179d5ca5b71b3cc886d36cd6cc1219d51825c70e764c',
    'upload_dir' => __DIR__ . '/storage/uploads',
    'max_upload_mb' => 30,
];
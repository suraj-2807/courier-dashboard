<?php
declare(strict_types=1);
// Database connection singleton — extracted from original index.php
// NEVER modify config.php credentials

function db(): PDO {
    static $pdo = null;
    if (!$pdo) {
        $config = require dirname(__DIR__) . '/config.php';
        $d = $config['db'];
        $pdo = new PDO(
            "mysql:host={$d['host']};dbname={$d['name']};charset={$d['charset']}",
            $d['user'], $d['pass'],
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false
            ]
        );
    }
    return $pdo;
}

function getConfig(): array {
    static $config = null;
    if (!$config) {
        $config = require dirname(__DIR__) . '/config.php';
    }
    return $config;
}

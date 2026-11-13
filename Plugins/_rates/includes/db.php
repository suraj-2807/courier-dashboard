<?php
declare(strict_types=1);
// Database connection singleton — extracted from original index.php
// NEVER modify config.php credentials

function db(bool $forceReconnect = false): PDO {
    static $pdo = null;
    if ($forceReconnect || !$pdo) {
        $pdo = null;
        $config = require dirname(__DIR__) . '/config.php';
        $d = $config['db'];
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => 300
        ];
        if (defined('PDO::MYSQL_ATTR_INIT_COMMAND')) {
            $options[PDO::MYSQL_ATTR_INIT_COMMAND] = "SET SESSION wait_timeout=600, interactive_timeout=600";
        }
        $pdo = new PDO(
            "mysql:host={$d['host']};dbname={$d['name']};charset={$d['charset']}",
            $d['user'], $d['pass'],
            $options
        );
    }
    return $pdo;
}

function ensureDbConnection(?PDO &$pdo = null): PDO {
    if ($pdo !== null) {
        try {
            $pdo->query("SELECT 1");
            return $pdo;
        } catch (\Throwable $e) {
            // Connection lost (e.g. 2006 MySQL server has gone away), reconnect below
            $pdo = null;
        }
    }
    $pdo = db(true);
    return $pdo;
}

function getConfig(): array {
    static $config = null;
    if (!$config) {
        $config = require dirname(__DIR__) . '/config.php';
    }
    return $config;
}

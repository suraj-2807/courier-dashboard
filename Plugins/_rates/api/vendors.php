<?php
declare(strict_types=1);

// Vendor Management API Endpoint
require_once __DIR__ . '/_middleware.php';

$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        $slug = trim((string)($_GET['slug'] ?? ''));
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

        if ($slug !== '' || $id > 0) {
            $sql = "SELECT v.*,
                    (SELECT COUNT(*) FROM import_batches b WHERE b.vendor_id=v.id AND b.status='active') active_versions,
                    (SELECT SUM(imported_rows) FROM import_batches b WHERE b.vendor_id=v.id AND b.status='active') total_rows,
                    (SELECT id FROM import_batches b WHERE b.vendor_id=v.id AND b.status='active' ORDER BY b.is_latest DESC, b.id DESC LIMIT 1) active_batch_id
                    FROM vendors v WHERE " . ($slug !== '' ? "v.slug = ?" : "v.id = ?");
            $st = $pdo->prepare($sql);
            $st->execute([$slug !== '' ? strtolower($slug) : $id]);
            $vendor = $st->fetch();

            if (!$vendor) apiRespond(404, ['ok' => false, 'error' => 'Vendor not found.']);

            // Get worksheets for active batch
            $worksheets = [];
            if ($vendor['active_batch_id']) {
                $worksheets = getVendorWorksheets($pdo, (int)$vendor['id'], (int)$vendor['active_batch_id']);
            }

            apiRespond(200, ['ok' => true, 'vendor' => $vendor, 'worksheets' => $worksheets]);
        }

        $activeOnly = isset($_GET['active']) && $_GET['active'] === '1';
        $sql = "SELECT v.*,
                (SELECT COUNT(*) FROM import_batches b WHERE b.vendor_id=v.id AND b.status='active') active_versions,
                (SELECT SUM(imported_rows) FROM import_batches b WHERE b.vendor_id=v.id AND b.status='active') total_rows,
                (SELECT MAX(created_at) FROM import_batches b WHERE b.vendor_id=v.id) last_upload
                FROM vendors v";
        if ($activeOnly) $sql .= " WHERE v.is_active = 1";
        $sql .= " ORDER BY v.name";

        $vendors = $pdo->query($sql)->fetchAll();
        apiRespond(200, ['ok' => true, 'vendors' => $vendors, 'count' => count($vendors)]);

    } elseif ($method === 'POST') {
        $input = getJsonInput();
        $name = trim($input['name'] ?? '');
        if ($name === '') apiRespond(400, ['ok' => false, 'error' => 'Vendor name is required.']);

        $slug = slugify($name);
        $existing = $pdo->prepare("SELECT id FROM vendors WHERE slug = ?");
        $existing->execute([$slug]);
        if ($existing->fetch()) {
            apiRespond(409, ['ok' => false, 'error' => "Vendor with slug '{$slug}' already exists."]);
        }

        $contact = clean($input['contact_info'] ?? null);
        $notes = clean($input['notes'] ?? null);

        $st = $pdo->prepare("INSERT INTO vendors (name, slug, is_active, contact_info, notes) VALUES (?, ?, 1, ?, ?)");
        $st->execute([$name, $slug, $contact, $notes]);
        $vendorId = (int)$pdo->lastInsertId();

        apiRespond(201, ['ok' => true, 'id' => $vendorId, 'name' => $name, 'slug' => $slug, 'message' => 'Vendor created successfully.']);

    } elseif ($method === 'PATCH') {
        $input = getJsonInput();
        if (empty($input)) {
            $input = !empty($_POST) ? $_POST : $_GET;
        }

        $id = (int)($_GET['id'] ?? ($input['id'] ?? 0));
        if ($id <= 0) apiRespond(400, ['ok' => false, 'success' => false, 'error' => 'id is required.']);

        $vendor = getVendorById($pdo, $id);
        if (!$vendor) apiRespond(404, ['ok' => false, 'success' => false, 'error' => 'Vendor not found.']);

        // Support { field: "name", value: "New Name" } format
        if (isset($input['field']) && array_key_exists('value', $input)) {
            $fieldName = trim((string)$input['field']);
            $input[$fieldName] = $input['value'];
        }

        $updates = [];
        $params = [];

        if (array_key_exists('name', $input) && trim((string)$input['name']) !== '') {
            $updates[] = "name = ?";
            $params[] = trim((string)$input['name']);
        }
        if (array_key_exists('contact_info', $input)) {
            $updates[] = "contact_info = ?";
            $params[] = clean($input['contact_info']);
        }
        if (array_key_exists('notes', $input)) {
            $updates[] = "notes = ?";
            $params[] = clean($input['notes']);
        }
        if (array_key_exists('is_active', $input)) {
            $updates[] = "is_active = ?";
            $params[] = (int)!empty($input['is_active']);
        }

        if (empty($updates)) apiRespond(400, ['ok' => false, 'success' => false, 'error' => 'No valid fields provided to update.']);

        $params[] = $id;
        $sql = "UPDATE vendors SET " . implode(', ', $updates) . " WHERE id = ?";
        $pdo->prepare($sql)->execute($params);

        apiRespond(200, ['ok' => true, 'success' => true, 'id' => $id, 'message' => 'Vendor updated successfully.']);

    } else {
        apiRespond(405, ['ok' => false, 'error' => 'Method not allowed.']);
    }
} catch (Throwable $e) {
    apiRespond(500, ['ok' => false, 'error' => 'Server error', 'detail' => $e->getMessage()]);
}

<?php
// Vendors Page — list all vendors, add new vendor
$vendors = $pdo->query("
    SELECT v.*,
    (SELECT COUNT(*) FROM import_batches b WHERE b.vendor_id=v.id AND b.status='active') active_versions,
    (SELECT SUM(imported_rows) FROM import_batches b WHERE b.vendor_id=v.id AND b.status='active') total_rows,
    (SELECT MAX(created_at) FROM import_batches b WHERE b.vendor_id=v.id) last_upload
    FROM vendors v ORDER BY v.name
")->fetchAll();

// Handle add vendor
if (isset($_POST['add_vendor'])) {
    $name = trim($_POST['new_vendor_name'] ?? '');
    if ($name !== '') {
        $slug = slugify($name);
        $existing = $pdo->prepare("SELECT id FROM vendors WHERE slug = ?");
        $existing->execute([$slug]);
        if (!$existing->fetch()) {
            $pdo->prepare("INSERT INTO vendors(name, slug) VALUES(?, ?)")->execute([$name, $slug]);
            echo '<div class="alert alert-success">✓ Vendor "' . h($name) . '" created.</div>';
            // Refresh
            $vendors = $pdo->query("SELECT v.*, (SELECT COUNT(*) FROM import_batches b WHERE b.vendor_id=v.id AND b.status='active') active_versions, (SELECT SUM(imported_rows) FROM import_batches b WHERE b.vendor_id=v.id AND b.status='active') total_rows, (SELECT MAX(created_at) FROM import_batches b WHERE b.vendor_id=v.id) last_upload FROM vendors v ORDER BY v.name")->fetchAll();
        } else {
            echo '<div class="alert alert-warning">Vendor with slug "' . h($slug) . '" already exists.</div>';
        }
    }
}

// Handle toggle active
if (isset($_POST['toggle_vendor'])) {
    $vid = (int)$_POST['vendor_id'];
    $pdo->prepare("UPDATE vendors SET is_active = NOT is_active WHERE id = ?")->execute([$vid]);
    header("Location: ?page=vendors"); exit;
}

// Handle edit vendor
if (isset($_POST['edit_vendor'])) {
    $vid = (int)$_POST['vendor_id'];
    $name = trim($_POST['edit_name'] ?? '');
    $contact = trim($_POST['edit_contact'] ?? '');
    $notes = trim($_POST['edit_notes'] ?? '');
    if ($name !== '') {
        $pdo->prepare("UPDATE vendors SET name = ?, contact_info = ?, notes = ? WHERE id = ?")
            ->execute([$name, $contact ?: null, $notes ?: null, $vid]);
        echo '<div class="alert alert-success">✓ Vendor updated.</div>';
        $vendors = $pdo->query("SELECT v.*, (SELECT COUNT(*) FROM import_batches b WHERE b.vendor_id=v.id AND b.status='active') active_versions, (SELECT SUM(imported_rows) FROM import_batches b WHERE b.vendor_id=v.id AND b.status='active') total_rows, (SELECT MAX(created_at) FROM import_batches b WHERE b.vendor_id=v.id) last_upload FROM vendors v ORDER BY v.name")->fetchAll();
    }
}
?>

<div class="flex-between mb-24">
    <div>
        <h2>Vendors</h2>
        <p class="text-muted text-sm">Manage your shipping vendors and their rate data</p>
    </div>
    <button class="btn btn-primary" onclick="document.getElementById('add-vendor-form').classList.toggle('hidden')">+ Add Vendor</button>
</div>

<div id="add-vendor-form" class="card hidden mb-24 slide-down">
    <h3 class="mb-16">Add New Vendor</h3>
    <form method="post" action="?page=vendors">
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Vendor Name</label>
                <input class="form-control" name="new_vendor_name" placeholder="e.g. DHL Express" required>
            </div>
            <div class="form-group" style="display:flex;align-items:flex-end;">
                <button type="submit" name="add_vendor" class="btn btn-primary">Create Vendor</button>
            </div>
        </div>
    </form>
</div>

<?php if (empty($vendors)): ?>
    <div class="empty-state card">
        <div class="empty-icon">📦</div>
        <p>No vendors yet. Add a vendor or upload a workbook to get started.</p>
    </div>
<?php else: ?>
    <div class="vendor-grid">
    <?php foreach ($vendors as $v): ?>
        <a href="?page=vendor_detail&slug=<?= h($v['slug']) ?>" class="vendor-card" style="text-decoration:none; color:inherit;">
            <div class="flex-between">
                <div>
                    <div class="vendor-name"><?= h($v['name']) ?></div>
                    <div class="vendor-slug"><?= h($v['slug']) ?></div>
                </div>
                <span class="badge <?= $v['is_active'] ? 'badge-success' : 'badge-neutral' ?>"><?= $v['is_active'] ? 'Active' : 'Inactive' ?></span>
            </div>
            <div class="vendor-meta">
                <span>📊 <?= number_format((int)($v['total_rows'] ?? 0)) ?> rows</span>
                <span>📁 <?= (int)$v['active_versions'] ?> active version<?= (int)$v['active_versions'] !== 1 ? 's' : '' ?></span>
                <span>🕐 <?= $v['last_upload'] ? date('M j, Y', strtotime($v['last_upload'])) : 'Never' ?></span>
            </div>
        </a>
    <?php endforeach; ?>
    </div>
<?php endif; ?>

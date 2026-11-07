<?php
// Pagination partial — expects $total, $pagination vars
$totalPages = max(1, (int)ceil($total / $pagination['per_page']));
$currentPage = $pagination['page'];

if ($totalPages > 1):
    // Build base URL preserving current query params
    $params = $_GET;
    unset($params['pg']);
    $baseUrl = '?' . http_build_query($params);
?>
<div class="table-footer">
    <span>Showing <?= number_format($pagination['offset'] + 1) ?>–<?= number_format(min($pagination['offset'] + $pagination['per_page'], $total)) ?> of <?= number_format($total) ?></span>
    <div class="pagination">
        <?php if ($currentPage > 1): ?>
            <a href="<?= $baseUrl ?>&pg=<?= $currentPage - 1 ?>">‹</a>
        <?php endif; ?>
        <?php
        $start = max(1, $currentPage - 3);
        $end = min($totalPages, $currentPage + 3);
        if ($start > 1): ?><a href="<?= $baseUrl ?>&pg=1">1</a><?php if ($start > 2): ?><span>…</span><?php endif; endif;
        for ($p = $start; $p <= $end; $p++):
            if ($p === $currentPage): ?>
                <span class="current"><?= $p ?></span>
            <?php else: ?>
                <a href="<?= $baseUrl ?>&pg=<?= $p ?>"><?= $p ?></a>
            <?php endif;
        endfor;
        if ($end < $totalPages): if ($end < $totalPages - 1): ?><span>…</span><?php endif; ?><a href="<?= $baseUrl ?>&pg=<?= $totalPages ?>"><?= $totalPages ?></a><?php endif; ?>
        <?php if ($currentPage < $totalPages): ?>
            <a href="<?= $baseUrl ?>&pg=<?= $currentPage + 1 ?>">›</a>
        <?php endif; ?>
    </div>
</div>
<?php endif; ?>

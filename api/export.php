<?php
/**
 * Export API Endpoint
 * 
 * Export contacts to VCF file.
 * GET: Download VCF file
 */

declare(strict_types=1);

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../autoload.php';

$manager = new ContactManager();
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
    errorResponse('Method not allowed', 405);
}

// Get parameters
$fileId = isset($_GET['file_id']) ? Security::sanitizeString($_GET['file_id']) : null;
$ids = isset($_GET['ids']) ? explode(',', Security::sanitizeString($_GET['ids'])) : null;
$filename = isset($_GET['filename']) ? Security::sanitizeString($_GET['filename']) : 'contacts';

// Sanitize filename
$filename = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $filename);
if (empty($filename)) {
    $filename = 'contacts';
}

// Add timestamp if requested
if (isset($_GET['timestamp']) && $_GET['timestamp'] === '1') {
    $filename .= '_' . date('Y-m-d_His');
}

// Generate VCF content
$vcfContent = $manager->exportToVCF($ids, $fileId);

if (empty($vcfContent)) {
    errorResponse('No contacts to export', 404);
}

// Send file download
header('Content-Type: text/vcard; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '.vcf"');
header('Content-Length: ' . strlen($vcfContent));
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

echo $vcfContent;
exit;

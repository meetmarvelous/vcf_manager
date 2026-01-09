<?php
/**
 * Files API Endpoint
 * 
 * Manage VCF source files.
 * GET: List files
 * PUT: Rename file
 * DELETE: Delete file
 */

declare(strict_types=1);

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../autoload.php';

$manager = new ContactManager();
$method = $_SERVER['REQUEST_METHOD'];

// GET - List files
if ($method === 'GET') {
    successResponse([
        'files' => $manager->getFiles(),
        'totalContacts' => $manager->getTotalContactCount(),
    ]);
}

// Validate CSRF for modifying requests
$csrfToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
if (!validateCSRFToken($csrfToken)) {
    errorResponse('Invalid security token. Please refresh the page.', 403);
}

// PUT - Rename file
if ($method === 'PUT') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $id = Security::sanitizeString($input['id'] ?? '');
    $name = Security::sanitizeString($input['name'] ?? '');

    if (empty($id) || empty($name)) {
        errorResponse('File ID and new name are required');
    }

    if (!$manager->renameFile($id, $name)) {
        errorResponse('File not found', 404);
    }

    successResponse(['files' => $manager->getFiles()]);
}

// DELETE - Delete file and its contacts
if ($method === 'DELETE') {
    $input = json_decode(file_get_contents('php://input'), true);
    $id = Security::sanitizeString($input['id'] ?? $_GET['id'] ?? '');

    if (empty($id)) {
        errorResponse('File ID is required');
    }

    if (!$manager->deleteFile($id)) {
        errorResponse('File not found', 404);
    }

    successResponse([
        'files' => $manager->getFiles(),
        'totalContacts' => $manager->getTotalContactCount(),
    ]);
}

// POST - Clear all data
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (isset($input['action']) && $input['action'] === 'clear_all') {
        $manager->clearAll();
        successResponse(['message' => 'All data cleared']);
    }
}

errorResponse('Method not allowed', 405);

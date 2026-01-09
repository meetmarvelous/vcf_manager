<?php
/**
 * Merge API Endpoint
 * 
 * Merge duplicate contacts.
 * POST: Execute merge operation
 */

declare(strict_types=1);

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../autoload.php';

$manager = new ContactManager();
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    errorResponse('Method not allowed', 405);
}

// CSRF validation
$csrfToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
if (!validateCSRFToken($csrfToken)) {
    errorResponse('Invalid security token. Please refresh the page.', 403);
}

// Rate limiting
if (!Security::checkRateLimit('merge', 50, 60)) {
    errorResponse('Too many merge requests. Please wait.', 429);
}

$input = json_decode(file_get_contents('php://input'), true);

if ($input === null) {
    errorResponse('Invalid JSON input');
}

$action = $input['action'] ?? 'merge';

// Single merge operation
if ($action === 'merge') {
    $ids = $input['ids'] ?? [];
    $preferredValues = $input['preferredValues'] ?? null;

    if (!is_array($ids) || count($ids) < 2) {
        errorResponse('At least 2 contact IDs required for merge');
    }

    $mergedId = $manager->mergeContacts($ids, $preferredValues);

    if ($mergedId === null) {
        errorResponse('Failed to merge contacts. Some contacts may not exist.');
    }

    $mergedContact = $manager->getContact($mergedId);

    successResponse([
        'mergedContact' => $mergedContact,
        'totalContacts' => $manager->getTotalContactCount(),
    ]);
}

// Auto-merge multiple groups
if ($action === 'auto_merge') {
    $groups = $input['groups'] ?? [];
    $results = [];

    foreach ($groups as $group) {
        $ids = array_column($group['contacts'] ?? [], 'id');
        if (count($ids) < 2) {
            continue;
        }

        $mergedId = $manager->mergeContacts($ids);
        if ($mergedId !== null) {
            $results[] = [
                'success' => true,
                'mergedId' => $mergedId,
                'originalCount' => count($ids),
            ];
        } else {
            $results[] = [
                'success' => false,
                'error' => 'Failed to merge group',
            ];
        }
    }

    successResponse([
        'results' => $results,
        'totalMerged' => count(array_filter($results, fn($r) => $r['success'])),
        'totalContacts' => $manager->getTotalContactCount(),
    ]);
}

errorResponse('Invalid action');

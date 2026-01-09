<?php
/**
 * Contacts API Endpoint
 * 
 * RESTful CRUD operations for contacts.
 * GET: List/retrieve contacts
 * POST: Create contact
 * PUT: Update contact
 * DELETE: Delete contact(s)
 */

declare(strict_types=1);

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../autoload.php';

$manager = new ContactManager();
$method = $_SERVER['REQUEST_METHOD'];

// GET - List or retrieve contacts
if ($method === 'GET') {
    $fileId = isset($_GET['file_id']) ? Security::sanitizeString($_GET['file_id']) : null;
    $search = isset($_GET['search']) ? Security::sanitizeString($_GET['search']) : null;
    $id = isset($_GET['id']) ? Security::sanitizeString($_GET['id']) : null;

    // Get single contact
    if ($id !== null) {
        $contact = $manager->getContact($id);
        if ($contact === null) {
            errorResponse('Contact not found', 404);
        }
        successResponse(['contact' => $contact]);
    }

    // Get all contacts with optional filters
    $contacts = $manager->getContacts($fileId, $search);
    
    successResponse([
        'contacts' => $contacts,
        'total' => count($contacts),
        'files' => $manager->getFiles(),
    ]);
}

// Validate CSRF for modifying requests
$csrfToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;
if (!validateCSRFToken($csrfToken)) {
    errorResponse('Invalid security token. Please refresh the page.', 403);
}

// Rate limiting for modifications
if (!Security::checkRateLimit('contacts_modify', 100, 60)) {
    errorResponse('Too many requests. Please wait.', 429);
}

// POST - Create new contact
if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if ($input === null) {
        errorResponse('Invalid JSON input');
    }

    $fileId = Security::sanitizeString($input['sourceFile'] ?? '');
    if (empty($fileId)) {
        errorResponse('Source file is required');
    }

    $contact = [
        'id' => Security::generateId(),
        'name' => Security::sanitizeString($input['name'] ?? ''),
        'firstName' => Security::sanitizeString($input['firstName'] ?? ''),
        'lastName' => Security::sanitizeString($input['lastName'] ?? ''),
        'phones' => $input['phones'] ?? [],
        'emails' => $input['emails'] ?? [],
        'organization' => Security::sanitizeString($input['organization'] ?? ''),
        'title' => Security::sanitizeString($input['title'] ?? ''),
        'notes' => Security::sanitizeString($input['notes'] ?? ''),
        'tags' => $input['tags'] ?? [],
        'sourceFile' => $fileId,
    ];

    // Validate required fields
    if (empty($contact['name']) && empty($contact['phones'])) {
        errorResponse('Contact must have a name or at least one phone number');
    }

    // Add directly to session
    $_SESSION['contacts'][$contact['id']] = $contact;

    successResponse(['contact' => $contact]);
}

// PUT - Update contact
if ($method === 'PUT') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if ($input === null) {
        errorResponse('Invalid JSON input');
    }

    $id = Security::sanitizeString($input['id'] ?? '');
    if (empty($id)) {
        errorResponse('Contact ID is required');
    }

    // Sanitize input fields
    $data = [];
    if (isset($input['name'])) $data['name'] = Security::sanitizeString($input['name']);
    if (isset($input['firstName'])) $data['firstName'] = Security::sanitizeString($input['firstName']);
    if (isset($input['lastName'])) $data['lastName'] = Security::sanitizeString($input['lastName']);
    if (isset($input['phones'])) $data['phones'] = $input['phones']; // Array validation needed
    if (isset($input['emails'])) $data['emails'] = $input['emails'];
    if (isset($input['organization'])) $data['organization'] = Security::sanitizeString($input['organization']);
    if (isset($input['title'])) $data['title'] = Security::sanitizeString($input['title']);
    if (isset($input['notes'])) $data['notes'] = Security::sanitizeString($input['notes']);
    if (isset($input['tags'])) $data['tags'] = array_map([Security::class, 'sanitizeString'], $input['tags']);

    if (!$manager->updateContact($id, $data)) {
        errorResponse('Contact not found', 404);
    }

    successResponse(['contact' => $manager->getContact($id)]);
}

// DELETE - Delete contact(s)
if ($method === 'DELETE') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $ids = $input['ids'] ?? [];
    if (!is_array($ids) || empty($ids)) {
        // Try single ID from query string
        $id = isset($_GET['id']) ? Security::sanitizeString($_GET['id']) : null;
        if ($id) {
            $ids = [$id];
        }
    }

    if (empty($ids)) {
        errorResponse('Contact ID(s) required');
    }

    $deleted = $manager->deleteContacts($ids);
    
    successResponse([
        'deleted' => $deleted,
        'total' => $manager->getTotalContactCount(),
    ]);
}

errorResponse('Method not allowed', 405);

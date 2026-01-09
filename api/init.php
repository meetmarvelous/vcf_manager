<?php
/**
 * Init API Endpoint
 * 
 * Initialize CSRF token and session.
 * GET: Get CSRF token and current state
 */

declare(strict_types=1);

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../autoload.php';

$manager = new ContactManager();

successResponse([
    'csrfToken' => generateCSRFToken(),
    'files' => $manager->getFiles(),
    'totalContacts' => $manager->getTotalContactCount(),
    'appName' => APP_NAME,
    'version' => APP_VERSION,
]);

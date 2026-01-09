<?php
/**
 * Analyze API Endpoint - Simplified for debugging
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
if (!Security::checkRateLimit('analyze', 10, 60)) {
    errorResponse('Too many analysis requests. Please wait.', 429);
}

try {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $threshold = isset($input['threshold']) ? (int) $input['threshold'] : 80;
    $threshold = max(50, min(100, $threshold));

    // Get all contacts
    $allContacts = $manager->getContacts();
    
    // Simple analysis - just count without complex processing
    $exactMatch = [];
    $sameNumber = [];
    $sameName = [];
    $similarPhone = [];
    $sameEmail = [];
    
    // Build basic phone and name indexes
    $phoneIndex = [];
    $nameIndex = [];
    $emailIndex = [];
    
    foreach ($allContacts as $c) {
        $contact = Contact::fromArray($c);
        $id = $c['id'];
        
        // Index phones
        $phones = $contact->getNormalizedPhones();
        foreach ($phones as $phone) {
            $phone = (string)$phone;
            if (!empty($phone)) {
                if (!isset($phoneIndex[$phone])) {
                    $phoneIndex[$phone] = [];
                }
                $phoneIndex[$phone][] = $id;
            }
        }
        
        // Index names
        $name = $contact->getNormalizedName();
        if (!empty($name)) {
            if (!isset($nameIndex[$name])) {
                $nameIndex[$name] = [];
            }
            $nameIndex[$name][] = $id;
        }
        
        // Index emails
        foreach ($contact->getEmails() as $email) {
            $normEmail = strtolower(trim($email['value'] ?? ''));
            if (!empty($normEmail)) {
                if (!isset($emailIndex[$normEmail])) {
                    $emailIndex[$normEmail] = [];
                }
                $emailIndex[$normEmail][] = $id;
            }
        }
    }
    
    $processedPairs = [];
    $contactsInGroups = [];
    
    // Find exact matches and same-number duplicates via phone index
    foreach ($phoneIndex as $phone => $ids) {
        if (count($ids) < 2) continue;
        $ids = array_unique($ids);
        if (count($ids) < 2) continue;
        
        // Get group contacts
        $groupContacts = [];
        foreach ($ids as $id) {
            foreach ($allContacts as $c) {
                if ($c['id'] === $id) {
                    $groupContacts[] = $c;
                    break;
                }
            }
        }
        
        if (count($groupContacts) < 2) continue;
        
        // Check if all have same name
        $names = [];
        foreach ($groupContacts as $gc) {
            $contact = Contact::fromArray($gc);
            $names[] = $contact->getNormalizedName();
        }
        $uniqueNames = array_unique($names);
        
        $groupKey = implode('-', array_map(fn($c) => $c['id'], $groupContacts));
        if (isset($processedPairs[$groupKey])) continue;
        $processedPairs[$groupKey] = true;
        
        $group = [
            'contacts' => $groupContacts,
            'matchType' => count($uniqueNames) === 1 ? 'exact' : 'samePhone',
            'matchedOn' => 'phone',
            'similarity' => 100
        ];
        
        if (count($uniqueNames) === 1) {
            $exactMatch[] = $group;
        } else {
            $group['conflictFields'] = ['name'];
            $sameNumber[] = $group;
        }
        
        foreach ($ids as $id) $contactsInGroups[$id] = true;
    }
    
    // Find same-name duplicates
    foreach ($nameIndex as $name => $ids) {
        if (count($ids) < 2) continue;
        $ids = array_unique($ids);
        $idsFiltered = array_filter($ids, fn($id) => !isset($contactsInGroups[$id]));
        if (count($idsFiltered) < 2) continue;
        
        $groupContacts = [];
        foreach ($idsFiltered as $id) {
            foreach ($allContacts as $c) {
                if ($c['id'] === $id) {
                    $groupContacts[] = $c;
                    break;
                }
            }
        }
        
        if (count($groupContacts) < 2) continue;
        
        $groupKey = implode('-', array_map(fn($c) => $c['id'], $groupContacts));
        if (isset($processedPairs[$groupKey])) continue;
        $processedPairs[$groupKey] = true;
        
        // Debug: Log the actual original names being grouped under the normalized name
        $originalNames = array_map(fn($c) => $c['name'] ?? 'NO_NAME', $groupContacts);
        error_log("SAME_NAME DEBUG - Normalized: '$name' | Original names: " . implode(' | ', $originalNames));
        
        $sameName[] = [
            'contacts' => $groupContacts,
            'matchType' => 'sameName',
            'matchedOn' => 'name',
            'similarity' => 90,
            'conflictFields' => ['phone'],
            'debug_normalizedKey' => $name // Temporary debug info
        ];
        
        foreach ($idsFiltered as $id) $contactsInGroups[$id] = true;
    }
    
    // Find same-email duplicates
    foreach ($emailIndex as $email => $ids) {
        if (count($ids) < 2) continue;
        $ids = array_unique($ids);
        
        $groupContacts = [];
        foreach ($ids as $id) {
            foreach ($allContacts as $c) {
                if ($c['id'] === $id) {
                    $groupContacts[] = $c;
                    break;
                }
            }
        }
        
        if (count($groupContacts) < 2) continue;
        
        $groupKey = implode('-', array_map(fn($c) => $c['id'], $groupContacts));
        if (isset($processedPairs[$groupKey])) continue;
        $processedPairs[$groupKey] = true;
        
        $sameEmail[] = [
            'contacts' => $groupContacts,
            'matchType' => 'sameEmail',
            'matchedOn' => 'email',
            'similarity' => 100
        ];
    }
    
    $totalDuplicateGroups = count($exactMatch) + count($sameNumber) + count($sameName) + count($similarPhone) + count($sameEmail);

    successResponse([
        'stats' => [
            'totalContacts' => count($allContacts),
            'exactMatches' => count($exactMatch),
            'sameNumber' => count($sameNumber),
            'sameName' => count($sameName),
            'similarPhone' => count($similarPhone),
            'sameEmail' => count($sameEmail)
        ],
        'totalDuplicateGroups' => $totalDuplicateGroups,
        'categories' => [
            'exactMatch' => $exactMatch,
            'sameNumber' => $sameNumber,
            'sameName' => $sameName,
            'similarPhone' => $similarPhone,
            'sameEmail' => $sameEmail
        ]
    ]);

} catch (Throwable $e) {
    errorResponse('Server Error: ' . $e->getMessage(), 500);
}

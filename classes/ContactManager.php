<?php
/**
 * Contact Manager Class
 * 
 * Manages contact collections, duplicate detection, and merging operations.
 * All data is stored in PHP sessions for privacy.
 */

declare(strict_types=1);

class ContactManager
{
    private const SESSION_FILES_KEY = 'vcf_files';
    private const SESSION_CONTACTS_KEY = 'contacts';
    private const SESSION_HISTORY_KEY = 'history';

    /**
     * Add a new VCF file with its contacts
     */
    public function addFile(string $filename, array $contacts): string
    {
        $fileId = Security::generateId();
        
        // Store file metadata
        $_SESSION[self::SESSION_FILES_KEY][$fileId] = [
            'id' => $fileId,
            'name' => Security::sanitizeString($filename),
            'contactCount' => count($contacts),
            'addedAt' => time(),
        ];

        // Store contacts with file reference
        foreach ($contacts as $contactData) {
            $contactData['sourceFile'] = $fileId;
            $contact = Contact::fromArray($contactData);
            $_SESSION[self::SESSION_CONTACTS_KEY][$contact->id] = $contact->toArray();
        }

        $this->saveHistory('add_file', ['fileId' => $fileId, 'filename' => $filename, 'count' => count($contacts)]);

        return $fileId;
    }

    /**
     * Get all files
     */
    public function getFiles(): array
    {
        $files = $_SESSION[self::SESSION_FILES_KEY] ?? [];
        
        // Update contact counts
        foreach ($files as $fileId => &$file) {
            $file['contactCount'] = $this->getContactCountByFile($fileId);
        }
        
        return array_values($files);
    }

    /**
     * Get single file by ID
     */
    public function getFile(string $fileId): ?array
    {
        return $_SESSION[self::SESSION_FILES_KEY][$fileId] ?? null;
    }

    /**
     * Rename a file
     */
    public function renameFile(string $fileId, string $newName): bool
    {
        if (!isset($_SESSION[self::SESSION_FILES_KEY][$fileId])) {
            return false;
        }
        
        $_SESSION[self::SESSION_FILES_KEY][$fileId]['name'] = Security::sanitizeString($newName);
        return true;
    }

    /**
     * Delete a file and its contacts
     */
    public function deleteFile(string $fileId): bool
    {
        if (!isset($_SESSION[self::SESSION_FILES_KEY][$fileId])) {
            return false;
        }

        // Delete all contacts from this file
        $contacts = $_SESSION[self::SESSION_CONTACTS_KEY] ?? [];
        foreach ($contacts as $id => $contact) {
            if ($contact['sourceFile'] === $fileId) {
                unset($_SESSION[self::SESSION_CONTACTS_KEY][$id]);
            }
        }

        unset($_SESSION[self::SESSION_FILES_KEY][$fileId]);
        return true;
    }

    /**
     * Get contact count for a specific file
     */
    public function getContactCountByFile(string $fileId): int
    {
        $count = 0;
        $contacts = $_SESSION[self::SESSION_CONTACTS_KEY] ?? [];
        foreach ($contacts as $contact) {
            if ($contact['sourceFile'] === $fileId) {
                $count++;
            }
        }
        return $count;
    }

    /**
     * Get all contacts with optional filtering
     */
    public function getContacts(?string $fileId = null, ?string $search = null): array
    {
        $contacts = $_SESSION[self::SESSION_CONTACTS_KEY] ?? [];
        $result = [];

        foreach ($contacts as $contact) {
            // Filter by file
            if ($fileId !== null && $contact['sourceFile'] !== $fileId) {
                continue;
            }

            // Search filter
            if ($search !== null && $search !== '') {
                $searchLower = strtolower($search);
                $match = false;

                if (stripos($contact['name'], $search) !== false) {
                    $match = true;
                }
                
                foreach ($contact['phones'] as $phone) {
                    if (stripos($phone['value'], $search) !== false) {
                        $match = true;
                        break;
                    }
                }
                
                foreach ($contact['emails'] as $email) {
                    if (stripos($email['value'], $search) !== false) {
                        $match = true;
                        break;
                    }
                }

                if (!$match) {
                    continue;
                }
            }

            // Add file name for display
            $fileData = $_SESSION[self::SESSION_FILES_KEY][$contact['sourceFile']] ?? null;
            $contact['sourceFileName'] = $fileData ? $fileData['name'] : 'Unknown';

            $result[] = $contact;
        }

        return $result;
    }

    /**
     * Get single contact by ID
     */
    public function getContact(string $id): ?array
    {
        return $_SESSION[self::SESSION_CONTACTS_KEY][$id] ?? null;
    }

    /**
     * Update a contact
     */
    public function updateContact(string $id, array $data): bool
    {
        if (!isset($_SESSION[self::SESSION_CONTACTS_KEY][$id])) {
            return false;
        }

        $existing = $_SESSION[self::SESSION_CONTACTS_KEY][$id];
        
        // Only allow updating certain fields
        $allowedFields = ['name', 'firstName', 'lastName', 'phones', 'emails', 
                         'organization', 'title', 'notes', 'tags'];

        foreach ($allowedFields as $field) {
            if (isset($data[$field])) {
                $existing[$field] = $data[$field];
            }
        }

        $_SESSION[self::SESSION_CONTACTS_KEY][$id] = $existing;
        $this->saveHistory('update', ['contactId' => $id]);

        return true;
    }

    /**
     * Delete contacts
     */
    public function deleteContacts(array $ids): int
    {
        $deleted = 0;
        foreach ($ids as $id) {
            if (isset($_SESSION[self::SESSION_CONTACTS_KEY][$id])) {
                unset($_SESSION[self::SESSION_CONTACTS_KEY][$id]);
                $deleted++;
            }
        }
        
        $this->saveHistory('delete', ['count' => $deleted]);
        return $deleted;
    }

    /**
     * Move contacts to a different file
     */
    public function moveContacts(array $ids, string $targetFileId): int
    {
        if (!isset($_SESSION[self::SESSION_FILES_KEY][$targetFileId])) {
            return 0;
        }

        $moved = 0;
        foreach ($ids as $id) {
            if (isset($_SESSION[self::SESSION_CONTACTS_KEY][$id])) {
                $_SESSION[self::SESSION_CONTACTS_KEY][$id]['sourceFile'] = $targetFileId;
                $moved++;
            }
        }

        return $moved;
    }

    /**
     * Find duplicate contacts
     */
    public function findDuplicates(int $threshold = 80): array
    {
        $contacts = $_SESSION[self::SESSION_CONTACTS_KEY] ?? [];
        $contactObjects = [];
        
        foreach ($contacts as $data) {
            $contactObjects[$data['id']] = Contact::fromArray($data);
        }

        $groups = [];
        $processed = [];

        foreach ($contactObjects as $id1 => $contact1) {
            if (in_array($id1, $processed, true)) {
                continue;
            }

            $group = ['contacts' => [$contact1->toArray()], 'matchType' => 'none'];
            
            foreach ($contactObjects as $id2 => $contact2) {
                if ($id1 === $id2 || in_array($id2, $processed, true)) {
                    continue;
                }

                $similarity = $contact1->calculateSimilarity($contact2);
                
                if ($similarity['phone'] === 100) {
                    $group['contacts'][] = $contact2->toArray();
                    $group['matchType'] = 'phone';
                    $processed[] = $id2;
                } elseif ($similarity['email'] === 100) {
                    $group['contacts'][] = $contact2->toArray();
                    $group['matchType'] = $group['matchType'] === 'none' ? 'email' : $group['matchType'];
                    $processed[] = $id2;
                } elseif ($similarity['overall'] >= $threshold) {
                    $group['contacts'][] = $contact2->toArray();
                    $group['matchType'] = $group['matchType'] === 'none' ? 'fuzzy' : $group['matchType'];
                    $processed[] = $id2;
                }
            }

            if (count($group['contacts']) > 1) {
                $group['id'] = Security::generateId();
                $groups[] = $group;
            }

            $processed[] = $id1;
        }

        return $groups;
    }

    /**
     * Merge contacts
     */
    public function mergeContacts(array $ids, ?array $preferredValues = null): ?string
    {
        if (count($ids) < 2) {
            return null;
        }

        $contacts = [];
        foreach ($ids as $id) {
            if (isset($_SESSION[self::SESSION_CONTACTS_KEY][$id])) {
                $contacts[] = Contact::fromArray($_SESSION[self::SESSION_CONTACTS_KEY][$id]);
            }
        }

        if (count($contacts) < 2) {
            return null;
        }

        // Use first contact as base
        $merged = $contacts[0];

        // Apply preferred values if provided
        if ($preferredValues !== null) {
            foreach ($preferredValues as $field => $value) {
                if (property_exists($merged, $field)) {
                    $merged->$field = $value;
                }
            }
        }

        // Merge all other contacts into the base
        for ($i = 1; $i < count($contacts); $i++) {
            $merged->merge($contacts[$i]);
        }

        // Generate new ID for merged contact
        $merged->id = Security::generateId();

        // Delete original contacts
        foreach ($ids as $id) {
            unset($_SESSION[self::SESSION_CONTACTS_KEY][$id]);
        }

        // Store merged contact
        $_SESSION[self::SESSION_CONTACTS_KEY][$merged->id] = $merged->toArray();

        $this->saveHistory('merge', ['ids' => $ids, 'resultId' => $merged->id]);

        return $merged->id;
    }

    /**
     * Export contacts to VCF format
     */
    public function exportToVCF(?array $ids = null, ?string $fileId = null): string
    {
        $contacts = [];
        $allContacts = $_SESSION[self::SESSION_CONTACTS_KEY] ?? [];

        foreach ($allContacts as $contact) {
            // Filter by IDs if specified
            if ($ids !== null && !in_array($contact['id'], $ids, true)) {
                continue;
            }
            
            // Filter by file if specified
            if ($fileId !== null && $contact['sourceFile'] !== $fileId) {
                continue;
            }

            $contacts[] = Contact::fromArray($contact);
        }

        $vcfContent = [];
        foreach ($contacts as $contact) {
            $vcfContent[] = $contact->toVCF();
        }

        return implode("\r\n", $vcfContent);
    }

    /**
     * Get total contact count
     */
    public function getTotalContactCount(): int
    {
        return count($_SESSION[self::SESSION_CONTACTS_KEY] ?? []);
    }

    /**
     * Clear all data
     */
    public function clearAll(): void
    {
        $_SESSION[self::SESSION_FILES_KEY] = [];
        $_SESSION[self::SESSION_CONTACTS_KEY] = [];
        $_SESSION[self::SESSION_HISTORY_KEY] = [];
    }

    /**
     * Save action to history for undo/redo
     */
    private function saveHistory(string $action, array $data): void
    {
        if (!isset($_SESSION[self::SESSION_HISTORY_KEY])) {
            $_SESSION[self::SESSION_HISTORY_KEY] = [];
        }

        $_SESSION[self::SESSION_HISTORY_KEY][] = [
            'action' => $action,
            'data' => $data,
            'timestamp' => time(),
        ];

        // Keep only last 100 actions
        if (count($_SESSION[self::SESSION_HISTORY_KEY]) > 100) {
            array_shift($_SESSION[self::SESSION_HISTORY_KEY]);
        }
    }

    /**
     * Get history
     */
    public function getHistory(): array
    {
        return $_SESSION[self::SESSION_HISTORY_KEY] ?? [];
    }
}

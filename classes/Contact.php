<?php
/**
 * Contact Model Class
 * 
 * Represents a single contact with normalization and comparison methods.
 */

declare(strict_types=1);

class Contact
{
    public string $id;
    public string $name;
    public string $firstName;
    public string $lastName;
    public string $middleName;
    public string $prefix;
    public string $suffix;
    public string $nickname;
    public array $phones;
    public array $emails;
    public array $addresses;
    public string $organization;
    public string $department;
    public string $title;
    public string $notes;
    public array $tags;
    public array $urls;
    public string $birthday;
    public string $anniversary;
    public string $photo;
    public string $photoType;
    public array $socialProfiles;
    public array $imHandles;
    public string $geo;
    public string $timezone;
    public string $gender;
    public array $related;
    public string $sourceFile;
    public string $raw;

    /**
     * Create Contact from array data
     */
    public static function fromArray(array $data): self
    {
        $contact = new self();
        $contact->id = $data['id'] ?? Security::generateId();
        $contact->name = $data['name'] ?? '';
        $contact->firstName = $data['firstName'] ?? '';
        $contact->lastName = $data['lastName'] ?? '';
        $contact->middleName = $data['middleName'] ?? '';
        $contact->prefix = $data['prefix'] ?? '';
        $contact->suffix = $data['suffix'] ?? '';
        $contact->nickname = $data['nickname'] ?? '';
        $contact->phones = $data['phones'] ?? [];
        $contact->emails = $data['emails'] ?? [];
        $contact->addresses = $data['addresses'] ?? [];
        $contact->organization = $data['organization'] ?? '';
        $contact->department = $data['department'] ?? '';
        $contact->title = $data['title'] ?? '';
        $contact->notes = $data['notes'] ?? '';
        $contact->tags = $data['tags'] ?? [];
        $contact->urls = $data['urls'] ?? [];
        $contact->birthday = $data['birthday'] ?? '';
        $contact->anniversary = $data['anniversary'] ?? '';
        $contact->photo = $data['photo'] ?? '';
        $contact->photoType = $data['photoType'] ?? '';
        $contact->socialProfiles = $data['socialProfiles'] ?? [];
        $contact->imHandles = $data['imHandles'] ?? [];
        $contact->geo = $data['geo'] ?? '';
        $contact->timezone = $data['timezone'] ?? '';
        $contact->gender = $data['gender'] ?? '';
        $contact->related = $data['related'] ?? [];
        $contact->sourceFile = $data['sourceFile'] ?? '';
        $contact->raw = $data['raw'] ?? '';
        
        return $contact;
    }

    /**
     * Convert to array for JSON serialization
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'firstName' => $this->firstName,
            'lastName' => $this->lastName,
            'middleName' => $this->middleName,
            'prefix' => $this->prefix,
            'suffix' => $this->suffix,
            'nickname' => $this->nickname,
            'phones' => $this->phones,
            'emails' => $this->emails,
            'addresses' => $this->addresses,
            'organization' => $this->organization,
            'department' => $this->department,
            'title' => $this->title,
            'notes' => $this->notes,
            'tags' => $this->tags,
            'urls' => $this->urls,
            'birthday' => $this->birthday,
            'anniversary' => $this->anniversary,
            'photo' => $this->photo,
            'photoType' => $this->photoType,
            'socialProfiles' => $this->socialProfiles,
            'imHandles' => $this->imHandles,
            'geo' => $this->geo,
            'timezone' => $this->timezone,
            'gender' => $this->gender,
            'related' => $this->related,
            'sourceFile' => $this->sourceFile,
        ];
    }

    /**
     * Get all phones
     */
    public function getPhones(): array
    {
        return $this->phones;
    }

    /**
     * Get all emails
     */
    public function getEmails(): array
    {
        return $this->emails;
    }

    /**
     * Get all normalized phone numbers
     */
    public function getNormalizedPhones(): array
    {
        return array_map(fn($p) => $p['normalized'] ?? Security::normalizePhone($p['value']), $this->phones);
    }

    /**
     * Get all lowercase emails
     */
    public function getNormalizedEmails(): array
    {
        return array_map(fn($e) => strtolower($e['value']), $this->emails);
    }

    /**
     * Normalize name for comparison - case-insensitive, whitespace normalized
     * Names must match exactly (e.g., "Mrs Adegboyega" != "Mr Adegboyega")
     */
    public function getNormalizedName(): string
    {
        $name = strtolower(trim($this->name));
        // Only normalize whitespace, do NOT remove prefixes like Mr/Mrs
        // This ensures exact matching: "Mrs Adegboyega" != "Mr Adegboyega"
        return preg_replace('/\s+/', ' ', $name);
    }

    /**
     * Calculate similarity score with another contact (0-100)
     */
    public function calculateSimilarity(Contact $other): array
    {
        $scores = [
            'phone' => $this->calculatePhoneSimilarity($other),
            'email' => $this->calculateEmailSimilarity($other),
            'name' => $this->calculateNameSimilarity($other),
        ];

        // Overall score: weighted average
        $weights = ['phone' => 50, 'email' => 30, 'name' => 20];
        $totalWeight = 0;
        $weightedSum = 0;

        foreach ($scores as $key => $score) {
            if ($score > 0) {
                $weightedSum += $score * $weights[$key];
                $totalWeight += $weights[$key];
            }
        }

        $scores['overall'] = $totalWeight > 0 ? round($weightedSum / $totalWeight) : 0;
        
        return $scores;
    }

    /**
     * Check if phone numbers match
     */
    private function calculatePhoneSimilarity(Contact $other): int
    {
        $myPhones = $this->getNormalizedPhones();
        $otherPhones = $other->getNormalizedPhones();

        foreach ($myPhones as $phone) {
            if (in_array($phone, $otherPhones, true)) {
                return 100; // Exact match
            }
        }

        return 0;
    }

    /**
     * Check if emails match
     */
    private function calculateEmailSimilarity(Contact $other): int
    {
        $myEmails = $this->getNormalizedEmails();
        $otherEmails = $other->getNormalizedEmails();

        foreach ($myEmails as $email) {
            if (in_array($email, $otherEmails, true)) {
                return 100; // Exact match
            }
        }

        return 0;
    }

    /**
     * Calculate name similarity using Levenshtein distance
     */
    private function calculateNameSimilarity(Contact $other): int
    {
        $name1 = $this->getNormalizedName();
        $name2 = $other->getNormalizedName();

        if ($name1 === $name2) {
            return 100;
        }

        if (empty($name1) || empty($name2)) {
            return 0;
        }

        // Use similar_text for percentage-based comparison
        similar_text($name1, $name2, $percent);
        return (int) round($percent);
    }

    /**
     * Merge another contact into this one
     */
    public function merge(Contact $other): void
    {
        // Prefer non-empty values
        if (empty($this->name) && !empty($other->name)) {
            $this->name = $other->name;
        }
        if (empty($this->firstName) && !empty($other->firstName)) {
            $this->firstName = $other->firstName;
        }
        if (empty($this->lastName) && !empty($other->lastName)) {
            $this->lastName = $other->lastName;
        }
        if (empty($this->organization) && !empty($other->organization)) {
            $this->organization = $other->organization;
        }
        if (empty($this->title) && !empty($other->title)) {
            $this->title = $other->title;
        }
        if (empty($this->notes)) {
            $this->notes = $other->notes;
        } elseif (!empty($other->notes) && $this->notes !== $other->notes) {
            $this->notes .= "\n" . $other->notes;
        }

        // Merge arrays (deduplicate)
        $this->mergePhones($other->phones);
        $this->mergeEmails($other->emails);
        $this->tags = array_unique(array_merge($this->tags, $other->tags));
    }

    /**
     * Merge phones avoiding duplicates
     */
    private function mergePhones(array $otherPhones): void
    {
        $existingNormalized = $this->getNormalizedPhones();
        
        foreach ($otherPhones as $phone) {
            $normalized = $phone['normalized'] ?? Security::normalizePhone($phone['value']);
            if (!in_array($normalized, $existingNormalized, true)) {
                $this->phones[] = $phone;
                $existingNormalized[] = $normalized;
            }
        }
    }

    /**
     * Merge emails avoiding duplicates
     */
    private function mergeEmails(array $otherEmails): void
    {
        $existingEmails = $this->getNormalizedEmails();
        
        foreach ($otherEmails as $email) {
            $normalized = strtolower($email['value']);
            if (!in_array($normalized, $existingEmails, true)) {
                $this->emails[] = $email;
                $existingEmails[] = $normalized;
            }
        }
    }

    /**
     * Generate VCF (vCard 3.0) string for this contact
     */
    public function toVCF(): string
    {
        $lines = ['BEGIN:VCARD', 'VERSION:3.0'];

        // Full name
        $lines[] = 'FN:' . $this->escapeVCF($this->name);

        // Structured name: Last;First;Middle;Prefix;Suffix
        $lines[] = 'N:' . $this->escapeVCF($this->lastName) . ';' . 
                   $this->escapeVCF($this->firstName) . ';' .
                   $this->escapeVCF($this->middleName) . ';' .
                   $this->escapeVCF($this->prefix) . ';' .
                   $this->escapeVCF($this->suffix);

        // Nickname
        if (!empty($this->nickname)) {
            $lines[] = 'NICKNAME:' . $this->escapeVCF($this->nickname);
        }

        // Phone numbers
        foreach ($this->phones as $phone) {
            $type = strtoupper($phone['type'] ?? 'CELL');
            $lines[] = "TEL;TYPE={$type}:" . $phone['value'];
        }

        // Emails
        foreach ($this->emails as $email) {
            $type = strtoupper($email['type'] ?? 'HOME');
            $lines[] = "EMAIL;TYPE={$type}:" . $email['value'];
        }

        // Addresses
        foreach ($this->addresses as $addr) {
            $type = strtoupper($addr['type'] ?? 'HOME');
            $adrValue = implode(';', [
                $addr['poBox'] ?? '',
                $addr['extended'] ?? '',
                $addr['street'] ?? '',
                $addr['city'] ?? '',
                $addr['region'] ?? '',
                $addr['postalCode'] ?? '',
                $addr['country'] ?? ''
            ]);
            $lines[] = "ADR;TYPE={$type}:" . $adrValue;
        }

        // Organization (with optional department)
        if (!empty($this->organization)) {
            $org = $this->escapeVCF($this->organization);
            if (!empty($this->department)) {
                $org .= ';' . $this->escapeVCF($this->department);
            }
            $lines[] = 'ORG:' . $org;
        }

        // Title
        if (!empty($this->title)) {
            $lines[] = 'TITLE:' . $this->escapeVCF($this->title);
        }

        // URLs
        foreach ($this->urls as $url) {
            $type = strtoupper($url['type'] ?? 'WORK');
            $lines[] = "URL;TYPE={$type}:" . $url['value'];
        }

        // Birthday
        if (!empty($this->birthday)) {
            $lines[] = 'BDAY:' . $this->birthday;
        }

        // Anniversary
        if (!empty($this->anniversary)) {
            $lines[] = 'ANNIVERSARY:' . $this->anniversary;
        }

        // Photo (if present and is base64)
        if (!empty($this->photo) && strlen($this->photo) < 100000) {
            $photoType = strtoupper($this->photoType ?: 'JPEG');
            $lines[] = "PHOTO;ENCODING=b;TYPE={$photoType}:" . $this->photo;
        }

        // Gender
        if (!empty($this->gender)) {
            $lines[] = 'GENDER:' . $this->gender;
        }

        // Geo coordinates
        if (!empty($this->geo)) {
            $lines[] = 'GEO:' . $this->geo;
        }

        // Timezone
        if (!empty($this->timezone)) {
            $lines[] = 'TZ:' . $this->timezone;
        }

        // Social Profiles
        foreach ($this->socialProfiles as $social) {
            $type = strtoupper($social['type'] ?? 'OTHER');
            $lines[] = "X-SOCIALPROFILE;TYPE={$type}:" . $social['value'];
        }

        // IM Handles
        foreach ($this->imHandles as $im) {
            $type = strtoupper($im['type'] ?? 'OTHER');
            $lines[] = "IMPP;TYPE={$type}:" . $im['value'];
        }

        // Related contacts
        foreach ($this->related as $rel) {
            $type = strtoupper($rel['type'] ?? 'CONTACT');
            $lines[] = "RELATED;TYPE={$type}:" . $this->escapeVCF($rel['value']);
        }

        // Notes
        if (!empty($this->notes)) {
            $lines[] = 'NOTE:' . $this->escapeVCF($this->notes);
        }

        // Tags/Categories
        if (!empty($this->tags)) {
            $lines[] = 'CATEGORIES:' . implode(',', array_map([$this, 'escapeVCF'], $this->tags));
        }

        $lines[] = 'END:VCARD';

        return implode("\r\n", $lines);
    }

    /**
     * Escape value for VCF format
     */
    private function escapeVCF(string $value): string
    {
        return str_replace([',', ';', '\\', "\n"], ['\\,', '\\;', '\\\\', '\\n'], $value);
    }
}

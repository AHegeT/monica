<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContactPersonalityProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'contact_id',
        'myers_briggs_type',
        'enneagram_type',
        'working_genius_strengths',
        'working_genius_weaknesses',
    ];

    protected $casts = [
        'enneagram_type' => 'integer',
        'working_genius_strengths' => 'array',
        'working_genius_weaknesses' => 'array',
    ];

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }
}

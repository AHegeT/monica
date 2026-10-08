<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContactEmployment extends Model
{
    use HasFactory;

    protected $fillable = ['contact_id', 'employer', 'normalized_employer', 'position', 'started_on', 'ended_on', 'is_current'];

    protected $casts = ['started_on' => 'date', 'ended_on' => 'date', 'is_current' => 'boolean'];

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }
}

<?php

namespace App\Domains\Contact\ManageNotes\Web\ViewHelpers;

use Illuminate\Support\Str;

class NoteBodyViewHelper
{
    public static function html(string $body): string
    {
        return (string) Str::of($body)->markdown([
            'html_input' => 'strip',
            'allow_unsafe_links' => false,
            'renderer' => [
                'soft_break' => "<br>\n",
            ],
        ]);
    }
}

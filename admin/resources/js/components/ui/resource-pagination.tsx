import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';

export function ResourcePagination({ current_page, last_page, total, prev_page_url, next_page_url }: {
    current_page: number; last_page: number; total: number;
    prev_page_url: string | null; next_page_url: string | null;
}) {
    return <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">{total.toLocaleString()} products · Page {current_page} of {last_page}</p>
        <div className="flex gap-2">
            {prev_page_url ? <Button variant="outline" asChild><Link href={prev_page_url}>Previous</Link></Button> : <Button variant="outline" disabled>Previous</Button>}
            {next_page_url ? <Button variant="outline" asChild><Link href={next_page_url}>Next</Link></Button> : <Button variant="outline" disabled>Next</Button>}
        </div>
    </nav>;
}

import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';

export function FolderFilters({ folders, selected, total, href }: {
    folders: { path: string; label: string; count: number }[];
    selected: string;
    total: number;
    href: (path: string) => string;
}) {
    return <nav aria-label="Filter products by image folder" className="flex flex-wrap gap-3">
        {[{ path: '', label: 'All folders', count: total }, ...folders].map((folder) => (
            <Button key={folder.path} asChild variant={selected === folder.path ? 'default' : 'outline'} className="h-auto max-w-full justify-start px-4 py-3 text-left">
                <Link href={href(folder.path)} aria-current={selected === folder.path ? 'page' : undefined}>
                    <span className="min-w-0">
                        <span className="block">{folder.label} ({folder.count.toLocaleString()})</span>
                        {folder.path && <span className="block truncate text-xs font-normal">{folder.path}</span>}
                    </span>
                </Link>
            </Button>
        ))}
    </nav>;
}

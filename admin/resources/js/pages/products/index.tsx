import { Head, Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FolderFilters } from '@/components/ui/folder-filters';
import { ResourcePagination } from '@/components/ui/resource-pagination';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';

type ImportFolder = {
    path: string;
    label: string;
    count: number;
};

type ProductRow = {
    id: number;
    title: string;
    slug: string;
    design_name: string;
    source_path: string;
    status: string;
    updated_at: string;
    design_image_url: string;
    available_catalogs: CatalogOption[];
};

type CatalogOption = { slug: string; name: string };

type ProductPaginator = {
    data: ProductRow[];
    current_page: number;
    last_page: number;
    total: number;
    prev_page_url: string | null;
    next_page_url: string | null;
};

export default function Products({
    products,
    filters,
    importFolders,
    productFolders,
    productTotal,
    externalImportRoot,
    storefrontUrl,
}: {
    products: ProductPaginator;
    filters: { q: string; status: string; folder: string };
    productFolders: ImportFolder[];
    productTotal: number;
    externalImportRoot: string;
    storefrontUrl: string;
    importFolders: ImportFolder[];
}) {
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [folder, setFolder] = useState(externalImportRoot || '');
    const [isImporting, setIsImporting] = useState(false);
    const [importError, setImportError] = useState('');
    const [importMode, setImportMode] = useState('trial');
    const [importProgress, setImportProgress] = useState('');
    const [importResults, setImportResults] = useState<
        {
            slug?: string;
            title?: string;
            source_path: string;
            status: string;
            error?: string;
        }[]
    >([]);

    const importFolder = async () => {
        if (folder.trim() === '' || isImporting) return;

        setIsImporting(true);
        setImportError('');
        setImportResults([]);
        setImportProgress('Reading image folder...');
        let offset = 0;
        let failed = 0;
        let created = 0;
        let existing = 0;
        let importedFolder = '';
        try {
            const csrfCookie = document.cookie
                .split('; ')
                .find((cookie) => cookie.startsWith('XSRF-TOKEN='));
            if (!csrfCookie)
                throw new Error(
                    'Session expired. Reload this page and try again.',
                );
            let done = false;
            while (!done) {
                const response = await fetch('/products/import', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-XSRF-TOKEN': decodeURIComponent(
                            csrfCookie.substring('XSRF-TOKEN='.length),
                        ),
                    },
                    body: JSON.stringify({
                        folder: folder.trim(),
                        offset,
                        trial: importMode === 'trial',
                    }),
                });
                if (
                    !response.headers
                        .get('content-type')
                        ?.includes('application/json')
                ) {
                    throw new Error(
                        'Import interrupted. Reload the page to check your session. Completed batches are saved.',
                    );
                }
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(
                        data.errors?.folder?.[0] ??
                            data.errors?.import?.[0] ??
                            data.message ??
                            'Import failed.',
                    );
                }
                const results = data.results as typeof importResults;
                failed += results.filter(
                    (result) => result.status === 'error',
                ).length;
                if (data.next_offset <= offset)
                    throw new Error(
                        'Import did not advance. Completed batches are saved.',
                    );
                created += results.filter(
                    (result) => result.status === 'created',
                ).length;
                existing += results.filter((result) =>
                    ['updated', 'unchanged'].includes(result.status),
                ).length;
                importedFolder = data.folder;
                offset = data.next_offset;
                done = data.done || importMode === 'trial';
                setImportResults(results);
                setImportProgress(
                    `${offset} / ${importMode === 'trial' ? Math.min(data.total, 100) : data.total} images processed. ${created} new, ${existing} existing, ${failed} failed.${done ? ' Finished.' : ''}`,
                );
            }
            router.get(
                '/products',
                { folder: importedFolder },
                { preserveState: true, preserveScroll: true },
            );
        } catch (error) {
            setImportError(
                error instanceof Error
                    ? error.message
                    : 'Unable to import this folder.',
            );
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <>
            <Head title="Products" />
            <div className="space-y-6 p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Products</h1>
                        <p className="text-muted-foreground">
                            Manage products published on TeeBravo.
                        </p>
                    </div>
                    <Button asChild>
                        <Link href="/products/create">New product</Link>
                    </Button>
                    <Dialog
                        open={isImportOpen}
                        onOpenChange={(open) => {
                            if (isImporting) return;
                            setIsImportOpen(open);
                            if (!open) setImportError('');
                        }}
                    >
                        <DialogTrigger asChild>
                            <Button type="button" variant="outline">
                                Import images
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[90dvh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Import product images</DialogTitle>
                                <DialogDescription>
                                    Enter a server folder or choose an existing
                                    folder. Subfolders are included. Images stay
                                    in their original storage; names and slugs
                                    come from filenames or JSON metadata.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-5">
                                <div className="grid gap-2">
                                    <Label htmlFor="import-path">
                                        Server image folder
                                    </Label>
                                    <Input
                                        id="import-path"
                                        value={folder}
                                        onChange={(event) =>
                                            setFolder(event.target.value)
                                        }
                                        placeholder={
                                            externalImportRoot
                                                ? `${externalImportRoot}/ids/gmc`
                                                : '/home/images_ids/images/ids/gmc'
                                        }
                                        disabled={isImporting}
                                        aria-describedby="import-path-help"
                                    />
                                    <p
                                        id="import-path-help"
                                        className="text-muted-foreground text-sm"
                                    >
                                        External storage must be mounted for
                                        Admin and API. PNG, JPG, JPEG and WebP
                                        are supported. No image files are
                                        copied.
                                    </p>
                                    <Label htmlFor="import-folder">
                                        Image source
                                    </Label>
                                    <Select
                                        disabled={
                                            isImporting ||
                                            (importFolders.length === 0 &&
                                                !externalImportRoot)
                                        }
                                        value={folder}
                                        onValueChange={setFolder}
                                    >
                                        <SelectTrigger
                                            id="import-folder"
                                            className="w-full"
                                        >
                                            <SelectValue placeholder="Select image folder" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {externalImportRoot && (
                                                <SelectItem
                                                    value={externalImportRoot}
                                                >
                                                    External storage:{' '}
                                                    {externalImportRoot}{' '}
                                                    (includes subfolders)
                                                </SelectItem>
                                            )}
                                            {importFolders.map(
                                                (importFolder) => (
                                                    <SelectItem
                                                        key={importFolder.path}
                                                        value={
                                                            importFolder.path
                                                        }
                                                    >
                                                        {importFolder.label} (
                                                        {importFolder.count}{' '}
                                                        images)
                                                    </SelectItem>
                                                ),
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="import-mode">
                                        Import mode
                                    </Label>
                                    <Select
                                        value={importMode}
                                        onValueChange={setImportMode}
                                        disabled={isImporting}
                                    >
                                        <SelectTrigger
                                            id="import-mode"
                                            className="w-full"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="trial">
                                                Try first 100 products (draft)
                                            </SelectItem>
                                            <SelectItem value="all">
                                                Import and publish all products
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-muted-foreground text-sm">
                                        {importMode === 'trial'
                                            ? 'Creates up to 100 drafts for review. Existing published products stay published.'
                                            : 'Imports in batches of 100. Keep this dialog open until finished.'}
                                    </p>
                                </div>
                                {importProgress && (
                                    <p role="status" className="text-sm">
                                        {importProgress}
                                    </p>
                                )}
                                {importResults.length > 0 && (
                                    <div className="max-h-56 overflow-auto rounded-md border p-3 text-sm">
                                        {importResults.map((result) => (
                                            <div
                                                key={result.source_path}
                                                className="mb-3 break-all last:mb-0"
                                            >
                                                <p className="font-medium">
                                                    {result.title ??
                                                        result.source_path}
                                                </p>
                                                <p className="text-muted-foreground">
                                                    {result.slug} ·{' '}
                                                    {result.status}
                                                </p>
                                                <p className="text-muted-foreground">
                                                    {result.source_path}
                                                </p>
                                                {result.error && (
                                                    <p className="text-destructive">
                                                        {result.error}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {importError && (
                                    <p
                                        role="alert"
                                        className="text-destructive text-sm"
                                    >
                                        {importError}
                                    </p>
                                )}
                                <DialogFooter>
                                    <Button
                                        type="button"
                                        onClick={importFolder}
                                        disabled={
                                            folder.trim() === '' || isImporting
                                        }
                                    >
                                        {isImporting && <Spinner />}
                                        {isImporting
                                            ? 'Importing images...'
                                            : importMode === 'trial'
                                              ? 'Import first 100 drafts'
                                              : 'Import all products'}
                                    </Button>
                                </DialogFooter>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
                <FolderFilters
                    folders={productFolders}
                    selected={filters.folder}
                    total={productTotal}
                    href={(path) =>
                        `/products?${new URLSearchParams({ q: filters.q, status: filters.status, folder: path })}`
                    }
                />
                <form
                    key={`${filters.folder}:${filters.q}:${filters.status}`}
                    className="flex flex-wrap gap-2"
                >
                    <Input type="hidden" name="folder" value={filters.folder} />
                    <Input
                        name="q"
                        defaultValue={filters.q}
                        placeholder="Search title or slug"
                    />
                    <Select
                        name="status"
                        defaultValue={filters.status || 'all'}
                    >
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All statuses</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline">Filter</Button>
                </form>
                <div className="overflow-hidden rounded-xl border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="p-3 text-left">Product</th>
                                <th className="p-3 text-left">Design</th>
                                <th className="p-3 text-left">Status</th>
                                <th className="p-3 text-left">Preview</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {products.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="text-muted-foreground p-6 text-center"
                                    >
                                        No products match these filters.{' '}
                                        <Link
                                            href="/products"
                                            className="underline"
                                        >
                                            Clear filters
                                        </Link>
                                    </td>
                                </tr>
                            )}
                            {products.data.map((p) => (
                                <tr className="border-t" key={p.id}>
                                    <td className="p-3">
                                        <div className="font-medium">
                                            {p.title}
                                        </div>
                                        <div className="text-muted-foreground">
                                            /{p.slug}
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <div className="flex items-center gap-3">
                                            <img
                                                src={p.design_image_url}
                                                alt={`Design artwork for ${p.title}`}
                                                className="border-border/70 size-11 rounded-sm border object-cover"
                                            />
                                            <span className="min-w-0">
                                                <span className="text-muted-foreground block max-w-40 truncate">
                                                    {p.design_name}
                                                </span>
                                                <span
                                                    className="text-muted-foreground block max-w-52 truncate text-xs"
                                                    title={p.source_path}
                                                >
                                                    {p.source_path}
                                                </span>
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-3 capitalize">
                                        {p.status}
                                    </td>
                                    <td className="p-3">
                                        <Select
                                            aria-label={`Preview ${p.title} in a catalog`}
                                            onValueChange={(value) => {
                                                window.open(
                                                    `${storefrontUrl}/product/${encodeURIComponent(p.slug)}/${encodeURIComponent(value)}`,
                                                    '_blank',
                                                    'noopener,noreferrer',
                                                );
                                            }}
                                        >
                                            <SelectTrigger className="w-52">
                                                <SelectValue placeholder="Select catalog" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {p.available_catalogs.map(
                                                    (catalog) => (
                                                        <SelectItem
                                                            key={catalog.slug}
                                                            value={catalog.slug}
                                                        >
                                                            {catalog.name}
                                                        </SelectItem>
                                                    ),
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    <td className="p-3 text-right">
                                        <Button variant="ghost" asChild>
                                            <Link
                                                href={`/products/${p.id}/edit`}
                                            >
                                                Edit
                                            </Link>
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <ResourcePagination {...products} />
            </div>
        </>
    );
}

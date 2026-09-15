import { Head, router } from '@inertiajs/react';
import { Play, Terminal } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';

type Operation = {
    id: string;
    title: string;
    description: string;
    command: string;
    confirmation: string | null;
};

type ImportFolder = {
    path: string;
    label: string;
    count: number;
};

export default function Operations({
    importFolders,
    operations,
}: {
    importFolders: ImportFolder[];
    operations: Operation[];
}) {
    const [running, setRunning] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [folder, setFolder] = useState(importFolders[0]?.path ?? '');

    const run = (operation: Operation) => {
        if (running !== null) return;
        if (operation.confirmation && !window.confirm(operation.confirmation))
            return;

        setRunning(operation.id);
        setError('');
        router.post(
            `/operations/${operation.id}`,
            {},
            {
                preserveScroll: true,
                onError: (errors) =>
                    setError(errors.import ?? 'Không thể chạy lệnh.'),
                onFinish: () => setRunning(null),
            },
        );
    };

    const importProducts = () => {
        if (running !== null || folder === '') return;

        setRunning('import-products');
        setError('');
        router.post(
            '/products/import',
            { folder },
            {
                preserveScroll: true,
                onError: (errors) =>
                    setError(
                        errors.import ??
                            errors.folder ??
                            'Không thể import products.',
                    ),
                onFinish: () => setRunning(null),
            },
        );
    };

    return (
        <>
            <Head title="Vận hành" />
            <div className="space-y-6 p-6">
                <div>
                    <h1 className="text-2xl font-semibold">Vận hành</h1>
                    <p className="text-muted-foreground">
                        Chạy các tác vụ hệ thống mà không cần mở terminal.
                    </p>
                </div>
                {error && (
                    <p
                        role="alert"
                        className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border p-3 text-sm"
                    >
                        {error}
                    </p>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                    {operations.map((operation) => (
                        <Card key={operation.id}>
                            <CardHeader>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-1.5">
                                        <CardTitle>{operation.title}</CardTitle>
                                        <CardDescription>
                                            {operation.description}
                                        </CardDescription>
                                    </div>
                                    <Terminal
                                        className="text-muted-foreground size-5 shrink-0"
                                        aria-hidden="true"
                                    />
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <code className="bg-muted block overflow-x-auto rounded-md px-3 py-2 text-xs">
                                    {operation.command}
                                </code>
                                <Button
                                    type="button"
                                    onClick={() => run(operation)}
                                    disabled={running !== null}
                                >
                                    {running === operation.id ? (
                                        <Spinner />
                                    ) : (
                                        <Play
                                            className="size-4"
                                            aria-hidden="true"
                                        />
                                    )}
                                    {running === operation.id
                                        ? 'Đang chạy...'
                                        : 'Chạy lệnh'}
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Import products</CardTitle>
                        <CardDescription>
                            Nhập design trong folder thành product đang bán.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Select value={folder} onValueChange={setFolder}>
                            <SelectTrigger
                                aria-label="Folder design"
                                className="w-full"
                            >
                                <SelectValue placeholder="Select design folder" />
                            </SelectTrigger>
                            <SelectContent>
                                {importFolders.map((item) => (
                                    <SelectItem
                                        key={item.path}
                                        value={item.path}
                                    >
                                        {item.label} ({item.count} ảnh)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <code className="bg-muted block overflow-x-auto rounded-md px-3 py-2 text-xs">
                            python -m app.cli import-products --design-dir
                            {' <folder> --publish'}
                        </code>
                        <Button
                            type="button"
                            onClick={importProducts}
                            disabled={running !== null || folder === ''}
                        >
                            {running === 'import-products' ? (
                                <Spinner />
                            ) : (
                                <Play className="size-4" aria-hidden="true" />
                            )}
                            {running === 'import-products'
                                ? 'Đang import...'
                                : 'Import products'}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

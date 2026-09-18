import { Head, Link, router } from '@inertiajs/react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

type PrintAreaRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type CatalogPrintArea = PrintAreaRect & {
    regions: PrintAreaRect[];
    template_width: number;
    template_height: number;
    assets?: CatalogMockup[];
};

type CatalogMockup = CatalogPrintArea & {
    metadata_id: number;
    asset_id: number | null;
    placement: string;
    source_path: string;
    image_url: string;
};

type Catalog = {
    id: number | string;
    name: string;
    product_type: string | null;
    thumbnail_url: string;
    print_area: CatalogPrintArea | null;
    price_minor: number | null;
    base_price_minor: number | null;
    currency: string | null;
    variant_count: number;
};

type CatalogProps = {
    catalogs: { data: Catalog[] };
    filters: { q?: string };
    printAreaPlaceholderUrl: string;
};

function getDisplayPrintAreas(catalog: Catalog): PrintAreaRect[] {
    return getDisplayPrintAreasFromArea(catalog.print_area);
}

function getDisplayPrintAreasFromArea(
    printArea: CatalogPrintArea | null,
): PrintAreaRect[] {
    if (!printArea) return [];

    const regions =
        printArea.regions.length > 0 ? printArea.regions : [printArea];
    return regions.filter(
        (area) =>
            Number.isFinite(area.x) &&
            Number.isFinite(area.y) &&
            Number.isFinite(area.width) &&
            Number.isFinite(area.height) &&
            area.x >= 0 &&
            area.y >= 0 &&
            area.width > 0 &&
            area.height > 0 &&
            area.x + area.width <= 1 &&
            area.y + area.height <= 1,
    );
}

function isPrintAreaWithinTemplate(
    area: PrintAreaRect | null,
): area is PrintAreaRect {
    return (
        area !== null &&
        Number.isFinite(area.x) &&
        Number.isFinite(area.y) &&
        Number.isFinite(area.width) &&
        Number.isFinite(area.height) &&
        area.x >= 0 &&
        area.y >= 0 &&
        area.width > 0 &&
        area.height > 0 &&
        area.x + area.width <= 1 &&
        area.y + area.height <= 1
    );
}

function formatPercentage(value: number): string {
    return `${Math.round(value * 10_000) / 100}`;
}

function parsePercentage(value: string): number | null {
    const normalized = value.trim();
    if (normalized === '') return null;

    const parsed = Number(normalized);

    return Number.isFinite(parsed) ? parsed / 100 : null;
}

function formatPriceInput(priceMinor: number | null): string {
    return priceMinor === null ? '' : (priceMinor / 100).toFixed(2);
}

function parsePriceMinor(value: string): number | null {
    const normalized = value.trim();
    const pricePattern = /^\d+(?:\.\d{0,2})?$/;

    if (!pricePattern.test(normalized)) return null;

    const [dollars, cents = ''] = normalized.split('.');
    const priceMinor = Number(dollars) * 100 + Number(cents.padEnd(2, '0'));

    return Number.isSafeInteger(priceMinor) && priceMinor >= 0
        ? priceMinor
        : null;
}

function CatalogMockupImage({
    catalog,
    printAreaPlaceholderUrl,
    printAreas,
    imageUrl,
    area,
}: {
    catalog: Catalog;
    printAreaPlaceholderUrl: string;
    printAreas: PrintAreaRect[];
    imageUrl?: string;
    area?: CatalogPrintArea | null;
}) {
    const printArea = area ?? catalog.print_area;
    const templateRatio =
        printArea?.template_width && printArea.template_height
            ? printArea.template_width / printArea.template_height
            : 1;
    const imageFrameStyle =
        templateRatio >= 1
            ? {
                  width: '100%',
                  height: `${100 / templateRatio}%`,
              }
            : {
                  width: `${templateRatio * 100}%`,
                  height: '100%',
              };

    return (
        <div className="flex h-full w-full items-center justify-center">
            <div className="relative" style={imageFrameStyle}>
                <img
                    src={imageUrl ?? catalog.thumbnail_url}
                    alt={`Black ${catalog.name} mockup`}
                    className="h-full w-full object-contain"
                />
                {printAreas.map((area, index) => (
                    <img
                        key={`${catalog.id}-print-area-${index}`}
                        src={printAreaPlaceholderUrl}
                        alt=""
                        aria-hidden="true"
                        className="pointer-events-none absolute object-fill"
                        style={{
                            left: `${area.x * 100}%`,
                            top: `${area.y * 100}%`,
                            width: `${area.width * 100}%`,
                            height: `${area.height * 100}%`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

function CatalogThumbnail({
    catalog,
    printAreaPlaceholderUrl,
}: {
    catalog: Catalog;
    printAreaPlaceholderUrl: string;
}) {
    const printArea = catalog.print_area;

    return (
        <div className="bg-muted/30 relative aspect-square size-32 overflow-hidden rounded-lg p-3 sm:size-36">
            <CatalogMockupImage
                catalog={catalog}
                printAreaPlaceholderUrl={printAreaPlaceholderUrl}
                printAreas={getDisplayPrintAreas(catalog)}
            />
            {printArea && (
                <span
                    role="img"
                    aria-label="Print area configured"
                    title="Print area configured"
                    className="absolute top-2 right-2 z-10 inline-flex size-6 items-center justify-center rounded-full bg-emerald-600 text-white shadow"
                >
                    <Check aria-hidden="true" className="size-4" />
                </span>
            )}
        </div>
    );
}

function PrintAreaEditor({
    catalog,
    printAreaPlaceholderUrl,
    onOpenChange,
}: {
    catalog: Catalog | null;
    printAreaPlaceholderUrl: string;
    onOpenChange: (open: boolean) => void;
}) {
    const [coordinates, setCoordinates] = useState({
        x: '',
        y: '',
        width: '',
    });
    const [assetIndex, setAssetIndex] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [requestError, setRequestError] = useState('');

    const assets = useMemo(() => {
        if (!catalog?.print_area) return [];
        if ((catalog.print_area.assets?.length ?? 0) > 0) {
            return catalog.print_area.assets ?? [];
        }
        return [
            {
                ...catalog.print_area,
                metadata_id: 0,
                asset_id: null,
                placement: 'front',
                source_path: '',
                image_url: catalog.thumbnail_url,
            },
        ];
    }, [catalog]);
    const selectedAsset = assets[assetIndex] ?? assets[0] ?? null;
    const selectedImageUrl = selectedAsset?.source_path.endsWith('/front.png')
        ? catalog?.thumbnail_url
        : selectedAsset?.image_url;

    useEffect(() => {
        setAssetIndex(0);
    }, [catalog]);

    useEffect(() => {
        if (!selectedAsset) {
            setCoordinates({ x: '', y: '', width: '' });
            setRequestError('');
            return;
        }

        setCoordinates({
            x: formatPercentage(selectedAsset.x),
            y: formatPercentage(selectedAsset.y),
            width: formatPercentage(selectedAsset.width),
        });
        setRequestError('');
    }, [selectedAsset]);

    const draft = useMemo(() => {
        if (!selectedAsset) return null;

        const x = parsePercentage(coordinates.x);
        const y = parsePercentage(coordinates.y);
        const width = parsePercentage(coordinates.width);
        if (x === null || y === null || width === null) return null;

        const height =
            (width * selectedAsset.template_width * 6) /
            (selectedAsset.template_height * 5);

        return {
            x,
            y,
            width,
            height,
        };
    }, [coordinates, selectedAsset]);

    const canSave = isPrintAreaWithinTemplate(draft);
    const printAreas =
        canSave && draft && selectedAsset
            ? [draft, ...getDisplayPrintAreasFromArea(selectedAsset).slice(1)]
            : selectedAsset
              ? getDisplayPrintAreasFromArea(selectedAsset)
              : [];
    const validationMessage =
        selectedAsset && !canSave
            ? 'X, Y and width must keep the entire 5:6 print area inside the mockup.'
            : '';

    const savePrintArea = () => {
        if (!catalog || !selectedAsset || !draft || !canSave || isSaving)
            return;

        setIsSaving(true);
        setRequestError('');
        router.put(
            `/catalog/${catalog.id}/print-area`,
            { metadata_id: selectedAsset.metadata_id, ...draft },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['catalogs'],
                onSuccess: () => onOpenChange(false),
                onError: (errors) =>
                    setRequestError(
                        errors.x ??
                            errors.y ??
                            errors.width ??
                            errors.height ??
                            errors.print_area ??
                            "We couldn't update this print area. Try again.",
                    ),
                onFinish: () => setIsSaving(false),
            },
        );
    };

    return (
        <Sheet
            open={catalog !== null}
            onOpenChange={(open) => {
                if (!open && !isSaving) onOpenChange(false);
            }}
        >
            {catalog && (
                <SheetContent
                    side="right"
                    className="w-full max-w-none gap-0 p-0 sm:w-[min(100vw,72rem)] sm:max-w-none"
                >
                    <SheetHeader className="border-b px-5 py-4 pr-12 sm:px-6">
                        <SheetTitle>Print area - {catalog.name}</SheetTitle>
                    </SheetHeader>
                    {catalog.print_area && selectedAsset ? (
                        <form
                            className="grid min-h-0 flex-1 grid-rows-[auto_minmax(30rem,1fr)] overflow-y-auto lg:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.15fr)] lg:grid-rows-1 lg:overflow-hidden"
                            onSubmit={(event) => {
                                event.preventDefault();
                                savePrintArea();
                            }}
                        >
                            <section className="flex min-h-0 flex-col gap-5 p-5 sm:p-6">
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1">
                                        <h3 className="font-medium">
                                            Position
                                        </h3>
                                        <p className="text-muted-foreground text-sm tabular-nums">
                                            {`${Math.round(selectedAsset.template_width)} × ${Math.round(selectedAsset.template_height)} px template`}
                                        </p>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <label
                                            className="grid gap-1.5"
                                            htmlFor="print-area-x"
                                        >
                                            <span className="text-sm font-medium">
                                                X position (%)
                                            </span>
                                            <Input
                                                id="print-area-x"
                                                type="number"
                                                inputMode="decimal"
                                                min="0"
                                                max="100"
                                                step="0.1"
                                                value={coordinates.x}
                                                aria-invalid={
                                                    validationMessage !== ''
                                                }
                                                onChange={(event) => {
                                                    setCoordinates(
                                                        (current) => ({
                                                            ...current,
                                                            x: event.target
                                                                .value,
                                                        }),
                                                    );
                                                    setRequestError('');
                                                }}
                                            />
                                        </label>
                                        <label
                                            className="grid gap-1.5"
                                            htmlFor="print-area-y"
                                        >
                                            <span className="text-sm font-medium">
                                                Y position (%)
                                            </span>
                                            <Input
                                                id="print-area-y"
                                                type="number"
                                                inputMode="decimal"
                                                min="0"
                                                max="100"
                                                step="0.1"
                                                value={coordinates.y}
                                                aria-invalid={
                                                    validationMessage !== ''
                                                }
                                                onChange={(event) => {
                                                    setCoordinates(
                                                        (current) => ({
                                                            ...current,
                                                            y: event.target
                                                                .value,
                                                        }),
                                                    );
                                                    setRequestError('');
                                                }}
                                            />
                                        </label>
                                        <label
                                            className="grid gap-1.5"
                                            htmlFor="print-area-width"
                                        >
                                            <span className="text-sm font-medium">
                                                Width (%)
                                            </span>
                                            <Input
                                                id="print-area-width"
                                                type="number"
                                                inputMode="decimal"
                                                min="0"
                                                max="100"
                                                step="0.1"
                                                value={coordinates.width}
                                                aria-invalid={
                                                    validationMessage !== ''
                                                }
                                                onChange={(event) => {
                                                    setCoordinates(
                                                        (current) => ({
                                                            ...current,
                                                            width: event.target
                                                                .value,
                                                        }),
                                                    );
                                                    setRequestError('');
                                                }}
                                            />
                                        </label>
                                    </div>
                                    <div className="bg-muted/50 grid gap-3 rounded-lg p-3 text-sm sm:grid-cols-2">
                                        <p>
                                            <span className="text-muted-foreground block text-xs tracking-wide uppercase">
                                                Width
                                            </span>
                                            <span className="font-medium tabular-nums">
                                                {formatPercentage(
                                                    draft?.width ??
                                                        selectedAsset.width,
                                                )}
                                                %
                                            </span>
                                        </p>
                                        <p>
                                            <span className="text-muted-foreground block text-xs tracking-wide uppercase">
                                                Height (auto)
                                            </span>
                                            <span className="font-medium tabular-nums">
                                                {formatPercentage(
                                                    draft?.height ??
                                                        selectedAsset.height,
                                                )}
                                                %
                                            </span>
                                        </p>
                                    </div>
                                    {(validationMessage !== '' ||
                                        requestError !== '') && (
                                        <p
                                            className="text-destructive text-sm"
                                            role="alert"
                                        >
                                            {requestError || validationMessage}
                                        </p>
                                    )}
                                </div>
                                <div className="mt-auto flex justify-end gap-2 border-t pt-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={isSaving}
                                        onClick={() => onOpenChange(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={!canSave || isSaving}
                                    >
                                        {isSaving && <Spinner />}
                                        {isSaving
                                            ? 'Saving position...'
                                            : 'Save position'}
                                    </Button>
                                </div>
                            </section>
                            <section className="bg-muted/30 flex min-h-0 min-w-0 flex-col gap-4 border-t p-4 lg:border-t-0 lg:border-l lg:p-6">
                                <div className="bg-background min-h-0 flex-1 overflow-hidden rounded-xl border p-2">
                                    <CatalogMockupImage
                                        catalog={catalog}
                                        area={selectedAsset}
                                        imageUrl={selectedImageUrl}
                                        printAreaPlaceholderUrl={
                                            printAreaPlaceholderUrl
                                        }
                                        printAreas={printAreas}
                                    />
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={assetIndex === 0 || isSaving}
                                        onClick={() =>
                                            setAssetIndex((index) =>
                                                Math.max(0, index - 1),
                                            )
                                        }
                                        aria-label="Previous mockup"
                                    >
                                        <ChevronLeft aria-hidden="true" />
                                        Previous
                                    </Button>
                                    <p className="text-muted-foreground truncate text-center text-xs">
                                        Mockup {assetIndex + 1} of{' '}
                                        {assets.length}:{' '}
                                        {selectedAsset.source_path
                                            .split('/')
                                            .pop() || selectedAsset.placement}
                                    </p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={
                                            assetIndex >= assets.length - 1 ||
                                            isSaving
                                        }
                                        onClick={() =>
                                            setAssetIndex((index) =>
                                                Math.min(
                                                    assets.length - 1,
                                                    index + 1,
                                                ),
                                            )
                                        }
                                        aria-label="Next mockup"
                                    >
                                        Next
                                        <ChevronRight aria-hidden="true" />
                                    </Button>
                                </div>
                            </section>
                        </form>
                    ) : (
                        <p className="text-muted-foreground p-6 text-sm">
                            This catalog does not have a configured print area
                            yet. Run Analyze catalog mockups before editing it.
                        </p>
                    )}
                </SheetContent>
            )}
        </Sheet>
    );
}

function CatalogPriceEditor({ catalog }: { catalog: Catalog }) {
    const formattedPrice = formatPriceInput(catalog.price_minor);
    const [value, setValue] = useState(formattedPrice);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isSaving) setValue(formattedPrice);
    }, [formattedPrice, isSaving]);

    if (catalog.price_minor === null) {
        return <span className="text-muted-foreground">No variants</span>;
    }

    const savePrice = () => {
        if (isSaving) return;

        const priceMinor = parsePriceMinor(value);
        if (priceMinor === null) {
            setError(
                'Price needs a number such as 29.99, with up to two decimal places.',
            );
            return;
        }
        if (priceMinor === catalog.price_minor) {
            setValue(formatPriceInput(priceMinor));
            setError('');
            return;
        }

        setIsSaving(true);
        setError('');
        router.put(
            `/catalog/${catalog.id}/price`,
            { price_minor: priceMinor },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['catalogs'],
                onSuccess: () => setValue(formatPriceInput(priceMinor)),
                onError: (errors) =>
                    setError(
                        errors.price_minor ??
                            "We couldn't update this price. Try again.",
                    ),
                onFinish: () => setIsSaving(false),
            },
        );
    };

    return (
        <div className="w-52">
            <label className="sr-only" htmlFor={`catalog-price-${catalog.id}`}>
                {`Price for ${catalog.name}`}
            </label>
            <div className="flex items-center gap-2">
                <Input
                    id={`catalog-price-${catalog.id}`}
                    value={value}
                    inputMode="decimal"
                    aria-invalid={error !== ''}
                    aria-describedby={
                        error === ''
                            ? undefined
                            : `catalog-price-error-${catalog.id}`
                    }
                    onChange={(event) => {
                        setValue(event.target.value);
                        if (error !== '') setError('');
                    }}
                    onBlur={savePrice}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            event.currentTarget.blur();
                        }
                        if (event.key === 'Escape') {
                            setValue(formattedPrice);
                            setError('');
                            event.currentTarget.blur();
                        }
                    }}
                    disabled={isSaving}
                    placeholder="0.00"
                />
                {isSaving ? (
                    <Spinner className="text-muted-foreground shrink-0" />
                ) : (
                    <span className="text-muted-foreground text-xs font-medium">
                        {catalog.currency ?? 'USD'}
                    </span>
                )}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
                Applies to {catalog.variant_count} variant
                {catalog.variant_count === 1 ? '' : 's'}
            </p>
            {error !== '' && (
                <p
                    id={`catalog-price-error-${catalog.id}`}
                    className="text-destructive mt-1 text-xs"
                >
                    {error}
                </p>
            )}
        </div>
    );
}

function CatalogBasePriceEditor({ catalog }: { catalog: Catalog }) {
    const formattedPrice = formatPriceInput(catalog.base_price_minor);
    const [value, setValue] = useState(formattedPrice);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isSaving) setValue(formattedPrice);
    }, [formattedPrice, isSaving]);

    if (catalog.price_minor === null) {
        return null;
    }

    const saveBasePrice = () => {
        if (isSaving) return;

        const normalized = value.trim();
        const basePriceMinor =
            normalized === '' ? null : parsePriceMinor(normalized);
        if (basePriceMinor === null && normalized !== '') {
            setError(
                'Base price needs a number such as 36.98, with up to two decimal places.',
            );
            return;
        }
        if (basePriceMinor === catalog.base_price_minor) {
            setValue(formatPriceInput(basePriceMinor));
            setError('');
            return;
        }

        setIsSaving(true);
        setError('');
        router.put(
            `/catalog/${catalog.id}/base-price`,
            { base_price_minor: basePriceMinor },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['catalogs'],
                onSuccess: () => setValue(formatPriceInput(basePriceMinor)),
                onError: (errors) =>
                    setError(
                        errors.base_price_minor ??
                            "We couldn't update this base price. Try again.",
                    ),
                onFinish: () => setIsSaving(false),
            },
        );
    };

    return (
        <div className="w-52">
            <label
                className="sr-only"
                htmlFor={`catalog-base-price-${catalog.id}`}
            >
                {`Base price for ${catalog.name}`}
            </label>
            <div className="flex items-center gap-2">
                <Input
                    id={`catalog-base-price-${catalog.id}`}
                    value={value}
                    inputMode="decimal"
                    aria-invalid={error !== ''}
                    aria-describedby={
                        error === ''
                            ? undefined
                            : `catalog-base-price-error-${catalog.id}`
                    }
                    onChange={(event) => {
                        setValue(event.target.value);
                        if (error !== '') setError('');
                    }}
                    onBlur={saveBasePrice}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            event.currentTarget.blur();
                        }
                        if (event.key === 'Escape') {
                            setValue(formattedPrice);
                            setError('');
                            event.currentTarget.blur();
                        }
                    }}
                    disabled={isSaving}
                    placeholder="Optional"
                />
                {isSaving ? (
                    <Spinner className="text-muted-foreground shrink-0" />
                ) : (
                    <span className="text-muted-foreground text-xs font-medium">
                        {catalog.currency ?? 'USD'}
                    </span>
                )}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
                Optional original price
            </p>
            {error !== '' && (
                <p
                    id={`catalog-base-price-error-${catalog.id}`}
                    className="text-destructive mt-1 text-xs"
                >
                    {error}
                </p>
            )}
        </div>
    );
}

export default function Catalog({
    catalogs,
    filters,
    printAreaPlaceholderUrl,
}: CatalogProps) {
    const [previewCatalog, setPreviewCatalog] = useState<Catalog | null>(null);

    return (
        <>
            <Head title="Catalog" />
            <div className="space-y-6 p-6">
                <div className="flex items-start justify-between gap-6">
                    <div>
                        <h1 className="text-2xl font-semibold">Catalog</h1>
                        <p className="text-muted-foreground">
                            Manage provider products, variants and stock
                            defaults.
                        </p>
                    </div>
                    <Button asChild>
                        <Link href="/catalog/create">New catalog</Link>
                    </Button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {[
                        'all',
                        'unisex',
                        'women',
                        'kids',
                        'accessories',
                        'home-living',
                    ].map((category) => (
                        <Link
                            key={category}
                            href={
                                category === 'all'
                                    ? '/catalog'
                                    : `/catalog?category=${category}`
                            }
                            className="hover:bg-muted/40 rounded-xl border p-4 text-sm font-medium capitalize"
                        >
                            {category === 'all'
                                ? 'All catalogs'
                                : category.replace('-', ' ')}
                        </Link>
                    ))}
                </div>
                <form className="flex gap-2">
                    <Input
                        name="q"
                        defaultValue={filters.q}
                        placeholder="Search catalog"
                    />
                    <Button variant="outline">Filter</Button>
                </form>
                <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full min-w-[940px] text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="w-44 p-3 text-left">Image</th>
                                <th className="p-3 text-left">Catalog</th>
                                <th className="w-72 p-3 text-left">Price</th>
                                <th className="w-72 p-3 text-left">
                                    Base price
                                </th>
                                <th className="w-20 p-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {catalogs.data.map((catalog) => (
                                <tr className="border-t" key={catalog.id}>
                                    <td className="p-3">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setPreviewCatalog(catalog)
                                            }
                                            className="focus-visible:ring-ring inline-block rounded-lg focus-visible:ring-[3px] focus-visible:outline-none"
                                            aria-label={`Edit print area for ${catalog.name}`}
                                        >
                                            <CatalogThumbnail
                                                catalog={catalog}
                                                printAreaPlaceholderUrl={
                                                    printAreaPlaceholderUrl
                                                }
                                            />
                                        </button>
                                    </td>
                                    <td className="p-3 align-middle">
                                        <Link
                                            href={`/catalog/${catalog.id}/edit`}
                                            className="font-medium hover:underline"
                                        >
                                            {catalog.name}
                                        </Link>
                                        {catalog.product_type && (
                                            <p className="text-muted-foreground mt-1 capitalize">
                                                {catalog.product_type.replaceAll(
                                                    '_',
                                                    ' ',
                                                )}
                                            </p>
                                        )}
                                    </td>
                                    <td className="p-3 align-middle">
                                        <CatalogPriceEditor catalog={catalog} />
                                    </td>
                                    <td className="p-3 align-middle">
                                        <CatalogBasePriceEditor
                                            catalog={catalog}
                                        />
                                    </td>
                                    <td className="p-3 text-right align-middle">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            asChild
                                        >
                                            <Link
                                                href={`/catalog/${catalog.id}/edit`}
                                            >
                                                Edit
                                            </Link>
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {catalogs.data.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="text-muted-foreground p-6 text-center"
                                    >
                                        No catalogs match this filter. Try
                                        another search.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <PrintAreaEditor
                catalog={previewCatalog}
                printAreaPlaceholderUrl={printAreaPlaceholderUrl}
                onOpenChange={(open) => {
                    if (!open) setPreviewCatalog(null);
                }}
            />
        </>
    );
}

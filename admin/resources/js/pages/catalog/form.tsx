import type { FormEvent } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type Catalog = {
    id: number;
    name: string;
    slug: string;
    product_type: string;
    brand: string | null;
    material: string | null;
    description_override: string | null;
    model_mockup_prompt: string | null;
    active: boolean;
    sort_order: number;
};

type CatalogVariant = {
    id: number;
    sku: string;
    color: string;
    size: string;
    default_price_minor: number;
    currency: string;
    stock_policy: string;
    stock_quantity: number;
};

type CatalogColor = {
    id: number;
    slug: string;
    name: string;
};

type ModelMockup = {
    id: number;
    style: 'men' | 'women';
    placement: 'front' | 'left-chest' | 'back';
    base_source: string;
    template_width: number;
    template_height: number;
    color_name: string;
};

type CatalogFormData = {
    name: string;
    slug: string;
    product_type: string;
    brand: string;
    material: string;
    description_override: string;
    model_mockup_prompt: string;
    active: boolean;
    sort_order: number;
};

type ModelMockupFormData = {
    color_id: string;
    style: 'men' | 'women';
    placement: 'front' | 'left-chest' | 'back';
    asset: File | null;
    print_area_x: number;
    print_area_y: number;
    print_area_width: number;
    print_area_height: number;
};

type CatalogFormProps = {
    catalog: Catalog | null;
    variants: CatalogVariant[];
    colors: CatalogColor[];
    modelMockups: ModelMockup[];
};

function suggestedModelPrompt(catalog: Catalog | null) {
    const garment = catalog?.name || catalog?.product_type || 'apparel';
    const brand = catalog?.brand ? ` by ${catalog.brand}` : '';
    const material = catalog?.material
        ? ` The fabric is ${catalog.material}.`
        : '';

    return `Create a photorealistic 4:5 e-commerce apparel image of an adult {{model_gender}} wearing a plain {{garment_color}} ${garment}${brand}. Match the supplied catalog reference for silhouette, neckline, sleeve length, fabric weight, and fit.${material} Frame from upper thigh to above the head, with the model facing forward under soft studio lighting. Keep both arms away from the chest, leave the garment blank with no artwork or logos, and keep the print area unobstructed. No props, no text, no watermark.`;
}

function defaultPrintArea(productType: string) {
    const type = productType.toLowerCase();

    return type.includes('hoodie') || type.includes('sweatshirt')
        ? { x: 30, y: 16, width: 40, height: 28 }
        : { x: 30, y: 25, width: 40, height: 40 };
}

function FieldError({ message }: { message?: string }) {
    return message ? (
        <p className="text-destructive text-sm">{message}</p>
    ) : null;
}

export default function CatalogForm({
    catalog,
    variants,
    colors,
    modelMockups,
}: CatalogFormProps) {
    const defaultArea = defaultPrintArea(catalog?.product_type ?? '');
    const form = useForm<CatalogFormData>({
        name: catalog?.name ?? '',
        slug: catalog?.slug ?? '',
        product_type: catalog?.product_type ?? '',
        brand: catalog?.brand ?? '',
        material: catalog?.material ?? '',
        description_override: catalog?.description_override ?? '',
        model_mockup_prompt:
            catalog?.model_mockup_prompt ?? suggestedModelPrompt(catalog),
        active: catalog?.active ?? true,
        sort_order: catalog?.sort_order ?? 0,
    });
    const modelForm = useForm<ModelMockupFormData>({
        color_id: colors[0] ? String(colors[0].id) : '',
        style: 'men',
        placement: 'front',
        asset: null,
        print_area_x: defaultArea.x,
        print_area_y: defaultArea.y,
        print_area_width: defaultArea.width,
        print_area_height: defaultArea.height,
    });

    const submitCatalog = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (catalog) {
            form.put(`/catalog/${catalog.id}`);
            return;
        }
        form.post('/catalog');
    };
    const submitModelMockup = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!catalog) {
            return;
        }
        modelForm.post(`/catalog/${catalog.id}/model-mockups`, {
            forceFormData: true,
            onSuccess: () => modelForm.reset('asset'),
        });
    };

    return (
        <>
            <Head title={catalog ? 'Edit catalog' : 'New catalog'} />
            <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
                <div>
                    <h1 className="text-2xl font-semibold">
                        {catalog ? 'Edit catalog' : 'New catalog'}
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Catalog details and reusable mockup instructions live
                        together.
                    </p>
                </div>

                <form className="space-y-6" onSubmit={submitCatalog}>
                    <Card>
                        <CardHeader>
                            <CardTitle>Catalog details</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-5 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="catalog-name">Name</Label>
                                <Input
                                    id="catalog-name"
                                    value={form.data.name}
                                    onChange={(event) =>
                                        form.setData('name', event.target.value)
                                    }
                                    aria-invalid={Boolean(form.errors.name)}
                                />
                                <FieldError message={form.errors.name} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="catalog-slug">Slug</Label>
                                <Input
                                    id="catalog-slug"
                                    value={form.data.slug}
                                    onChange={(event) =>
                                        form.setData('slug', event.target.value)
                                    }
                                    aria-invalid={Boolean(form.errors.slug)}
                                />
                                <FieldError message={form.errors.slug} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="catalog-product-type">
                                    Product type
                                </Label>
                                <Input
                                    id="catalog-product-type"
                                    value={form.data.product_type}
                                    onChange={(event) =>
                                        form.setData(
                                            'product_type',
                                            event.target.value,
                                        )
                                    }
                                    aria-invalid={Boolean(
                                        form.errors.product_type,
                                    )}
                                />
                                <FieldError
                                    message={form.errors.product_type}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="catalog-brand">Brand</Label>
                                <Input
                                    id="catalog-brand"
                                    value={form.data.brand}
                                    onChange={(event) =>
                                        form.setData(
                                            'brand',
                                            event.target.value,
                                        )
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="catalog-material">
                                    Material
                                </Label>
                                <Input
                                    id="catalog-material"
                                    value={form.data.material}
                                    onChange={(event) =>
                                        form.setData(
                                            'material',
                                            event.target.value,
                                        )
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="catalog-sort-order">
                                    Sort order
                                </Label>
                                <Input
                                    id="catalog-sort-order"
                                    type="number"
                                    min={0}
                                    value={form.data.sort_order}
                                    onChange={(event) =>
                                        form.setData(
                                            'sort_order',
                                            Number(event.target.value),
                                        )
                                    }
                                    aria-invalid={Boolean(
                                        form.errors.sort_order,
                                    )}
                                />
                                <FieldError message={form.errors.sort_order} />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="catalog-description">
                                    Description override
                                </Label>
                                <Textarea
                                    id="catalog-description"
                                    className="min-h-28"
                                    value={form.data.description_override}
                                    onChange={(event) =>
                                        form.setData(
                                            'description_override',
                                            event.target.value,
                                        )
                                    }
                                />
                            </div>
                            <div className="flex items-center gap-2 sm:col-span-2">
                                <Checkbox
                                    id="catalog-active"
                                    checked={form.data.active}
                                    onCheckedChange={(checked) =>
                                        form.setData('active', checked === true)
                                    }
                                />
                                <Label htmlFor="catalog-active">Active</Label>
                            </div>
                        </CardContent>
                    </Card>

                    {catalog ? (
                        <Card>
                            <CardHeader>
                                <CardTitle>Catalog front mockup</CardTitle>
                                <CardDescription>
                                    Preview the blank front image for this
                                    catalog. If its front.png is unavailable,
                                    the existing catalog image is shown.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,0.65fr)] sm:items-center">
                                <div className="bg-muted/30 flex min-h-64 items-center justify-center rounded-lg border p-3">
                                    <img
                                        alt={`${catalog.name} front mockup`}
                                        className="max-h-[28rem] w-full object-contain"
                                        src={`/catalog/${catalog.id}/asset`}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <p className="font-medium">
                                        {catalog.name}
                                    </p>
                                    <p className="text-muted-foreground text-sm">
                                        Uses the matching mockup folder for this
                                        catalog.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ) : null}

                    <Card>
                        <CardHeader>
                            <CardTitle>AI model mockup prompt</CardTitle>
                            <CardDescription>
                                This prompt is reused to create approved base
                                images. Keep the tokens for gender and garment
                                color.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <Label htmlFor="catalog-model-prompt">Prompt</Label>
                            <Textarea
                                id="catalog-model-prompt"
                                className="min-h-48 font-mono text-xs leading-5"
                                value={form.data.model_mockup_prompt}
                                onChange={(event) =>
                                    form.setData(
                                        'model_mockup_prompt',
                                        event.target.value,
                                    )
                                }
                                aria-invalid={Boolean(
                                    form.errors.model_mockup_prompt,
                                )}
                            />
                            <FieldError
                                message={form.errors.model_mockup_prompt}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    form.setData(
                                        'model_mockup_prompt',
                                        suggestedModelPrompt(catalog),
                                    )
                                }
                            >
                                Use suggested prompt
                            </Button>
                        </CardContent>
                    </Card>

                    <div className="flex items-center gap-3">
                        <Button type="submit" disabled={form.processing}>
                            {form.processing ? 'Saving' : 'Save catalog'}
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href="/catalog">Cancel</Link>
                        </Button>
                    </div>
                </form>

                {catalog ? (
                    <>
                        <Card>
                            <CardHeader>
                                <CardTitle>Model templates</CardTitle>
                                <CardDescription>
                                    Upload an approved AI image once. The
                                    renderer applies each design to this image
                                    on demand.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form
                                    className="grid gap-5 md:grid-cols-2"
                                    onSubmit={submitModelMockup}
                                >
                                    <div className="space-y-2">
                                        <Label htmlFor="model-color">
                                            Garment color
                                        </Label>
                                        <Select
                                            value={modelForm.data.color_id}
                                            onValueChange={(value) =>
                                                modelForm.setData(
                                                    'color_id',
                                                    value,
                                                )
                                            }
                                        >
                                            <SelectTrigger
                                                id="model-color"
                                                className="w-full"
                                            >
                                                <SelectValue placeholder="Select color" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {colors.map((color) => (
                                                    <SelectItem
                                                        key={color.id}
                                                        value={String(color.id)}
                                                    >
                                                        {color.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FieldError
                                            message={modelForm.errors.color_id}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="model-style">
                                            Model
                                        </Label>
                                        <Select
                                            value={modelForm.data.style}
                                            onValueChange={(
                                                value: 'men' | 'women',
                                            ) =>
                                                modelForm.setData(
                                                    'style',
                                                    value,
                                                )
                                            }
                                        >
                                            <SelectTrigger
                                                id="model-style"
                                                className="w-full"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="men">
                                                    Men
                                                </SelectItem>
                                                <SelectItem value="women">
                                                    Women
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="model-placement">
                                            Placement
                                        </Label>
                                        <Select
                                            value={modelForm.data.placement}
                                            onValueChange={(
                                                value:
                                                    | 'front'
                                                    | 'left-chest'
                                                    | 'back',
                                            ) =>
                                                modelForm.setData(
                                                    'placement',
                                                    value,
                                                )
                                            }
                                        >
                                            <SelectTrigger
                                                id="model-placement"
                                                className="w-full"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="front">
                                                    Front
                                                </SelectItem>
                                                <SelectItem value="left-chest">
                                                    Left chest
                                                </SelectItem>
                                                <SelectItem value="back">
                                                    Back
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="model-asset">
                                            Generated image
                                        </Label>
                                        <Input
                                            id="model-asset"
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp"
                                            onChange={(event) =>
                                                modelForm.setData(
                                                    'asset',
                                                    event.target.files?.[0] ??
                                                        null,
                                                )
                                            }
                                            aria-invalid={Boolean(
                                                modelForm.errors.asset,
                                            )}
                                        />
                                        <FieldError
                                            message={modelForm.errors.asset}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 md:col-span-2 lg:grid-cols-4">
                                        {(
                                            [
                                                ['x', 'print_area_x'],
                                                ['y', 'print_area_y'],
                                                ['Width', 'print_area_width'],
                                                ['Height', 'print_area_height'],
                                            ] as const
                                        ).map(([label, field]) => (
                                            <div
                                                className="space-y-2"
                                                key={field}
                                            >
                                                <Label
                                                    htmlFor={`model-${field}`}
                                                >
                                                    {label} %
                                                </Label>
                                                <Input
                                                    id={`model-${field}`}
                                                    type="number"
                                                    min={0}
                                                    max={100}
                                                    value={
                                                        modelForm.data[field]
                                                    }
                                                    onChange={(event) =>
                                                        modelForm.setData(
                                                            field,
                                                            Number(
                                                                event.target
                                                                    .value,
                                                            ),
                                                        )
                                                    }
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="md:col-span-2">
                                        <Button
                                            type="submit"
                                            disabled={
                                                modelForm.processing ||
                                                colors.length === 0
                                            }
                                        >
                                            {modelForm.processing
                                                ? 'Uploading'
                                                : 'Save model template'}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>

                        {modelMockups.length > 0 ? (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {modelMockups.map((template) => (
                                    <Card
                                        className="gap-0 overflow-hidden py-0"
                                        key={template.id}
                                    >
                                        <img
                                            alt={`${template.style} model wearing ${template.color_name}`}
                                            className="bg-muted aspect-4/5 w-full object-cover"
                                            src={`/catalog/${catalog.id}/model-mockups/${template.id}/asset`}
                                        />
                                        <CardContent className="space-y-2 p-4">
                                            <div className="flex flex-wrap gap-2">
                                                <Badge variant="secondary">
                                                    {template.style}
                                                </Badge>
                                                <Badge variant="secondary">
                                                    {template.color_name}
                                                </Badge>
                                                <Badge variant="secondary">
                                                    {template.placement}
                                                </Badge>
                                            </div>
                                            <p className="text-muted-foreground text-xs">
                                                {template.template_width} x{' '}
                                                {template.template_height}
                                            </p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <Card>
                                <CardContent className="text-muted-foreground py-8 text-sm">
                                    No model templates yet. Save the catalog
                                    prompt, generate a blank garment image with
                                    the catalog reference, then upload the
                                    approved result here.
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardHeader>
                                <CardTitle>Variants</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50 text-muted-foreground text-left">
                                            <tr>
                                                <th className="px-6 py-3 font-medium">
                                                    Variant
                                                </th>
                                                <th className="px-6 py-3 font-medium">
                                                    Price
                                                </th>
                                                <th className="px-6 py-3 font-medium">
                                                    Stock
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {variants.map((variant) => (
                                                <tr
                                                    className="border-t"
                                                    key={variant.id}
                                                >
                                                    <td className="px-6 py-3">
                                                        <p className="font-medium">
                                                            {variant.sku}
                                                        </p>
                                                        <p className="text-muted-foreground">
                                                            {variant.color} /{' '}
                                                            {variant.size}
                                                        </p>
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        {(
                                                            variant.default_price_minor /
                                                            100
                                                        ).toFixed(2)}{' '}
                                                        {variant.currency}
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        {variant.stock_quantity}{' '}
                                                        ({variant.stock_policy})
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                ) : null}
            </div>
        </>
    );
}

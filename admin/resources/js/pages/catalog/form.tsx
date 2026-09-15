import { Head, Link, useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
export default function CatalogForm({ catalog, variants }: any) {
    const form = useForm({
        name: catalog?.name ?? '',
        slug: catalog?.slug ?? '',
        product_type: catalog?.product_type ?? '',
        brand: catalog?.brand ?? '',
        material: catalog?.material ?? '',
        description_override: catalog?.description_override ?? '',
        active: catalog?.active ?? true,
        sort_order: catalog?.sort_order ?? 0,
    });
    const submit = (e: any) => {
        e.preventDefault();
        catalog ? form.put(`/catalog/${catalog.id}`) : form.post('/catalog');
    };
    return (
        <>
            <Head title={catalog ? 'Edit catalog' : 'New catalog'} />
            <div className="space-y-6 p-6">
                <div>
                    <h1 className="text-2xl font-semibold">
                        {catalog ? 'Edit catalog' : 'New catalog'}
                    </h1>
                </div>
                <form
                    onSubmit={submit}
                    className="grid max-w-3xl gap-4 rounded-xl border p-6 sm:grid-cols-2"
                >
                    <Input
                        placeholder="Name"
                        value={form.data.name}
                        onChange={(e) => form.setData('name', e.target.value)}
                    />
                    <Input
                        placeholder="Slug"
                        value={form.data.slug}
                        onChange={(e) => form.setData('slug', e.target.value)}
                    />
                    <Input
                        placeholder="Product type"
                        value={form.data.product_type}
                        onChange={(e) =>
                            form.setData('product_type', e.target.value)
                        }
                    />
                    <Input
                        placeholder="Brand"
                        value={form.data.brand}
                        onChange={(e) => form.setData('brand', e.target.value)}
                    />
                    <Input
                        placeholder="Material"
                        value={form.data.material}
                        onChange={(e) =>
                            form.setData('material', e.target.value)
                        }
                    />
                    <Input
                        type="number"
                        placeholder="Sort order"
                        value={form.data.sort_order}
                        onChange={(e) =>
                            form.setData('sort_order', Number(e.target.value))
                        }
                    />
                    <Textarea
                        className="min-h-28 sm:col-span-2"
                        placeholder="Description override"
                        value={form.data.description_override}
                        onChange={(e) =>
                            form.setData('description_override', e.target.value)
                        }
                    />
                    <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                            checked={form.data.active}
                            onCheckedChange={(checked) =>
                                form.setData('active', checked === true)
                            }
                        />
                        <span>Active</span>
                    </label>
                    <div className="sm:col-span-2">
                        <Button>Save</Button>{' '}
                        <Button variant="outline" asChild>
                            <Link href="/catalog">Cancel</Link>
                        </Button>
                    </div>
                </form>
                {catalog && (
                    <div>
                        <h2 className="mb-3 text-lg font-medium">Variants</h2>
                        <div className="overflow-hidden rounded-xl border">
                            <table className="w-full text-sm">
                                <tbody>
                                    {variants.map((v: any) => (
                                        <tr className="border-t" key={v.id}>
                                            <td className="p-3">
                                                {v.sku}
                                                <div className="text-muted-foreground">
                                                    {v.color} / {v.size}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                {(
                                                    v.default_price_minor / 100
                                                ).toFixed(2)}{' '}
                                                {v.currency}
                                            </td>
                                            <td className="p-3">
                                                {v.stock_quantity} (
                                                {v.stock_policy})
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

import { Head, Link, useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
export default function ProductForm({ product, designs, catalogs }: any) {
    const form = useForm({
        title: product?.title ?? '',
        slug: product?.slug ?? '',
        description: product?.description ?? '',
        design_id: product?.design_id ?? '',
        brand: product?.brand ?? 'TeeBravo',
        status: product?.status ?? 'draft',
        seo_title: product?.seo_title ?? '',
        seo_description: product?.seo_description ?? '',
        catalog_ids: [] as number[],
    });
    const submit = (e: any) => {
        e.preventDefault();
        product ? form.put(`/products/${product.id}`) : form.post('/products');
    };
    return (
        <>
            <Head title={product ? 'Edit product' : 'New product'} />
            <div className="max-w-3xl space-y-6 p-6">
                <div>
                    <h1 className="text-2xl font-semibold">
                        {product ? 'Edit product' : 'New product'}
                    </h1>
                    <p className="text-muted-foreground">
                        Product identity is linked to one immutable design.
                    </p>
                </div>
                <form
                    onSubmit={submit}
                    className="space-y-4 rounded-xl border p-6"
                >
                    <Input
                        placeholder="Title"
                        value={form.data.title}
                        onChange={(e) => form.setData('title', e.target.value)}
                    />
                    <Input
                        placeholder="slug"
                        value={form.data.slug}
                        onChange={(e) => form.setData('slug', e.target.value)}
                    />
                    <Textarea
                        className="min-h-32"
                        placeholder="Description"
                        value={form.data.description}
                        onChange={(e) =>
                            form.setData('description', e.target.value)
                        }
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Select
                            value={
                                form.data.design_id
                                    ? String(form.data.design_id)
                                    : undefined
                            }
                            onValueChange={(value) =>
                                form.setData('design_id', Number(value))
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Choose design" />
                            </SelectTrigger>
                            <SelectContent>
                                {designs.map((d: any) => (
                                    <SelectItem key={d.id} value={String(d.id)}>
                                        {d.name} ({d.status})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={form.data.status}
                            onValueChange={(value) =>
                                form.setData('status', value)
                            }
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="archived">
                                    Archived
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {!product && (
                        <div>
                            <p className="mb-2 text-sm font-medium">Catalogs</p>
                            {catalogs.map((c: any) => (
                                <label
                                    className="mr-4 inline-flex items-center gap-2 text-sm"
                                    key={c.id}
                                >
                                    <Checkbox
                                        checked={form.data.catalog_ids.includes(
                                            c.id,
                                        )}
                                        onCheckedChange={(checked) =>
                                            form.setData(
                                                'catalog_ids',
                                                checked === true
                                                    ? [
                                                          ...form.data
                                                              .catalog_ids,
                                                          c.id,
                                                      ]
                                                    : form.data.catalog_ids.filter(
                                                          (id) => id !== c.id,
                                                      ),
                                            )
                                        }
                                    />
                                    {c.name}
                                </label>
                            ))}
                        </div>
                    )}
                    <div className="flex gap-2">
                        <Button disabled={form.processing}>Save</Button>
                        <Button variant="outline" asChild>
                            <Link href="/products">Cancel</Link>
                        </Button>
                    </div>
                </form>
            </div>
        </>
    );
}

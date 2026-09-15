import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectionList } from '@/components/ui/selection-list';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type Collection = {
    id: number;
    title: string;
    slug: string;
    description: string | null;
    selection_rule: string;
    status: string;
    featured: boolean | number;
    sort_order: number;
    product_ids: number[];
};
const empty = {
    title: '',
    slug: '',
    description: '',
    selection_rule: 'manual',
    status: 'draft',
    featured: false,
    sort_order: 0,
    product_ids: [] as number[],
};

export default function Collections({
    collections,
    products,
}: {
    collections: Collection[];
    products: { id: number; title: string }[];
}) {
    const [selected, setSelected] = useState<number | null>(null);
    const form = useForm(empty);
    return (
        <div className="space-y-6 p-6">
            <Head title="Collections" />
            <h1 className="text-2xl font-semibold">Collections</h1>
            <p className="text-muted-foreground">
                Choose products for an editorial collection, or use an automatic
                selection. Only active, populated collections appear in the
                store.
            </p>
            <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
                <SelectionList
                    label="Collections"
                    createLabel="New collection"
                    items={collections.map((item) => ({
                        ...item,
                        meta: item.selection_rule,
                        status: item.status,
                    }))}
                    selectedId={selected}
                    onCreate={() => {
                        setSelected(null);
                        form.setData(empty);
                        form.clearErrors();
                    }}
                    onSelect={(item) => {
                        setSelected(item.id);
                        form.clearErrors();
                        form.setData({
                            title: item.title,
                            slug: item.slug,
                            description: item.description ?? '',
                            selection_rule: item.selection_rule,
                            status: item.status,
                            featured: Boolean(item.featured),
                            sort_order: item.sort_order,
                            product_ids: item.product_ids,
                        });
                    }}
                />
                <form
                    className="bg-card space-y-5 rounded-xl border p-6 shadow-xs"
                    onSubmit={(event) => {
                        event.preventDefault();
                        if (selected) form.put(`/collections/${selected}`);
                        else form.post('/collections');
                    }}
                >
                    <label className="block">
                        Title
                        <Input
                            required
                            value={form.data.title}
                            onChange={(e) =>
                                form.setData('title', e.target.value)
                            }
                        />
                    </label>
                    <label className="block">
                        Slug
                        <Input
                            required
                            value={form.data.slug}
                            onChange={(e) =>
                                form.setData('slug', e.target.value)
                            }
                        />
                    </label>
                    <label className="block">
                        Description
                        <Textarea
                            className="min-h-24"
                            rows={3}
                            value={form.data.description}
                            onChange={(e) =>
                                form.setData('description', e.target.value)
                            }
                        />
                    </label>
                    <div className="space-y-2">
                        <Label htmlFor="collection-selection-rule">
                            Product selection
                        </Label>
                        <Select
                            value={form.data.selection_rule}
                            onValueChange={(value) =>
                                form.setData('selection_rule', value)
                            }
                        >
                            <SelectTrigger
                                id="collection-selection-rule"
                                className="w-full"
                            >
                                <SelectValue placeholder="Select a selection mode" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="manual">
                                    Selected designs
                                </SelectItem>
                                <SelectItem value="newest">
                                    Newest designs and clothing
                                </SelectItem>
                                <SelectItem value="tees">
                                    Graphic tees
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {form.data.selection_rule === 'manual' && (
                        <fieldset className="max-h-72 space-y-3 overflow-y-auto rounded-lg border p-4">
                            <legend className="px-1 text-sm font-medium">
                                Designs
                            </legend>
                            {products.map((product) => (
                                <label
                                    key={product.id}
                                    className="flex items-center gap-3 text-sm"
                                >
                                    <Checkbox
                                        checked={form.data.product_ids.includes(
                                            product.id,
                                        )}
                                        onCheckedChange={(checked) =>
                                            form.setData(
                                                'product_ids',
                                                checked === true
                                                    ? [
                                                          ...form.data
                                                              .product_ids,
                                                          product.id,
                                                      ]
                                                    : form.data.product_ids.filter(
                                                          (id) =>
                                                              id !== product.id,
                                                      ),
                                            )
                                        }
                                    />
                                    <span>{product.title}</span>
                                </label>
                            ))}
                        </fieldset>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="collection-status">Status</Label>
                        <Select
                            value={form.data.status}
                            onValueChange={(value) =>
                                form.setData('status', value)
                            }
                        >
                            <SelectTrigger
                                id="collection-status"
                                className="w-full"
                            >
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <label className="flex items-center gap-3 text-sm font-medium">
                        <Checkbox
                            checked={form.data.featured}
                            onCheckedChange={(checked) =>
                                form.setData('featured', checked === true)
                            }
                        />
                        <span>Show on homepage</span>
                    </label>
                    <label className="block">
                        Display order
                        <Input
                            type="number"
                            min={0}
                            max={999}
                            value={form.data.sort_order}
                            onChange={(e) =>
                                form.setData(
                                    'sort_order',
                                    Number(e.target.value),
                                )
                            }
                        />
                    </label>
                    {Object.entries(form.errors).map(([field, error]) => (
                        <p
                            role="alert"
                            key={field}
                            className="text-destructive"
                        >
                            {error}
                        </p>
                    ))}
                    <Button disabled={form.processing}>Save collection</Button>
                </form>
            </div>
        </div>
    );
}
